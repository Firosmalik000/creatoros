package creator_test

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/creatoros/platform/apps/api/internal/creator/domain"
	creatorrepository "github.com/creatoros/platform/apps/api/internal/creator/repository"
	creatorservice "github.com/creatoros/platform/apps/api/internal/creator/service"
	"github.com/creatoros/platform/apps/api/internal/platform/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestCreatorVerificationControlsPublicVisibility(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not configured")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	pool, err := database.Open(ctx, databaseURL)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer pool.Close()
	lock, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("acquire integration lock: %v", err)
	}
	if _, err := lock.Exec(ctx, "SELECT pg_advisory_lock($1)", int64(772001)); err != nil {
		lock.Release()
		t.Fatalf("lock integration database: %v", err)
	}
	defer func() {
		_, _ = lock.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", int64(772001))
		lock.Release()
	}()
	if _, err := pool.Exec(ctx, "TRUNCATE users, email_outbox CASCADE"); err != nil {
		t.Fatalf("truncate users: %v", err)
	}
	defer func() { _, _ = pool.Exec(context.Background(), "TRUNCATE users, email_outbox CASCADE") }()

	creatorID := insertUser(t, ctx, pool, "phase2-creator@example.test", "creator")
	adminID := insertUser(t, ctx, pool, "phase2-admin@example.test", "admin")
	repository := creatorrepository.NewPostgres(pool)
	service := creatorservice.New(repository)
	creator := domain.Actor{UserID: creatorID, Roles: []string{"creator"}, Permissions: []string{"creator.profile.update", "creator.verification.submit"}}
	admin := domain.Actor{UserID: adminID, Roles: []string{"admin"}, Permissions: []string{"creator.verification.review"}}

	saved, err := service.SaveOnboarding(ctx, creator, completeInput("verified-creator"), "en")
	if err != nil {
		t.Fatalf("save onboarding: %v", err)
	}
	if !saved.Complete || saved.VerificationStatus != "draft" {
		t.Fatalf("expected complete draft, got complete=%v status=%q missing=%v", saved.Complete, saved.VerificationStatus, saved.MissingFields)
	}
	if _, err := service.PublicProfile(ctx, "verified-creator", "en"); !errors.Is(err, creatorservice.ErrNotFound) {
		t.Fatalf("draft creator must not be public, got %v", err)
	}

	if _, err := service.Submit(ctx, creator, "en"); err != nil {
		t.Fatalf("submit verification: %v", err)
	}
	queue, total, err := service.VerificationQueue(ctx, admin, "submitted", 1, 20)
	if err != nil || total != 1 || len(queue) != 1 || queue[0].UserID != creatorID {
		t.Fatalf("unexpected review queue: items=%#v total=%d err=%v", queue, total, err)
	}
	if _, err := service.Review(ctx, admin, creatorID, "verified", "Evidence checked.", "en"); err != nil {
		t.Fatalf("approve creator: %v", err)
	}
	public, err := service.PublicProfile(ctx, "verified-creator", "en")
	if err != nil {
		t.Fatalf("load verified creator: %v", err)
	}
	if public.DisplayName != "Phase Two Creator" || len(public.Portfolio) != 1 {
		t.Fatalf("unexpected public profile: %#v", public)
	}

	changed := completeInput("verified-creator")
	changed.Headline = "Updated creator headline"
	if _, err := service.SaveOnboarding(ctx, creator, changed, "en"); err != nil {
		t.Fatalf("edit verified creator: %v", err)
	}
	if _, err := service.PublicProfile(ctx, "verified-creator", "en"); !errors.Is(err, creatorservice.ErrNotFound) {
		t.Fatalf("edited creator must return to private draft, got %v", err)
	}
	var eventCount int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM creator_verification_events WHERE creator_user_id = $1`, creatorID).Scan(&eventCount); err != nil {
		t.Fatalf("count verification events: %v", err)
	}
	if eventCount != 3 {
		t.Fatalf("expected submit, approve, and edit audit events; got %d", eventCount)
	}
}

func TestCreatorSaveIsAtomicWhenCatalogReferenceIsInvalid(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not configured")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	pool, err := database.Open(ctx, databaseURL)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer pool.Close()
	lock, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("acquire integration lock: %v", err)
	}
	if _, err := lock.Exec(ctx, "SELECT pg_advisory_lock($1)", int64(772001)); err != nil {
		lock.Release()
		t.Fatalf("lock integration database: %v", err)
	}
	defer func() {
		_, _ = lock.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", int64(772001))
		lock.Release()
	}()
	if _, err := pool.Exec(ctx, "TRUNCATE users, email_outbox CASCADE"); err != nil {
		t.Fatalf("truncate users: %v", err)
	}
	defer func() { _, _ = pool.Exec(context.Background(), "TRUNCATE users, email_outbox CASCADE") }()

	creatorID := insertUser(t, ctx, pool, "atomic-creator@example.test", "creator")
	repository := creatorrepository.NewPostgres(pool)
	service := creatorservice.New(repository)
	actor := domain.Actor{UserID: creatorID, Roles: []string{"creator"}}
	input := completeInput("atomic-creator")
	if _, err := service.SaveOnboarding(ctx, actor, input, "id"); err != nil {
		t.Fatalf("save initial profile: %v", err)
	}
	input.Headline = "This must roll back"
	input.CategoryCodes = []string{"missing-category"}
	if _, err := service.SaveOnboarding(ctx, actor, input, "id"); !errors.Is(err, creatorservice.ErrValidation) {
		t.Fatalf("expected invalid reference validation, got %v", err)
	}
	profile, err := service.GetOnboarding(ctx, actor, "id")
	if err != nil {
		t.Fatalf("reload profile: %v", err)
	}
	if profile.Headline != "Food and lifestyle storyteller" || len(profile.Categories) != 1 || profile.Categories[0].Code != "food-lifestyle" {
		t.Fatalf("failed save changed persisted profile: %#v", profile.Profile)
	}
}

func completeInput(slug string) domain.SaveInput {
	return domain.SaveInput{
		Slug: slug, Headline: "Food and lifestyle storyteller",
		Bio:  "I create practical food stories with clear product demonstrations for Southeast Asian audiences.",
		City: "Jakarta", CountryCode: "ID",
		CategoryCodes: []string{"food-lifestyle"}, Languages: []string{"id", "en"},
		SocialAccounts: []domain.SocialAccount{{
			PlatformCode: "instagram", Handle: "phase2creator",
			ProfileURL: "https://www.instagram.com/phase2creator", FollowerCount: 42000,
			AverageViews: 18000, EngagementBPS: 640,
		}},
		Portfolio: []domain.PortfolioItem{{
			Title: "Kitchen story", Description: "Concept, filming, and edit.",
			MediaURL: "https://example.com/work/kitchen-story",
		}},
	}
}

func insertUser(t *testing.T, ctx context.Context, pool *pgxpool.Pool, email, role string) string {
	t.Helper()
	var userID string
	if err := pool.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO users (email, password_hash, display_name, preferred_locale, status, email_verified_at)
			VALUES ($1, 'unused', $2, 'id', 'active', now()) RETURNING id
		), assigned AS (
			INSERT INTO user_roles (user_id, role_id)
			SELECT inserted.id, roles.id FROM inserted CROSS JOIN roles WHERE roles.code = $3
			RETURNING user_id
		)
		SELECT user_id FROM assigned
	`, email, map[string]string{"creator": "Phase Two Creator", "admin": "Agency Reviewer"}[role], role).Scan(&userID); err != nil {
		t.Fatalf("insert %s user: %v", role, err)
	}
	return userID
}
