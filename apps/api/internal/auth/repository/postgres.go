package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/creatoros/platform/apps/api/internal/auth/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct {
	pool *pgxpool.Pool
}

type rowQuerier interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

func (repository *Postgres) CreateUser(ctx context.Context, params domain.CreateUserParams) (domain.User, error) {
	tx, err := repository.pool.Begin(ctx)
	if err != nil {
		return domain.User{}, fmt.Errorf("begin create user: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var userID string
	err = tx.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, display_name, preferred_locale)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, params.Email, params.PasswordHash, params.DisplayName, params.PreferredLocale).Scan(&userID)
	if err != nil {
		if isUniqueViolation(err) {
			return domain.User{}, domain.ErrConflict
		}
		return domain.User{}, fmt.Errorf("insert user: %w", err)
	}

	result, err := tx.Exec(ctx, `
		INSERT INTO user_roles (user_id, role_id)
		SELECT $1, id FROM roles WHERE code = $2
	`, userID, params.Role)
	if err != nil {
		return domain.User{}, fmt.Errorf("assign user role: %w", err)
	}
	if result.RowsAffected() != 1 {
		return domain.User{}, domain.ErrInvalidRole
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, userID, params.VerificationTokenHash, params.VerificationExpiresAt); err != nil {
		return domain.User{}, fmt.Errorf("insert verification token: %w", err)
	}

	user, err := loadUser(ctx, tx, userID)
	if err != nil {
		return domain.User{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.User{}, fmt.Errorf("commit create user: %w", err)
	}
	return user, nil
}

func (repository *Postgres) FindAccountByEmail(ctx context.Context, email string) (domain.Account, error) {
	row := repository.pool.QueryRow(ctx, `
		SELECT
			u.id, u.email, u.password_hash, u.display_name, u.preferred_locale,
			u.status, u.email_verified_at, u.created_at, u.updated_at,
			COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL), ARRAY[]::text[]),
			COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), ARRAY[]::text[])
		FROM users u
		LEFT JOIN user_roles ur ON ur.user_id = u.id
		LEFT JOIN roles r ON r.id = ur.role_id
		LEFT JOIN role_permissions rp ON rp.role_id = r.id
		LEFT JOIN permissions p ON p.id = rp.permission_id
		WHERE u.email = $1
		GROUP BY u.id
	`, email)

	var account domain.Account
	err := row.Scan(
		&account.ID,
		&account.Email,
		&account.PasswordHash,
		&account.DisplayName,
		&account.PreferredLocale,
		&account.Status,
		&account.EmailVerifiedAt,
		&account.CreatedAt,
		&account.UpdatedAt,
		&account.Roles,
		&account.Permissions,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Account{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Account{}, fmt.Errorf("query account: %w", err)
	}
	return account, nil
}

func (repository *Postgres) VerifyEmail(ctx context.Context, tokenHash []byte, now time.Time) (domain.User, error) {
	tx, err := repository.pool.Begin(ctx)
	if err != nil {
		return domain.User{}, fmt.Errorf("begin verify email: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var userID string
	err = tx.QueryRow(ctx, `
		SELECT user_id
		FROM email_verification_tokens
		WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > $2
		FOR UPDATE
	`, tokenHash, now).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrInvalidToken
	}
	if err != nil {
		return domain.User{}, fmt.Errorf("select verification token: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE email_verification_tokens SET consumed_at = $2
		WHERE token_hash = $1
	`, tokenHash, now); err != nil {
		return domain.User{}, fmt.Errorf("consume verification token: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		UPDATE users
		SET status = 'active', email_verified_at = COALESCE(email_verified_at, $2), updated_at = $2
		WHERE id = $1
	`, userID, now); err != nil {
		return domain.User{}, fmt.Errorf("verify user: %w", err)
	}

	user, err := loadUser(ctx, tx, userID)
	if err != nil {
		return domain.User{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.User{}, fmt.Errorf("commit verify email: %w", err)
	}
	return user, nil
}

func (repository *Postgres) CreateSession(ctx context.Context, userID string, tokenHash, csrfTokenHash []byte, expiresAt time.Time) (domain.Session, error) {
	var session domain.Session
	err := repository.pool.QueryRow(ctx, `
		INSERT INTO auth_sessions (user_id, token_hash, csrf_token_hash, expires_at)
		VALUES ($1, $2, $3, $4)
		RETURNING id, expires_at
	`, userID, tokenHash, csrfTokenHash, expiresAt).Scan(&session.ID, &session.ExpiresAt)
	if err != nil {
		return domain.Session{}, fmt.Errorf("insert session: %w", err)
	}
	user, err := loadUser(ctx, repository.pool, userID)
	if err != nil {
		return domain.Session{}, err
	}
	session.User = user
	session.CSRFTokenHash = csrfTokenHash
	return session, nil
}

func (repository *Postgres) FindSession(ctx context.Context, tokenHash []byte, now time.Time) (domain.Session, error) {
	row := repository.pool.QueryRow(ctx, `
		SELECT
			s.id, s.csrf_token_hash, s.expires_at,
			u.id, u.email, u.display_name, u.preferred_locale, u.status,
			u.email_verified_at, u.created_at, u.updated_at,
			COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL), ARRAY[]::text[]),
			COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), ARRAY[]::text[])
		FROM auth_sessions s
		JOIN users u ON u.id = s.user_id
		LEFT JOIN user_roles ur ON ur.user_id = u.id
		LEFT JOIN roles r ON r.id = ur.role_id
		LEFT JOIN role_permissions rp ON rp.role_id = r.id
		LEFT JOIN permissions p ON p.id = rp.permission_id
		WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > $2
		GROUP BY s.id, u.id
	`, tokenHash, now)

	var session domain.Session
	err := row.Scan(
		&session.ID,
		&session.CSRFTokenHash,
		&session.ExpiresAt,
		&session.User.ID,
		&session.User.Email,
		&session.User.DisplayName,
		&session.User.PreferredLocale,
		&session.User.Status,
		&session.User.EmailVerifiedAt,
		&session.User.CreatedAt,
		&session.User.UpdatedAt,
		&session.User.Roles,
		&session.User.Permissions,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Session{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Session{}, fmt.Errorf("query session: %w", err)
	}
	return session, nil
}

func (repository *Postgres) RevokeSession(ctx context.Context, tokenHash []byte, now time.Time) error {
	_, err := repository.pool.Exec(ctx, `
		UPDATE auth_sessions
		SET revoked_at = COALESCE(revoked_at, $2)
		WHERE token_hash = $1
	`, tokenHash, now)
	if err != nil {
		return fmt.Errorf("update session: %w", err)
	}
	return nil
}

func (repository *Postgres) CreatePasswordReset(ctx context.Context, email string, tokenHash []byte, expiresAt time.Time) (bool, error) {
	tx, err := repository.pool.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("begin password reset: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var userID string
	err = tx.QueryRow(ctx, "SELECT id FROM users WHERE email = $1 AND status <> 'disabled'", email).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("find password reset user: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE password_reset_tokens SET consumed_at = now()
		WHERE user_id = $1 AND consumed_at IS NULL
	`, userID); err != nil {
		return false, fmt.Errorf("invalidate password reset tokens: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, userID, tokenHash, expiresAt); err != nil {
		return false, fmt.Errorf("insert password reset token: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return false, fmt.Errorf("commit password reset: %w", err)
	}
	return true, nil
}

func (repository *Postgres) ResetPassword(ctx context.Context, tokenHash []byte, passwordHash string, now time.Time) error {
	tx, err := repository.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin reset password: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var userID string
	err = tx.QueryRow(ctx, `
		SELECT user_id
		FROM password_reset_tokens
		WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > $2
		FOR UPDATE
	`, tokenHash, now).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrInvalidToken
	}
	if err != nil {
		return fmt.Errorf("select password reset token: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE password_reset_tokens SET consumed_at = $2 WHERE token_hash = $1
	`, tokenHash, now); err != nil {
		return fmt.Errorf("consume password reset token: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		UPDATE users SET password_hash = $2, updated_at = $3 WHERE id = $1
	`, userID, passwordHash, now); err != nil {
		return fmt.Errorf("update password: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		UPDATE auth_sessions SET revoked_at = $2
		WHERE user_id = $1 AND revoked_at IS NULL
	`, userID, now); err != nil {
		return fmt.Errorf("revoke user sessions: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit reset password: %w", err)
	}
	return nil
}

func (repository *Postgres) UpdateSettings(ctx context.Context, userID, locale string, now time.Time) (domain.User, error) {
	result, err := repository.pool.Exec(ctx, `
		UPDATE users SET preferred_locale = $2, updated_at = $3 WHERE id = $1
	`, userID, locale, now)
	if err != nil {
		return domain.User{}, fmt.Errorf("update user settings: %w", err)
	}
	if result.RowsAffected() != 1 {
		return domain.User{}, domain.ErrNotFound
	}
	return loadUser(ctx, repository.pool, userID)
}

func loadUser(ctx context.Context, query rowQuerier, userID string) (domain.User, error) {
	row := query.QueryRow(ctx, `
		SELECT
			u.id, u.email, u.display_name, u.preferred_locale, u.status,
			u.email_verified_at, u.created_at, u.updated_at,
			COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL), ARRAY[]::text[]),
			COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), ARRAY[]::text[])
		FROM users u
		LEFT JOIN user_roles ur ON ur.user_id = u.id
		LEFT JOIN roles r ON r.id = ur.role_id
		LEFT JOIN role_permissions rp ON rp.role_id = r.id
		LEFT JOIN permissions p ON p.id = rp.permission_id
		WHERE u.id = $1
		GROUP BY u.id
	`, userID)

	var user domain.User
	err := row.Scan(
		&user.ID,
		&user.Email,
		&user.DisplayName,
		&user.PreferredLocale,
		&user.Status,
		&user.EmailVerifiedAt,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.Roles,
		&user.Permissions,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.User{}, fmt.Errorf("load user: %w", err)
	}
	return user, nil
}

func isUniqueViolation(err error) bool {
	var databaseError *pgconn.PgError
	return errors.As(err, &databaseError) && databaseError.Code == "23505"
}
