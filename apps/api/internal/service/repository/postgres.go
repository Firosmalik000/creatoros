package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/creatoros/platform/apps/api/internal/service/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct{ pool *pgxpool.Pool }

type querier interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

func NewPostgres(pool *pgxpool.Pool) *Postgres { return &Postgres{pool: pool} }

func (repository *Postgres) ListOwn(ctx context.Context, userID string) ([]domain.Service, error) {
	return repository.list(ctx, `SELECT id FROM creator_services WHERE creator_user_id = $1 ORDER BY updated_at DESC`, userID)
}

func (repository *Postgres) GetOwn(ctx context.Context, userID, serviceID string) (domain.Service, error) {
	return load(ctx, repository.pool, `s.id = $1 AND s.creator_user_id = $2`, serviceID, userID)
}

func (repository *Postgres) Save(ctx context.Context, userID, serviceID string, input domain.SaveInput, now time.Time) (domain.Service, error) {
	tx, err := repository.pool.Begin(ctx)
	if err != nil {
		return domain.Service{}, fmt.Errorf("begin service save: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var eligible bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM users u
			JOIN user_roles ur ON ur.user_id = u.id
			JOIN roles r ON r.id = ur.role_id
			JOIN creator_profiles cp ON cp.user_id = u.id
			WHERE u.id = $1 AND u.status = 'active' AND r.code = 'creator'
		)
	`, userID).Scan(&eligible); err != nil {
		return domain.Service{}, fmt.Errorf("check service owner: %w", err)
	}
	if !eligible {
		return domain.Service{}, domain.ErrForbidden
	}

	if serviceID == "" {
		err = tx.QueryRow(ctx, `
			INSERT INTO creator_services (creator_user_id, slug, title, description, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $5) RETURNING id
		`, userID, input.Slug, input.Title, input.Description, now).Scan(&serviceID)
	} else {
		result, updateErr := tx.Exec(ctx, `
			UPDATE creator_services SET slug = $3, title = $4, description = $5,
				status = 'draft', published_at = NULL, updated_at = $6
			WHERE id = $1 AND creator_user_id = $2
		`, serviceID, userID, input.Slug, input.Title, input.Description, now)
		err = updateErr
		if err == nil && result.RowsAffected() == 0 {
			return domain.Service{}, domain.ErrNotFound
		}
	}
	if err != nil {
		if uniqueViolation(err) {
			return domain.Service{}, domain.ErrConflict
		}
		return domain.Service{}, fmt.Errorf("write creator service: %w", err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM service_packages WHERE service_id = $1`, serviceID); err != nil {
		return domain.Service{}, fmt.Errorf("clear service packages: %w", err)
	}
	for _, item := range input.Packages {
		if _, err := tx.Exec(ctx, `
			INSERT INTO service_packages (service_id, name, description, price_minor, currency, delivery_days, revision_limit, sort_order, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
		`, serviceID, item.Name, item.Description, item.PriceMinor, item.Currency, item.DeliveryDays, item.RevisionLimit, item.SortOrder, now); err != nil {
			return domain.Service{}, fmt.Errorf("insert service package: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Service{}, fmt.Errorf("commit service save: %w", err)
	}
	return repository.GetOwn(ctx, userID, serviceID)
}

func (repository *Postgres) Publish(ctx context.Context, userID, serviceID string, now time.Time) (domain.Service, error) {
	result, err := repository.pool.Exec(ctx, `
		UPDATE creator_services s SET status = 'published', published_at = $3, updated_at = $3
		FROM creator_profiles cp, users u
		WHERE s.id = $1 AND s.creator_user_id = $2
			AND cp.user_id = s.creator_user_id AND cp.verification_status = 'verified'
			AND u.id = s.creator_user_id AND u.status = 'active'
			AND EXISTS (SELECT 1 FROM service_packages sp WHERE sp.service_id = s.id)
	`, serviceID, userID, now)
	if err != nil {
		return domain.Service{}, fmt.Errorf("publish creator service: %w", err)
	}
	if result.RowsAffected() == 0 {
		var exists bool
		if err := repository.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM creator_services WHERE id = $1 AND creator_user_id = $2)`, serviceID, userID).Scan(&exists); err != nil {
			return domain.Service{}, fmt.Errorf("check service publication: %w", err)
		}
		if !exists {
			return domain.Service{}, domain.ErrNotFound
		}
		return domain.Service{}, domain.ErrInvalidTransition
	}
	return repository.GetOwn(ctx, userID, serviceID)
}

func (repository *Postgres) Unpublish(ctx context.Context, userID, serviceID string, now time.Time) (domain.Service, error) {
	result, err := repository.pool.Exec(ctx, `UPDATE creator_services SET status = 'draft', published_at = NULL, updated_at = $3 WHERE id = $1 AND creator_user_id = $2`, serviceID, userID, now)
	if err != nil {
		return domain.Service{}, fmt.Errorf("unpublish creator service: %w", err)
	}
	if result.RowsAffected() == 0 {
		return domain.Service{}, domain.ErrNotFound
	}
	return repository.GetOwn(ctx, userID, serviceID)
}

func (repository *Postgres) ListPublic(ctx context.Context, creatorSlug string) ([]domain.Service, error) {
	var exists bool
	if err := repository.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM creator_profiles cp JOIN users u ON u.id = cp.user_id WHERE cp.slug = $1 AND cp.verification_status = 'verified' AND u.status = 'active')`, creatorSlug).Scan(&exists); err != nil {
		return nil, fmt.Errorf("check public creator: %w", err)
	}
	if !exists {
		return nil, domain.ErrNotFound
	}
	return repository.list(ctx, `
		SELECT s.id FROM creator_services s
		JOIN creator_profiles cp ON cp.user_id = s.creator_user_id
		JOIN users u ON u.id = s.creator_user_id
		WHERE cp.slug = $1 AND cp.verification_status = 'verified' AND u.status = 'active' AND s.status = 'published'
		ORDER BY s.published_at DESC, s.id
	`, creatorSlug)
}

func (repository *Postgres) FindPublic(ctx context.Context, creatorSlug, serviceSlug string) (domain.Service, error) {
	return load(ctx, repository.pool, `cp.slug = $1 AND s.slug = $2 AND cp.verification_status = 'verified' AND u.status = 'active' AND s.status = 'published'`, creatorSlug, serviceSlug)
}

func (repository *Postgres) list(ctx context.Context, query string, args ...any) ([]domain.Service, error) {
	rows, err := repository.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query service ids: %w", err)
	}
	defer rows.Close()
	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan service id: %w", err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	items := make([]domain.Service, 0, len(ids))
	for _, id := range ids {
		item, err := load(ctx, repository.pool, `s.id = $1`, id)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func load(ctx context.Context, database querier, where string, args ...any) (domain.Service, error) {
	var item domain.Service
	err := database.QueryRow(ctx, `
		SELECT s.id, cp.slug, u.display_name, s.slug, s.title, s.description, s.status,
			s.published_at, s.created_at, s.updated_at
		FROM creator_services s
		JOIN creator_profiles cp ON cp.user_id = s.creator_user_id
		JOIN users u ON u.id = s.creator_user_id
		WHERE `+where, args...).Scan(&item.ID, &item.CreatorSlug, &item.CreatorDisplayName, &item.Slug, &item.Title, &item.Description, &item.Status, &item.PublishedAt, &item.CreatedAt, &item.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Service{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Service{}, fmt.Errorf("load service: %w", err)
	}
	rows, err := database.Query(ctx, `
		SELECT id, name, description, price_minor, currency, delivery_days, revision_limit, sort_order
		FROM service_packages WHERE service_id = $1 ORDER BY sort_order, id
	`, item.ID)
	if err != nil {
		return domain.Service{}, fmt.Errorf("query service packages: %w", err)
	}
	defer rows.Close()
	item.Packages = []domain.Package{}
	for rows.Next() {
		var pack domain.Package
		if err := rows.Scan(&pack.ID, &pack.Name, &pack.Description, &pack.PriceMinor, &pack.Currency, &pack.DeliveryDays, &pack.RevisionLimit, &pack.SortOrder); err != nil {
			return domain.Service{}, fmt.Errorf("scan service package: %w", err)
		}
		item.Packages = append(item.Packages, pack)
	}
	return item, rows.Err()
}

func uniqueViolation(err error) bool {
	var pgError *pgconn.PgError
	return errors.As(err, &pgError) && pgError.Code == "23505"
}
