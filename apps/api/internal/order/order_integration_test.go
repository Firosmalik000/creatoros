package order_test

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/creatoros/platform/apps/api/internal/order/domain"
	"github.com/creatoros/platform/apps/api/internal/order/repository"
	orderservice "github.com/creatoros/platform/apps/api/internal/order/service"
	"github.com/creatoros/platform/apps/api/internal/platform/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestOrderLifecycleAndStateMachine(t *testing.T) {
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

	clientID := insertUser(t, ctx, pool, "client@example.test", "Client User", "client")
	creatorID := insertCreator(t, ctx, pool, "creator@example.test", "creator-one", "verified")

	serviceID, packageID := insertPublishedService(t, ctx, pool, creatorID, "video-production", "Essential", 1_500_000, "IDR", 7, 1)

	clientActor := domain.Actor{
		UserID:      clientID,
		Roles:       []string{"client"},
		Permissions: []string{"orders.create", "marketplace.purchase"},
	}
	creatorActor := domain.Actor{
		UserID:      creatorID,
		Roles:       []string{"creator"},
		Permissions: []string{"orders.manage", "creator.services.manage"},
	}

	svc := orderservice.New(repository.NewPostgres(pool))

	// 1. Self-order must fail
	selfActor := domain.Actor{
		UserID:      creatorID,
		Roles:       []string{"creator"},
		Permissions: []string{"orders.create", "marketplace.purchase"},
	}
	_, err = svc.Create(ctx, selfActor, domain.CreateInput{
		ServiceID:    serviceID,
		PackageID:    packageID,
		BriefContent: "This brief has enough characters to pass length check.",
	})
	if !errors.Is(err, orderservice.ErrSelfOrder) {
		t.Fatalf("expected ErrSelfOrder, got: %v", err)
	}

	// 2. Client places valid order
	created, err := svc.Create(ctx, clientActor, domain.CreateInput{
		ServiceID:    serviceID,
		PackageID:    packageID,
		BriefContent: "We need an engaging 30-second TikTok review of our new mechanical keyboard product.",
	})
	if err != nil {
		t.Fatalf("create order failed: %v", err)
	}
	if created.Status != domain.StatusPendingAcceptance {
		t.Fatalf("expected status pending_acceptance, got %s", created.Status)
	}
	if created.PriceMinor != 1_500_000 || created.Currency != "IDR" || created.DeliveryDays != 7 || created.RevisionLimit != 1 {
		t.Fatalf("snapshot values mismatch: %#v", created)
	}

	// 3. Client and Creator list orders
	clientOrders, err := svc.ListClient(ctx, clientActor)
	if err != nil || len(clientOrders) != 1 {
		t.Fatalf("list client orders failed: items=%d, err=%v", len(clientOrders), err)
	}
	creatorOrders, err := svc.ListCreator(ctx, creatorActor)
	if err != nil || len(creatorOrders) != 1 {
		t.Fatalf("list creator orders failed: items=%d, err=%v", len(creatorOrders), err)
	}

	// 4. Detail with briefs and events
	detail, err := svc.GetClient(ctx, clientActor, created.ID)
	if err != nil {
		t.Fatalf("get client order detail failed: %v", err)
	}
	if len(detail.Briefs) != 1 || detail.Briefs[0].Version != 1 {
		t.Fatalf("expected initial brief version 1, got: %#v", detail.Briefs)
	}
	if len(detail.Events) != 1 || detail.Events[0].ToStatus != domain.StatusPendingAcceptance {
		t.Fatalf("expected initial order placed event, got: %#v", detail.Events)
	}

	// 5. Creator accepts order
	accepted, err := svc.Accept(ctx, creatorActor, created.ID, "I accept this brief and look forward to producing it.")
	if err != nil {
		t.Fatalf("accept order failed: %v", err)
	}
	if accepted.Status != domain.StatusAccepted {
		t.Fatalf("expected status accepted, got %s", accepted.Status)
	}
	if accepted.AcceptedAt == nil || accepted.DeadlineAt == nil {
		t.Fatalf("expected accepted_at and deadline_at to be populated")
	}

	// 6. Creator cannot re-accept an already accepted order
	_, err = svc.Accept(ctx, creatorActor, created.ID, "")
	if !errors.Is(err, orderservice.ErrInvalidTransition) {
		t.Fatalf("expected ErrInvalidTransition on double accept, got: %v", err)
	}

	// 7. Client submits second brief version
	v2Brief, err := svc.SubmitBrief(ctx, clientActor, created.ID, "Updated brief: Please focus heavily on the custom keycap switches and sound test.")
	if err != nil {
		t.Fatalf("submit brief v2 failed: %v", err)
	}
	if v2Brief.Version != 2 {
		t.Fatalf("expected brief version 2, got %d", v2Brief.Version)
	}

	// 8. Client cancels order
	cancelled, err := svc.Cancel(ctx, clientActor, created.ID, "Client needs to postpone campaign.")
	if err != nil {
		t.Fatalf("cancel order failed: %v", err)
	}
	if cancelled.Status != domain.StatusCancelled || cancelled.CancelledAt == nil {
		t.Fatalf("expected status cancelled, got %s", cancelled.Status)
	}

	// 9. Cannot cancel an already cancelled order
	_, err = svc.Cancel(ctx, clientActor, created.ID, "")
	if !errors.Is(err, orderservice.ErrInvalidTransition) {
		t.Fatalf("expected ErrInvalidTransition on re-cancel, got: %v", err)
	}
}

func insertUser(t *testing.T, ctx context.Context, pool *pgxpool.Pool, email, name, roleCode string) string {
	t.Helper()
	var userID string
	err := pool.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO users (email, password_hash, display_name, preferred_locale, status, email_verified_at)
			VALUES ($1, 'dummy_hash', $2, 'id', 'active', now())
			RETURNING id
		), assigned AS (
			INSERT INTO user_roles (user_id, role_id)
			SELECT inserted.id, roles.id FROM inserted CROSS JOIN roles WHERE roles.code = $3
			RETURNING user_id
		)
		SELECT user_id FROM assigned
	`, email, name, roleCode).Scan(&userID)
	if err != nil {
		t.Fatalf("insert user %s: %v", email, err)
	}
	return userID
}

func insertCreator(t *testing.T, ctx context.Context, pool *pgxpool.Pool, email, slug, status string) string {
	t.Helper()
	var userID string
	err := pool.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO users (email, password_hash, display_name, preferred_locale, status, email_verified_at)
			VALUES ($1, 'dummy_hash', 'Creator Talent', 'id', 'active', now())
			RETURNING id
		), assigned AS (
			INSERT INTO user_roles (user_id, role_id)
			SELECT inserted.id, roles.id FROM inserted CROSS JOIN roles WHERE roles.code = 'creator'
			RETURNING user_id
		), profile AS (
			INSERT INTO creator_profiles (user_id, slug, headline, bio, city, country_code, verification_status, reviewed_at)
			SELECT user_id, $2, 'Tech Creator', 'Top quality tech hardware content creator.', 'Jakarta', 'ID', $3, now()
			FROM assigned
			RETURNING user_id
		)
		SELECT user_id FROM profile
	`, email, slug, status).Scan(&userID)
	if err != nil {
		t.Fatalf("insert creator %s: %v", email, err)
	}
	return userID
}

func insertPublishedService(t *testing.T, ctx context.Context, pool *pgxpool.Pool, creatorUserID, slug, pkgName string, priceMinor int64, currency string, deliveryDays, revisionLimit int) (string, string) {
	t.Helper()
	var serviceID string
	err := pool.QueryRow(ctx, `
		INSERT INTO creator_services (creator_user_id, slug, title, description, status, published_at)
		VALUES ($1, $2, 'Professional Video Service', 'High quality video production for modern brands.', 'published', now())
		RETURNING id
	`, creatorUserID, slug).Scan(&serviceID)
	if err != nil {
		t.Fatalf("insert service: %v", err)
	}

	var packageID string
	err = pool.QueryRow(ctx, `
		INSERT INTO service_packages (service_id, name, description, price_minor, currency, delivery_days, revision_limit, sort_order)
		VALUES ($1, $2, 'Package details description.', $3, $4, $5, $6, 0)
		RETURNING id
	`, serviceID, pkgName, priceMinor, currency, deliveryDays, revisionLimit).Scan(&packageID)
	if err != nil {
		t.Fatalf("insert service package: %v", err)
	}

	return serviceID, packageID
}
