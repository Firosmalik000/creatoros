package workflow_test

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/creatoros/platform/apps/api/internal/platform/database"
	"github.com/creatoros/platform/apps/api/internal/workflow/domain"
	"github.com/creatoros/platform/apps/api/internal/workflow/repository"
	workflowservice "github.com/creatoros/platform/apps/api/internal/workflow/service"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestWorkflowFullLifecycle(t *testing.T) {
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

	clientID := insertUser(t, ctx, pool, "wf-client@example.test", "Client User", "client")
	creatorID := insertCreator(t, ctx, pool, "wf-creator@example.test", "wf-creator-slug", "verified")

	// Create accepted order with revision_limit = 1
	orderID := insertAcceptedOrder(t, ctx, pool, clientID, creatorID, 1)

	clientActor := domain.Actor{
		UserID:      clientID,
		Roles:       []string{"client"},
		Permissions: []string{"content.review", "orders.create"},
	}
	creatorActor := domain.Actor{
		UserID:      creatorID,
		Roles:       []string{"creator"},
		Permissions: []string{"content.submit", "orders.manage"},
	}

	svc := workflowservice.New(repository.NewPostgres(pool), t.TempDir())

	// 1. Creator submits v1 deliverable
	v1Input := domain.SubmitInput{
		Title: "First Cut Video Deliverables",
		Notes: "Includes 4K master file and vertical short cut.",
		Files: []domain.FileInput{
			{FilePath: "cut-1.mp4", FileName: "main_cut_v1.mp4", MimeType: "video/mp4", SizeBytes: 15_000_000},
			{FilePath: "cover-1.jpg", FileName: "thumbnail.jpg", MimeType: "image/jpeg", SizeBytes: 500_000},
		},
	}
	sub1, err := svc.Submit(ctx, creatorActor, orderID, v1Input)
	if err != nil {
		t.Fatalf("submit v1 failed: %v", err)
	}
	if sub1.Version != 1 || sub1.Status != domain.SubmissionStatusSubmitted || len(sub1.Files) != 2 {
		t.Fatalf("submission v1 mismatch: %#v", sub1)
	}

	// Verify order transitioned to in_progress
	var orderStatus string
	if err := pool.QueryRow(ctx, "SELECT status FROM orders WHERE id = $1", orderID).Scan(&orderStatus); err != nil || orderStatus != "in_progress" {
		t.Fatalf("expected order in_progress, got %s, err=%v", orderStatus, err)
	}

	// 2. Client queries workflow summary
	wf, err := svc.GetWorkflow(ctx, clientActor, orderID)
	if err != nil {
		t.Fatalf("get workflow failed: %v", err)
	}
	if len(wf.Submissions) != 1 || wf.RevisionLimit != 1 || wf.RevisionsUsed != 0 || wf.RevisionsRemaining != 1 {
		t.Fatalf("workflow summary mismatch: %#v", wf)
	}

	// 3. Client requests revision #1
	rev1, err := svc.RequestRevision(ctx, clientActor, orderID, sub1.ID, "Please adjust color grade and enhance voiceover clarity.")
	if err != nil {
		t.Fatalf("request revision 1 failed: %v", err)
	}
	if rev1.RevisionNumber != 1 {
		t.Fatalf("expected revision #1, got %d", rev1.RevisionNumber)
	}

	// 4. Creator submits resubmission v2
	v2Input := domain.SubmitInput{
		Title: "Second Cut (Color & Audio Revised)",
		Notes: "Voiceover boosted +2dB and warm LUT applied.",
		Files: []domain.FileInput{
			{FilePath: "cut-2.mp4", FileName: "main_cut_v2.mp4", MimeType: "video/mp4", SizeBytes: 15_500_000},
		},
	}
	sub2, err := svc.Submit(ctx, creatorActor, orderID, v2Input)
	if err != nil {
		t.Fatalf("submit v2 failed: %v", err)
	}
	if sub2.Version != 2 || sub2.Status != domain.SubmissionStatusSubmitted {
		t.Fatalf("submission v2 mismatch: %#v", sub2)
	}

	// 5. Client attempts revision #2 (should FAIL because limit was 1)
	_, err = svc.RequestRevision(ctx, clientActor, orderID, sub2.ID, "Another revision request that exceeds limit.")
	if !errors.Is(err, workflowservice.ErrRevisionLimitExceeded) {
		t.Fatalf("expected ErrRevisionLimitExceeded, got: %v", err)
	}

	// 6. Client approves submission v2
	approved, err := svc.Approve(ctx, clientActor, orderID, sub2.ID, "Looks fantastic! Approved for publishing.")
	if err != nil {
		t.Fatalf("approve submission failed: %v", err)
	}
	if approved.Status != domain.SubmissionStatusApproved {
		t.Fatalf("expected approved status, got %s", approved.Status)
	}

	// Verify order status is completed
	if err := pool.QueryRow(ctx, "SELECT status FROM orders WHERE id = $1", orderID).Scan(&orderStatus); err != nil || orderStatus != "completed" {
		t.Fatalf("expected order completed, got %s, err=%v", orderStatus, err)
	}

	// 7. Verify audit event in order_events
	var approvedEventCount int
	err = pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM order_events
		WHERE order_id = $1 AND to_status = 'completed'
	`, orderID).Scan(&approvedEventCount)
	if err != nil || approvedEventCount != 1 {
		t.Fatalf("expected 1 completed event, got %d, err=%v", approvedEventCount, err)
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

func insertAcceptedOrder(t *testing.T, ctx context.Context, pool *pgxpool.Pool, clientID, creatorID string, revisionLimit int) string {
	t.Helper()
	var serviceID string
	err := pool.QueryRow(ctx, `
		INSERT INTO creator_services (creator_user_id, slug, title, description, status, published_at)
		VALUES ($1, 'wf-service', 'Workflow Service', 'Service description for testing workflow.', 'published', now())
		RETURNING id
	`, creatorID).Scan(&serviceID)
	if err != nil {
		t.Fatalf("insert service: %v", err)
	}

	var packageID string
	err = pool.QueryRow(ctx, `
		INSERT INTO service_packages (service_id, name, description, price_minor, currency, delivery_days, revision_limit, sort_order)
		VALUES ($1, 'Standard', 'Package details.', 1500000, 'IDR', 7, $2, 0)
		RETURNING id
	`, serviceID, revisionLimit).Scan(&packageID)
	if err != nil {
		t.Fatalf("insert package: %v", err)
	}

	var orderID string
	err = pool.QueryRow(ctx, `
		INSERT INTO orders (
			client_user_id, creator_user_id, service_id, package_id,
			package_name, package_description, price_minor, currency,
			delivery_days, revision_limit, brief_content, status,
			accepted_at, deadline_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, 'Standard', 'Package details.', 1500000, 'IDR', 7, $5, 'Initial brief notes here for testing.', 'accepted', now(), now() + interval '7 days', now(), now())
		RETURNING id
	`, clientID, creatorID, serviceID, packageID, revisionLimit).Scan(&orderID)
	if err != nil {
		t.Fatalf("insert accepted order: %v", err)
	}

	return orderID
}
