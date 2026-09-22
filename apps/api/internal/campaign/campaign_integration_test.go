package campaign_test

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/creatoros/platform/apps/api/internal/campaign/domain"
	"github.com/creatoros/platform/apps/api/internal/campaign/repository"
	campaignservice "github.com/creatoros/platform/apps/api/internal/campaign/service"
	"github.com/creatoros/platform/apps/api/internal/platform/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestCampaignFullLifecycle(t *testing.T) {
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

	clientID := insertUser(t, ctx, pool, "camp-client@example.test", "Client Brand", "client")
	creatorID := insertCreator(t, ctx, pool, "camp-creator@example.test", "camp-creator-slug", "verified")

	// Get an existing platform and category for requirements
	var platformID, categoryID string
	_ = pool.QueryRow(ctx, "SELECT id FROM platforms LIMIT 1").Scan(&platformID)
	_ = pool.QueryRow(ctx, "SELECT id FROM categories LIMIT 1").Scan(&categoryID)

	// Link creator to category & platform
	if categoryID != "" {
		_, _ = pool.Exec(ctx, "INSERT INTO creator_categories (creator_user_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", creatorID, categoryID)
	}
	if platformID != "" {
		_, _ = pool.Exec(ctx, `
			INSERT INTO creator_social_accounts (creator_user_id, platform_id, handle, profile_url, follower_count, average_views, engagement_bps)
			VALUES ($1, $2, 'creator_social', 'https://instagram.com/creator_social', 50000, 10000, 350)
			ON CONFLICT DO NOTHING
		`, creatorID, platformID)
	}

	clientActor := domain.Actor{
		UserID:      clientID,
		Roles:       []string{"client"},
		Permissions: []string{"campaigns.create", "campaigns.manage"},
	}

	creatorActor := domain.Actor{
		UserID:      creatorID,
		Roles:       []string{"creator"},
		Permissions: []string{"campaigns.respond"},
	}

	repo := repository.NewPostgresRepository(pool)
	service := campaignservice.NewService(repo)

	// 1. Create draft campaign with requirements
	var catPtr *string
	if categoryID != "" {
		catPtr = &categoryID
	}
	var platPtr *string
	if platformID != "" {
		platPtr = &platformID
	}

	detail, err := service.CreateCampaign(ctx, clientActor, domain.CreateCampaignInput{
		Title:               "Summer Brand Launch 2026",
		Description:         "Looking for creative tech and lifestyle creators to produce high-impact short-form videos.",
		Objective:           domain.ObjectiveBrandAwareness,
		BudgetMinor:         10000000,
		Currency:            "IDR",
		TargetCreatorsCount: 2,
		DeadlineAt:          time.Now().Add(14 * 24 * time.Hour),
		Requirements: domain.RequirementsInput{
			CategoryID:        catPtr,
			PlatformID:        platPtr,
			MinFollowers:      10000,
			MinEngagementBps:  200,
			DeliverableFormat: domain.FormatVideo,
		},
	})
	if err != nil {
		t.Fatalf("create campaign: %v", err)
	}
	if detail.Campaign.Status != domain.StatusDraft {
		t.Fatalf("expected status draft, got %s", detail.Campaign.Status)
	}

	// 2. Discover matching creators
	matches, err := service.FindMatchedCreators(ctx, clientActor, detail.Campaign.ID)
	if err != nil {
		t.Fatalf("find matched creators: %v", err)
	}
	if len(matches) == 0 {
		t.Fatalf("expected at least 1 matched creator, got 0")
	}
	if matches[0].UserID != creatorID {
		t.Fatalf("expected matched creator ID %s, got %s", creatorID, matches[0].UserID)
	}

	// 3. Publishing campaign: draft -> active
	published, err := service.PublishCampaign(ctx, clientActor, detail.Campaign.ID, "Brand launched campaign")
	if err != nil {
		t.Fatalf("publish campaign: %v", err)
	}
	if published.Status != domain.StatusActive {
		t.Fatalf("expected active status, got %s", published.Status)
	}

	// 4. Invite creator
	inv, err := service.InviteCreator(ctx, clientActor, detail.Campaign.ID, domain.InviteCreatorInput{
		CreatorUserID:   creatorID,
		OfferedFeeMinor: 4500000,
		Currency:        "IDR",
	})
	if err != nil {
		t.Fatalf("invite creator: %v", err)
	}
	if inv.Status != domain.InvitationInvited {
		t.Fatalf("expected invited status, got %s", inv.Status)
	}

	// 4b. Self-invite should fail
	_, err = service.InviteCreator(ctx, clientActor, detail.Campaign.ID, domain.InviteCreatorInput{
		CreatorUserID:   clientID,
		OfferedFeeMinor: 1000000,
		Currency:        "IDR",
	})
	if !errors.Is(err, domain.ErrSelfInviteForbidden) {
		t.Fatalf("expected ErrSelfInviteForbidden, got %v", err)
	}

	// 4c. Duplicate invite should fail
	_, err = service.InviteCreator(ctx, clientActor, detail.Campaign.ID, domain.InviteCreatorInput{
		CreatorUserID:   creatorID,
		OfferedFeeMinor: 4500000,
		Currency:        "IDR",
	})
	if !errors.Is(err, domain.ErrDuplicateInvitation) {
		t.Fatalf("expected ErrDuplicateInvitation, got %v", err)
	}

	// 5. Creator views invitations inbox
	creatorInvs, err := service.ListCreatorInvitations(ctx, creatorActor)
	if err != nil {
		t.Fatalf("list creator invitations: %v", err)
	}
	if len(creatorInvs) != 1 {
		t.Fatalf("expected 1 invitation in creator inbox, got %d", len(creatorInvs))
	}
	if creatorInvs[0].ID != inv.ID {
		t.Fatalf("expected invitation ID %s, got %s", inv.ID, creatorInvs[0].ID)
	}

	// 6. Creator accepts invitation with pitch note
	acceptedInv, err := service.RespondInvitation(ctx, creatorActor, inv.ID, domain.RespondInvitationInput{
		Status:    domain.InvitationAccepted,
		PitchNote: "I have great ideas for a 60-second viral reel on tech lifestyle! Let's do this.",
	})
	if err != nil {
		t.Fatalf("accept invitation: %v", err)
	}
	if acceptedInv.Status != domain.InvitationAccepted {
		t.Fatalf("expected accepted status, got %s", acceptedInv.Status)
	}

	// 7. Client selects accepted creator
	selectedInv, err := service.SelectCreator(ctx, clientActor, detail.Campaign.ID, inv.ID, "Selected based on strong pitch and portfolio")
	if err != nil {
		t.Fatalf("select creator: %v", err)
	}
	if selectedInv.Status != domain.InvitationSelected {
		t.Fatalf("expected selected status, got %s", selectedInv.Status)
	}

	// 8. Client completes campaign
	completed, err := service.CompleteCampaign(ctx, clientActor, detail.Campaign.ID, "All campaign deliverables completed successfully")
	if err != nil {
		t.Fatalf("complete campaign: %v", err)
	}
	if completed.Status != domain.StatusCompleted {
		t.Fatalf("expected completed status, got %s", completed.Status)
	}

	// 9. Verify detail has events and invitations
	finalDetail, err := service.GetCampaign(ctx, clientActor, detail.Campaign.ID)
	if err != nil {
		t.Fatalf("get final campaign detail: %v", err)
	}
	if len(finalDetail.Invitations) != 1 {
		t.Fatalf("expected 1 invitation, got %d", len(finalDetail.Invitations))
	}
	if len(finalDetail.Events) < 3 {
		t.Fatalf("expected at least 3 audit events, got %d", len(finalDetail.Events))
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
