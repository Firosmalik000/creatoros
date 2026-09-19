package service_test

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/creatoros/platform/apps/api/internal/platform/database"
	"github.com/creatoros/platform/apps/api/internal/service/domain"
	"github.com/creatoros/platform/apps/api/internal/service/repository"
	serviceservice "github.com/creatoros/platform/apps/api/internal/service/service"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestCreatorServicesLifecycleAndVisibility(t *testing.T) {
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

	verifiedID := insertCreator(t, ctx, pool, "services-verified@example.test", "service-creator", "verified")
	draftID := insertCreator(t, ctx, pool, "services-draft@example.test", "draft-service-creator", "draft")
	permission := []string{"creator.services.manage"}
	verified := domain.Actor{UserID: verifiedID, Roles: []string{"creator"}, Permissions: permission}
	draft := domain.Actor{UserID: draftID, Roles: []string{"creator"}, Permissions: permission}
	module := serviceservice.New(repository.NewPostgres(pool))

	input := validInput("short-video-production")
	created, err := module.Create(ctx, verified, input)
	if err != nil || created.Status != "draft" || len(created.Packages) != 2 {
		t.Fatalf("create service: %#v err=%v", created, err)
	}
	if public, err := module.ListPublic(ctx, "service-creator"); err != nil || len(public) != 0 {
		t.Fatalf("draft leaked publicly: %#v err=%v", public, err)
	}
	if _, err := module.GetOwn(ctx, draft, created.ID); !errors.Is(err, serviceservice.ErrNotFound) {
		t.Fatalf("other creator read must be hidden: %v", err)
	}
	published, err := module.Publish(ctx, verified, created.ID)
	if err != nil || published.Status != "published" || published.PublishedAt == nil {
		t.Fatalf("publish service: %#v err=%v", published, err)
	}
	public, err := module.PublicDetail(ctx, "service-creator", input.Slug)
	if err != nil || public.ID != created.ID || public.Packages[0].PriceMinor != 1_500_000 || public.Packages[0].Currency != "IDR" {
		t.Fatalf("public service: %#v err=%v", public, err)
	}
	input.Title = "Updated short video production"
	updated, err := module.Update(ctx, verified, created.ID, input)
	if err != nil || updated.Status != "draft" || updated.PublishedAt != nil {
		t.Fatalf("edit must return to draft: %#v err=%v", updated, err)
	}
	if _, err := module.PublicDetail(ctx, "service-creator", input.Slug); !errors.Is(err, serviceservice.ErrNotFound) {
		t.Fatalf("edited draft must disappear publicly: %v", err)
	}

	draftService, err := module.Create(ctx, draft, validInput("unverified-offer"))
	if err != nil {
		t.Fatalf("create unverified draft: %v", err)
	}
	if _, err := module.Publish(ctx, draft, draftService.ID); !errors.Is(err, serviceservice.ErrInvalidTransition) {
		t.Fatalf("unverified creator publish must fail: %v", err)
	}
	invalid := validInput("bad-money")
	invalid.Packages[0].PriceMinor = 0
	if _, err := module.Create(ctx, verified, invalid); !errors.Is(err, serviceservice.ErrValidation) {
		t.Fatalf("zero money must fail validation: %v", err)
	}
}

func validInput(slug string) domain.SaveInput {
	return domain.SaveInput{
		Slug: slug, Title: "Short video production",
		Description: "A complete short-form video concept, production, edit, and delivery for a brand campaign.",
		Packages: []domain.Package{
			{Name: "Essential", Description: "One edited video.", PriceMinor: 1_500_000, Currency: "IDR", DeliveryDays: 7, RevisionLimit: 1},
			{Name: "Campaign", Description: "Three edited videos.", PriceMinor: 375_00, Currency: "USD", DeliveryDays: 14, RevisionLimit: 2},
		},
	}
}

func insertCreator(t *testing.T, ctx context.Context, pool *pgxpool.Pool, email, slug, status string) string {
	t.Helper()
	var userID string
	if err := pool.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO users (email, password_hash, display_name, preferred_locale, status, email_verified_at)
			VALUES ($1, 'unused', 'Service Creator', 'id', 'active', now()) RETURNING id
		), assigned AS (
			INSERT INTO user_roles (user_id, role_id)
			SELECT inserted.id, roles.id FROM inserted CROSS JOIN roles WHERE roles.code = 'creator'
			RETURNING user_id
		), profile AS (
			INSERT INTO creator_profiles (user_id, slug, headline, bio, city, country_code, verification_status, reviewed_at)
			SELECT user_id, $2, 'Video creator', 'Experienced video creator for regional brand campaigns.', 'Jakarta', 'ID', $3,
				CASE WHEN $3 = 'verified' THEN now() ELSE NULL END FROM assigned RETURNING user_id
		)
		SELECT user_id FROM profile
	`, email, slug, status).Scan(&userID); err != nil {
		t.Fatalf("insert creator: %v", err)
	}
	return userID
}
