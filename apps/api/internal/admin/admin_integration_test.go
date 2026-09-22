package admin_test

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/creatoros/platform/apps/api/internal/admin/domain"
	"github.com/creatoros/platform/apps/api/internal/admin/repository"
	"github.com/creatoros/platform/apps/api/internal/admin/service"
	"github.com/creatoros/platform/apps/api/internal/platform/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestAdminFullLifecycle(t *testing.T) {
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
	if _, err := lock.Exec(ctx, "SELECT pg_advisory_lock($1)", int64(772004)); err != nil {
		lock.Release()
		t.Fatalf("lock integration database: %v", err)
	}
	defer func() {
		_, _ = lock.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", int64(772004))
		lock.Release()
	}()

	if _, err := pool.Exec(ctx, "TRUNCATE users, email_outbox, audit_logs CASCADE"); err != nil {
		t.Fatalf("truncate users: %v", err)
	}
	_, _ = pool.Exec(ctx, "DELETE FROM categories WHERE slug LIKE 'tech-gadgets%'")
	defer func() {
		_, _ = pool.Exec(context.Background(), "TRUNCATE users, email_outbox, audit_logs CASCADE")
		_, _ = pool.Exec(context.Background(), "DELETE FROM categories WHERE slug LIKE 'tech-gadgets%'")
	}()

	adminID := insertAdminUser(t, ctx, pool, "admin@creatoros.test", "Admin Lead", "admin")
	clientID := insertAdminUser(t, ctx, pool, "client@creatoros.test", "Client Brand", "client")
	creatorID := insertAdminCreator(t, ctx, pool, "creator@creatoros.test", "creator-pro")

	orderID := insertAdminOrder(t, ctx, pool, clientID, creatorID, 1500000)

	repo := repository.NewPostgresRepository(pool)
	svc := service.NewAdminService(repo)

	adminActor := domain.Actor{
		ID:          adminID,
		Email:       "admin@creatoros.test",
		Roles:       []string{"admin"},
		Permissions: []string{"admin.access", "users.manage", "disputes.manage", "finance.manage", "categories.manage", "audit.view"},
		IPAddress:   "127.0.0.1",
	}

	nonAdminActor := domain.Actor{
		ID:          clientID,
		Email:       "client@creatoros.test",
		Roles:       []string{"client"},
		Permissions: []string{},
		IPAddress:   "127.0.0.1",
	}

	// 1. Non-admin access rejected
	_, err = svc.GetOverview(ctx, nonAdminActor)
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized for non-admin, got %v", err)
	}

	// 2. Admin GetOverview
	overview, err := svc.GetOverview(ctx, adminActor)
	if err != nil {
		t.Fatalf("get overview: %v", err)
	}
	if overview.TotalUsers < 3 {
		t.Fatalf("expected at least 3 users, got %d", overview.TotalUsers)
	}
	if overview.TotalOrders != 1 {
		t.Fatalf("expected 1 order, got %d", overview.TotalOrders)
	}

	// 3. ListUsers
	users, totalUsers, err := svc.ListUsers(ctx, adminActor, "all", "all", "", 20, 0)
	if err != nil {
		t.Fatalf("list users: %v", err)
	}
	if totalUsers < 3 || len(users) < 3 {
		t.Fatalf("expected at least 3 users, got %d (total %d)", len(users), totalUsers)
	}

	// Filter by role
	clients, totalClients, err := svc.ListUsers(ctx, adminActor, "client", "all", "", 20, 0)
	if err != nil {
		t.Fatalf("list client users: %v", err)
	}
	if totalClients != 1 || len(clients) != 1 {
		t.Fatalf("expected 1 client user, got %d", totalClients)
	}

	// 4. Disable user
	err = svc.SetUserStatus(ctx, adminActor, clientID, "disabled", "Payment discrepancy under review")
	if err != nil {
		t.Fatalf("set user status: %v", err)
	}
	updatedClient, err := svc.GetUser(ctx, adminActor, clientID)
	if err != nil {
		t.Fatalf("get updated client: %v", err)
	}
	if updatedClient.Status != "disabled" {
		t.Fatalf("expected status 'disabled', got %s", updatedClient.Status)
	}

	// Re-enable user
	err = svc.SetUserStatus(ctx, adminActor, clientID, "active", "Review cleared")
	if err != nil {
		t.Fatalf("re-enable user: %v", err)
	}

	// 5. Update user roles
	err = svc.SetUserRoles(ctx, adminActor, clientID, []string{"client", "agency_admin"})
	if err != nil {
		t.Fatalf("set user roles: %v", err)
	}
	updatedClientWithRoles, err := svc.GetUser(ctx, adminActor, clientID)
	if err != nil {
		t.Fatalf("get client after roles: %v", err)
	}
	hasAgencyAdmin := false
	for _, r := range updatedClientWithRoles.Roles {
		if r == "agency_admin" {
			hasAgencyAdmin = true
		}
	}
	if !hasAgencyAdmin {
		t.Fatalf("expected agency_admin role assigned, got: %v", updatedClientWithRoles.Roles)
	}

	// 6. ListOrders
	orders, totalOrders, err := svc.ListOrders(ctx, adminActor, "all", "", 20, 0)
	if err != nil {
		t.Fatalf("list orders: %v", err)
	}
	if totalOrders != 1 || len(orders) != 1 {
		t.Fatalf("expected 1 order, got %d", totalOrders)
	}

	// 7. Open and Resolve Dispute
	dispute, err := svc.OpenDispute(ctx, adminActor, orderID, "Deliverables do not match contract requirements")
	if err != nil {
		t.Fatalf("open dispute: %v", err)
	}
	if dispute.Status != domain.DisputeOpened {
		t.Fatalf("expected dispute status 'opened', got %s", dispute.Status)
	}

	// List disputes
	disputes, totalDisputes, err := svc.ListDisputes(ctx, adminActor, "opened", 20, 0)
	if err != nil {
		t.Fatalf("list disputes: %v", err)
	}
	if totalDisputes != 1 || len(disputes) != 1 {
		t.Fatalf("expected 1 opened dispute, got %d", totalDisputes)
	}

	// Resolve dispute with refund to client
	err = svc.ResolveDispute(ctx, adminActor, orderID, domain.DisputeResolvedClientRefund, "Mediated: client requested cancel due to missing brief deliverable")
	if err != nil {
		t.Fatalf("resolve dispute: %v", err)
	}

	// Verify dispute is marked resolved
	resolvedDispute, err := repo.GetDisputeByOrderID(ctx, orderID)
	if err != nil {
		t.Fatalf("get resolved dispute: %v", err)
	}
	if resolvedDispute.Status != domain.DisputeResolvedClientRefund {
		t.Fatalf("expected dispute status resolved_client_refund, got %s", resolvedDispute.Status)
	}

	// Verify order status is cancelled
	var orderStatus string
	if err := pool.QueryRow(ctx, `SELECT status FROM orders WHERE id = $1`, orderID).Scan(&orderStatus); err != nil {
		t.Fatalf("query order status: %v", err)
	}
	if orderStatus != "cancelled" {
		t.Fatalf("expected order status 'cancelled', got %s", orderStatus)
	}

	// Verify double-entry refund ledger was posted
	var refundLedgerCount int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM ledger_entries WHERE reference_id = $1 AND reference_type = 'refund'`, orderID).Scan(&refundLedgerCount)
	if refundLedgerCount != 2 {
		t.Fatalf("expected 2 refund ledger entries (debit escrow, credit cash), got %d", refundLedgerCount)
	}

	// 8. Categories CRUD
	cat := &domain.AdminCategory{
		Slug:      "tech-gadgets",
		NameID:    "Teknologi & Gawai",
		NameEN:    "Technology & Gadgets",
		NameMS:    "Teknologi & Gajet",
		SortOrder: 1,
		IsActive:  true,
	}
	if err := svc.CreateCategory(ctx, adminActor, cat); err != nil {
		t.Fatalf("create category: %v", err)
	}
	if cat.ID == "" {
		t.Fatal("expected non-empty category id")
	}

	cat.NameEN = "Technology, AI & Gadgets"
	if err := svc.UpdateCategory(ctx, adminActor, cat); err != nil {
		t.Fatalf("update category: %v", err)
	}

	categories, err := svc.ListCategories(ctx, adminActor)
	if err != nil {
		t.Fatalf("list categories: %v", err)
	}
	var foundCat bool
	for _, c := range categories {
		if c.Slug == "tech-gadgets" && c.NameEN == "Technology, AI & Gadgets" {
			foundCat = true
			break
		}
	}
	if !foundCat {
		t.Fatalf("expected updated category in list, got %+v", categories)
	}

	// 9. Finance Overview
	fin, err := svc.GetFinanceOverview(ctx, adminActor)
	if err != nil {
		t.Fatalf("get finance overview: %v", err)
	}
	if fin.Currency != "IDR" {
		t.Fatalf("expected currency IDR, got %s", fin.Currency)
	}

	// 10. Audit Logs
	logs, totalLogs, err := svc.ListAuditLogs(ctx, adminActor, "all", "all", 50, 0)
	if err != nil {
		t.Fatalf("list audit logs: %v", err)
	}
	if totalLogs < 4 || len(logs) < 4 {
		t.Fatalf("expected at least 4 audit logs recorded, got %d (total %d)", len(logs), totalLogs)
	}

	// Verify specific audit actions exist
	actionsRecorded := make(map[string]bool)
	for _, l := range logs {
		actionsRecorded[l.Action] = true
	}
	expectedActions := []string{"user.status_update", "user.roles_update", "dispute.opened", "dispute.resolved", "category.created", "category.updated"}
	for _, exp := range expectedActions {
		if !actionsRecorded[exp] {
			t.Errorf("missing expected audit log action: %s", exp)
		}
	}

	// 11. Announcements
	ann := &domain.Announcement{
		Title:      "System Maintenance",
		Body:       "Scheduled maintenance on Sunday 02:00 UTC",
		TargetRole: "all",
		IsActive:   true,
	}
	if err := svc.CreateAnnouncement(ctx, adminActor, ann); err != nil {
		t.Fatalf("create announcement: %v", err)
	}
	announcements, err := svc.ListAnnouncements(ctx, adminActor, "all")
	if err != nil {
		t.Fatalf("list announcements: %v", err)
	}
	if len(announcements) == 0 {
		t.Fatal("expected at least 1 announcement")
	}
}

func insertAdminUser(t *testing.T, ctx context.Context, pool *pgxpool.Pool, email, name, roleCode string) string {
	t.Helper()
	var userID string
	query := `
		INSERT INTO users (email, password_hash, display_name, status, preferred_locale, email_verified_at)
		VALUES ($1, 'hash', $2, 'active', 'en', now())
		RETURNING id
	`
	if err := pool.QueryRow(ctx, query, email, name).Scan(&userID); err != nil {
		t.Fatalf("insert user %s: %v", email, err)
	}

	var roleID string
	if err := pool.QueryRow(ctx, `SELECT id FROM roles WHERE code = $1`, roleCode).Scan(&roleID); err != nil {
		t.Fatalf("get role %s: %v", roleCode, err)
	}

	if _, err := pool.Exec(ctx, `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, userID, roleID); err != nil {
		t.Fatalf("assign role to user %s: %v", email, err)
	}

	return userID
}

func insertAdminCreator(t *testing.T, ctx context.Context, pool *pgxpool.Pool, email, slug string) string {
	t.Helper()
	userID := insertAdminUser(t, ctx, pool, email, "Creator "+slug, "creator")

	query := `
		INSERT INTO creator_profiles (
			user_id, slug, headline, bio, city, country_code, verification_status
		)
		VALUES (
			$1, $2, 'Top verified content creator', 'Professional content creator on YouTube and Instagram',
			'Jakarta', 'ID', 'verified'
		)
	`
	if _, err := pool.Exec(ctx, query, userID, slug); err != nil {
		t.Fatalf("insert creator profile: %v", err)
	}

	return userID
}

func insertAdminOrder(t *testing.T, ctx context.Context, pool *pgxpool.Pool, clientID, creatorID string, priceMinor int64) string {
	t.Helper()

	var serviceID string
	err := pool.QueryRow(ctx, `
		INSERT INTO creator_services (creator_user_id, slug, title, description, status, published_at)
		VALUES ($1, 'adm-test-service', 'Admin Test Service', 'This is a complete service description exceeding twenty characters.', 'published', now())
		RETURNING id
	`, creatorID).Scan(&serviceID)
	if err != nil {
		t.Fatalf("insert creator service: %v", err)
	}

	var packageID string
	err = pool.QueryRow(ctx, `
		INSERT INTO service_packages (service_id, name, description, price_minor, currency, delivery_days, revision_limit, sort_order)
		VALUES ($1, 'Standard Package', 'Package Description', $2, 'IDR', 7, 2, 1)
		RETURNING id
	`, serviceID, priceMinor).Scan(&packageID)
	if err != nil {
		t.Fatalf("insert service package: %v", err)
	}

	var orderID string
	query := `
		INSERT INTO orders (
			client_user_id, creator_user_id, service_id, package_id, package_name,
			package_description, price_minor, currency, delivery_days, revision_limit, brief_content, status,
			accepted_at, deadline_at
		)
		VALUES (
			$1, $2, $3, $4, 'Standard Package',
			'Package Description', $5, 'IDR', 7, 2, 'Initial brief for product unboxing video exceeding twenty characters', 'in_progress',
			now(), now() + interval '7 days'
		)
		RETURNING id
	`
	if err := pool.QueryRow(ctx, query, clientID, creatorID, serviceID, packageID, priceMinor).Scan(&orderID); err != nil {
		t.Fatalf("insert order: %v", err)
	}

	// Insert escrow held payment
	var paymentID string
	pQuery := `
		INSERT INTO payments (
			order_id, client_user_id, creator_user_id, amount_minor, currency, status, provider, provider_transaction_id
		)
		VALUES (
			$1, $2, $3, $4, 'IDR', 'escrow_held', 'simulated', 'TX-SIM-001'
		)
		RETURNING id
	`
	if err := pool.QueryRow(ctx, pQuery, orderID, clientID, creatorID, priceMinor).Scan(&paymentID); err != nil {
		t.Fatalf("insert payment: %v", err)
	}

	// Ledger: debit client cash, credit escrow
	_, err = pool.Exec(ctx, `
		INSERT INTO ledger_entries (
			id, transaction_id, reference_type, reference_id,
			account_type, user_id, entry_type, amount_minor, currency, description
		)
		VALUES
			(gen_random_uuid(), $1::uuid, 'order_escrow', $2::uuid, 'client_cash', $3::uuid, 'debit', $4, 'IDR', 'Client payment'),
			(gen_random_uuid(), $1::uuid, 'order_escrow', $2::uuid, 'platform_escrow', NULL, 'credit', $4, 'IDR', 'Platform escrow held')
	`, paymentID, orderID, clientID, priceMinor)
	if err != nil {
		t.Fatalf("insert test ledger entries: %v", err)
	}

	// Creator wallet escrow
	_, _ = pool.Exec(ctx, `
		INSERT INTO creator_wallets (creator_user_id, currency, available_balance_minor, escrow_balance_minor)
		VALUES ($1, 'IDR', 0, $2)
	`, creatorID, priceMinor)

	return orderID
}
