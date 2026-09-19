package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/creatoros/platform/apps/api/internal/creator/domain"
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

func (repository *Postgres) ListPlatforms(ctx context.Context) ([]domain.CatalogItem, error) {
	rows, err := repository.pool.Query(ctx, `
		SELECT code, name FROM platforms WHERE is_active ORDER BY sort_order, name
	`)
	if err != nil {
		return nil, fmt.Errorf("query platforms: %w", err)
	}
	defer rows.Close()
	items := []domain.CatalogItem{}
	for rows.Next() {
		var item domain.CatalogItem
		if err := rows.Scan(&item.Code, &item.Name); err != nil {
			return nil, fmt.Errorf("scan platform: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (repository *Postgres) ListCategories(ctx context.Context, locale string) ([]domain.CatalogItem, error) {
	rows, err := repository.pool.Query(ctx, `
		SELECT slug, CASE $1 WHEN 'en' THEN name_en WHEN 'ms' THEN name_ms ELSE name_id END
		FROM categories WHERE is_active ORDER BY sort_order, slug
	`, locale)
	if err != nil {
		return nil, fmt.Errorf("query categories: %w", err)
	}
	defer rows.Close()
	items := []domain.CatalogItem{}
	for rows.Next() {
		var item domain.CatalogItem
		if err := rows.Scan(&item.Code, &item.Name); err != nil {
			return nil, fmt.Errorf("scan category: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (repository *Postgres) GetProfile(ctx context.Context, userID, locale string) (domain.Profile, error) {
	return loadProfile(ctx, repository.pool, userID, locale)
}

func (repository *Postgres) SaveProfile(ctx context.Context, userID string, input domain.SaveInput, now time.Time) (domain.Profile, error) {
	tx, err := repository.pool.Begin(ctx)
	if err != nil {
		return domain.Profile{}, fmt.Errorf("begin save creator: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var eligible bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM users u
			JOIN user_roles ur ON ur.user_id = u.id
			JOIN roles r ON r.id = ur.role_id
			WHERE u.id = $1 AND u.status = 'active' AND r.code = 'creator'
		)
	`, userID).Scan(&eligible); err != nil {
		return domain.Profile{}, fmt.Errorf("check creator role: %w", err)
	}
	if !eligible {
		return domain.Profile{}, domain.ErrForbidden
	}

	var previousStatus string
	err = tx.QueryRow(ctx, `SELECT verification_status FROM creator_profiles WHERE user_id = $1 FOR UPDATE`, userID).Scan(&previousStatus)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return domain.Profile{}, fmt.Errorf("lock creator profile: %w", err)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		previousStatus = "draft"
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO creator_profiles (
			user_id, slug, headline, bio, city, country_code, verification_status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $7)
		ON CONFLICT (user_id) DO UPDATE SET
			slug = EXCLUDED.slug,
			headline = EXCLUDED.headline,
			bio = EXCLUDED.bio,
			city = EXCLUDED.city,
			country_code = EXCLUDED.country_code,
			verification_status = 'draft',
			submitted_at = NULL,
			reviewed_at = NULL,
			reviewed_by = NULL,
			review_note = NULL,
			updated_at = EXCLUDED.updated_at
	`, userID, input.Slug, input.Headline, input.Bio, input.City, input.CountryCode, now)
	if err != nil {
		if isUniqueViolation(err) {
			return domain.Profile{}, domain.ErrConflict
		}
		return domain.Profile{}, fmt.Errorf("upsert creator profile: %w", err)
	}

	if _, err := tx.Exec(ctx, `DELETE FROM creator_categories WHERE creator_user_id = $1`, userID); err != nil {
		return domain.Profile{}, fmt.Errorf("clear creator categories: %w", err)
	}
	for _, code := range input.CategoryCodes {
		result, err := tx.Exec(ctx, `
			INSERT INTO creator_categories (creator_user_id, category_id)
			SELECT $1, id FROM categories WHERE slug = $2 AND is_active
		`, userID, code)
		if err != nil {
			return domain.Profile{}, fmt.Errorf("insert creator category: %w", err)
		}
		if result.RowsAffected() != 1 {
			return domain.Profile{}, domain.ErrInvalidReference
		}
	}

	if _, err := tx.Exec(ctx, `DELETE FROM creator_languages WHERE creator_user_id = $1`, userID); err != nil {
		return domain.Profile{}, fmt.Errorf("clear creator languages: %w", err)
	}
	for _, language := range input.Languages {
		if _, err := tx.Exec(ctx, `INSERT INTO creator_languages (creator_user_id, language_code) VALUES ($1, $2)`, userID, language); err != nil {
			return domain.Profile{}, fmt.Errorf("insert creator language: %w", err)
		}
	}

	if _, err := tx.Exec(ctx, `DELETE FROM creator_social_accounts WHERE creator_user_id = $1`, userID); err != nil {
		return domain.Profile{}, fmt.Errorf("clear creator social accounts: %w", err)
	}
	for _, account := range input.SocialAccounts {
		result, err := tx.Exec(ctx, `
			INSERT INTO creator_social_accounts (
				creator_user_id, platform_id, handle, profile_url, follower_count, average_views, engagement_bps, created_at, updated_at
			)
			SELECT $1, id, $3, $4, $5, $6, $7, $8, $8
			FROM platforms WHERE code = $2 AND is_active
		`, userID, account.PlatformCode, account.Handle, account.ProfileURL, account.FollowerCount, account.AverageViews, account.EngagementBPS, now)
		if err != nil {
			return domain.Profile{}, fmt.Errorf("insert social account: %w", err)
		}
		if result.RowsAffected() != 1 {
			return domain.Profile{}, domain.ErrInvalidReference
		}
	}

	if _, err := tx.Exec(ctx, `DELETE FROM creator_portfolios WHERE creator_user_id = $1`, userID); err != nil {
		return domain.Profile{}, fmt.Errorf("clear creator portfolio: %w", err)
	}
	for _, item := range input.Portfolio {
		if _, err := tx.Exec(ctx, `
			INSERT INTO creator_portfolios (
				creator_user_id, title, description, media_url, thumbnail_url, sort_order, created_at, updated_at
			) VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7, $7)
		`, userID, item.Title, item.Description, item.MediaURL, item.ThumbnailURL, item.SortOrder, now); err != nil {
			return domain.Profile{}, fmt.Errorf("insert portfolio item: %w", err)
		}
	}

	if previousStatus != "draft" {
		if _, err := tx.Exec(ctx, `
			INSERT INTO creator_verification_events (creator_user_id, actor_user_id, from_status, to_status, note, created_at)
			VALUES ($1, $1, $2, 'draft', 'Profile changed after a verification submission.', $3)
		`, userID, previousStatus, now); err != nil {
			return domain.Profile{}, fmt.Errorf("record creator profile reset: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Profile{}, fmt.Errorf("commit save creator: %w", err)
	}
	return repository.GetProfile(ctx, userID, "id")
}

func (repository *Postgres) SubmitVerification(ctx context.Context, userID string, now time.Time) (domain.Profile, error) {
	tx, err := repository.pool.Begin(ctx)
	if err != nil {
		return domain.Profile{}, fmt.Errorf("begin verification submission: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	var fromStatus string
	err = tx.QueryRow(ctx, `
		SELECT verification_status FROM creator_profiles WHERE user_id = $1 FOR UPDATE
	`, userID).Scan(&fromStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Profile{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Profile{}, fmt.Errorf("lock verification submission: %w", err)
	}
	if fromStatus != "draft" && fromStatus != "revision_required" && fromStatus != "rejected" {
		return domain.Profile{}, domain.ErrInvalidTransition
	}
	if _, err := tx.Exec(ctx, `
		UPDATE creator_profiles
		SET verification_status = 'submitted', submitted_at = $2,
			reviewed_at = NULL, reviewed_by = NULL, review_note = NULL, updated_at = $2
		WHERE user_id = $1
	`, userID, now); err != nil {
		return domain.Profile{}, fmt.Errorf("update verification submission: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO creator_verification_events (creator_user_id, actor_user_id, from_status, to_status, created_at)
		VALUES ($1, $1, $2, 'submitted', $3)
	`, userID, fromStatus, now); err != nil {
		return domain.Profile{}, fmt.Errorf("record verification submission: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Profile{}, fmt.Errorf("commit verification submission: %w", err)
	}
	return repository.GetProfile(ctx, userID, "id")
}

func (repository *Postgres) ListVerificationQueue(ctx context.Context, status string, limit, offset int) ([]domain.ReviewItem, int, error) {
	var total int
	if err := repository.pool.QueryRow(ctx, `SELECT count(*) FROM creator_profiles WHERE verification_status = $1`, status).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count verification queue: %w", err)
	}
	rows, err := repository.pool.Query(ctx, `
		SELECT p.user_id, u.display_name, p.slug, p.headline, p.city, p.country_code,
			p.verification_status, p.submitted_at, p.updated_at
		FROM creator_profiles p
		JOIN users u ON u.id = p.user_id
		WHERE p.verification_status = $1
		ORDER BY p.submitted_at NULLS LAST, p.updated_at
		LIMIT $2 OFFSET $3
	`, status, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("query verification queue: %w", err)
	}
	defer rows.Close()
	items := []domain.ReviewItem{}
	for rows.Next() {
		var item domain.ReviewItem
		if err := rows.Scan(&item.UserID, &item.DisplayName, &item.Slug, &item.Headline, &item.City, &item.CountryCode, &item.Status, &item.SubmittedAt, &item.UpdatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan verification queue: %w", err)
		}
		items = append(items, item)
	}
	return items, total, rows.Err()
}

func (repository *Postgres) ReviewVerification(ctx context.Context, creatorUserID, reviewerUserID, decision, note string, now time.Time) (domain.Profile, error) {
	tx, err := repository.pool.Begin(ctx)
	if err != nil {
		return domain.Profile{}, fmt.Errorf("begin creator review: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	var fromStatus string
	err = tx.QueryRow(ctx, `SELECT verification_status FROM creator_profiles WHERE user_id = $1 FOR UPDATE`, creatorUserID).Scan(&fromStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Profile{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Profile{}, fmt.Errorf("lock creator review: %w", err)
	}
	allowed := (fromStatus == "submitted" || fromStatus == "under_review") && decision != "suspended"
	if decision == "suspended" {
		allowed = fromStatus == "verified"
	}
	if !allowed {
		return domain.Profile{}, domain.ErrInvalidTransition
	}
	if _, err := tx.Exec(ctx, `
		UPDATE creator_profiles
		SET verification_status = $2, reviewed_at = $3, reviewed_by = $4,
			review_note = NULLIF($5, ''), updated_at = $3
		WHERE user_id = $1
	`, creatorUserID, decision, now, reviewerUserID, note); err != nil {
		return domain.Profile{}, fmt.Errorf("update creator review: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO creator_verification_events (creator_user_id, actor_user_id, from_status, to_status, note, created_at)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6)
	`, creatorUserID, reviewerUserID, fromStatus, decision, note, now); err != nil {
		return domain.Profile{}, fmt.Errorf("record creator review: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Profile{}, fmt.Errorf("commit creator review: %w", err)
	}
	return domain.Profile{UserID: creatorUserID}, nil
}

func (repository *Postgres) FindPublicProfile(ctx context.Context, slug, locale string) (domain.Profile, error) {
	var userID string
	err := repository.pool.QueryRow(ctx, `
		SELECT p.user_id FROM creator_profiles p
		JOIN users u ON u.id = p.user_id
		WHERE p.slug = $1 AND p.verification_status = 'verified' AND u.status = 'active'
	`, slug).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Profile{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Profile{}, fmt.Errorf("find public creator id: %w", err)
	}
	return loadProfile(ctx, repository.pool, userID, locale)
}

func loadProfile(ctx context.Context, query querier, userID, locale string) (domain.Profile, error) {
	var profile domain.Profile
	err := query.QueryRow(ctx, `
		SELECT u.id, u.display_name,
			COALESCE(p.slug, ''), COALESCE(p.headline, ''), COALESCE(p.bio, ''),
			COALESCE(p.city, ''), COALESCE(p.country_code::text, ''),
			COALESCE(p.verification_status, 'draft'), p.submitted_at, p.reviewed_at,
			COALESCE(p.review_note, ''), p.created_at, p.updated_at
		FROM users u
		LEFT JOIN creator_profiles p ON p.user_id = u.id
		WHERE u.id = $1 AND EXISTS (
			SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
			WHERE ur.user_id = u.id AND r.code = 'creator'
		)
	`, userID).Scan(
		&profile.UserID, &profile.DisplayName, &profile.Slug, &profile.Headline, &profile.Bio,
		&profile.City, &profile.CountryCode, &profile.VerificationStatus, &profile.SubmittedAt,
		&profile.ReviewedAt, &profile.ReviewNote, &profile.CreatedAt, &profile.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Profile{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Profile{}, fmt.Errorf("query creator profile: %w", err)
	}
	profile.Categories = []domain.CatalogItem{}
	profile.Languages = []string{}
	profile.SocialAccounts = []domain.SocialAccount{}
	profile.Portfolio = []domain.PortfolioItem{}
	if profile.Slug == "" {
		return profile, nil
	}

	rows, err := query.Query(ctx, `
		SELECT c.slug, CASE $2 WHEN 'en' THEN c.name_en WHEN 'ms' THEN c.name_ms ELSE c.name_id END
		FROM creator_categories cc JOIN categories c ON c.id = cc.category_id
		WHERE cc.creator_user_id = $1 ORDER BY c.sort_order, c.slug
	`, userID, locale)
	if err != nil {
		return domain.Profile{}, fmt.Errorf("query creator categories: %w", err)
	}
	for rows.Next() {
		var item domain.CatalogItem
		if err := rows.Scan(&item.Code, &item.Name); err != nil {
			rows.Close()
			return domain.Profile{}, fmt.Errorf("scan creator category: %w", err)
		}
		profile.Categories = append(profile.Categories, item)
	}
	rows.Close()

	rows, err = query.Query(ctx, `SELECT language_code FROM creator_languages WHERE creator_user_id = $1 ORDER BY language_code`, userID)
	if err != nil {
		return domain.Profile{}, fmt.Errorf("query creator languages: %w", err)
	}
	for rows.Next() {
		var language string
		if err := rows.Scan(&language); err != nil {
			rows.Close()
			return domain.Profile{}, fmt.Errorf("scan creator language: %w", err)
		}
		profile.Languages = append(profile.Languages, language)
	}
	rows.Close()

	rows, err = query.Query(ctx, `
		SELECT p.code, p.name, s.handle, s.profile_url, s.follower_count, s.average_views, s.engagement_bps
		FROM creator_social_accounts s JOIN platforms p ON p.id = s.platform_id
		WHERE s.creator_user_id = $1 ORDER BY p.sort_order, p.code
	`, userID)
	if err != nil {
		return domain.Profile{}, fmt.Errorf("query creator socials: %w", err)
	}
	for rows.Next() {
		var item domain.SocialAccount
		if err := rows.Scan(&item.PlatformCode, &item.PlatformName, &item.Handle, &item.ProfileURL, &item.FollowerCount, &item.AverageViews, &item.EngagementBPS); err != nil {
			rows.Close()
			return domain.Profile{}, fmt.Errorf("scan creator social: %w", err)
		}
		profile.SocialAccounts = append(profile.SocialAccounts, item)
	}
	rows.Close()

	rows, err = query.Query(ctx, `
		SELECT id, title, description, media_url, COALESCE(thumbnail_url, ''), sort_order
		FROM creator_portfolios WHERE creator_user_id = $1 ORDER BY sort_order, created_at
	`, userID)
	if err != nil {
		return domain.Profile{}, fmt.Errorf("query creator portfolio: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var item domain.PortfolioItem
		if err := rows.Scan(&item.ID, &item.Title, &item.Description, &item.MediaURL, &item.ThumbnailURL, &item.SortOrder); err != nil {
			return domain.Profile{}, fmt.Errorf("scan portfolio item: %w", err)
		}
		profile.Portfolio = append(profile.Portfolio, item)
	}
	return profile, rows.Err()
}

func isUniqueViolation(err error) bool {
	var postgresError *pgconn.PgError
	return errors.As(err, &postgresError) && postgresError.Code == "23505"
}
