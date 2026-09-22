package payment_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/creatoros/platform/apps/api/internal/payment/domain"
	"github.com/creatoros/platform/apps/api/internal/payment/provider"
	"github.com/creatoros/platform/apps/api/internal/payment/repository"
	paymentservice "github.com/creatoros/platform/apps/api/internal/payment/service"
	"github.com/creatoros/platform/apps/api/internal/platform/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPaymentFullLifecycle(t *testing.T) {
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
	if _, err := lock.Exec(ctx, "SELECT pg_advisory_lock($1)", int64(772002)); err != nil {
		lock.Release()
		t.Fatalf("lock integration database: %v", err)
	}
	defer func() {
		_, _ = lock.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", int64(772002))
		lock.Release()
	}()

	if _, err := pool.Exec(ctx, "TRUNCATE users, email_outbox CASCADE"); err != nil {
		t.Fatalf("truncate users: %v", err)
	}
	// Also truncate payment-specific tables that are NOT cascade-deleted with users
	if _, err := pool.Exec(ctx, "TRUNCATE payment_webhook_events"); err != nil {
		t.Fatalf("truncate payment_webhook_events: %v", err)
	}
	defer func() {
		_, _ = pool.Exec(context.Background(), "TRUNCATE users, email_outbox CASCADE")
		_, _ = pool.Exec(context.Background(), "TRUNCATE payment_webhook_events")
	}()

	clientID := insertPaymentUser(t, ctx, pool, "payment-client@example.test", "Payment Client", "client")
	creatorID := insertPaymentCreator(t, ctx, pool, "payment-creator@example.test", "payment-creator-slug")

	// Insert a service + package + order to test payment against
	var platformID string
	_ = pool.QueryRow(ctx, "SELECT id FROM platforms LIMIT 1").Scan(&platformID)

	var serviceID string
	err = pool.QueryRow(ctx, `
		INSERT INTO creator_services (creator_user_id, slug, title, description, status, published_at, created_at, updated_at)
		VALUES ($1, 'payment-test-service', 'Payment Test Service', 'A service for testing payment flows end-to-end.', 'published', now(), now(), now())
		RETURNING id
	`, creatorID).Scan(&serviceID)
	if err != nil {
		t.Fatalf("insert creator service: %v", err)
	}

	var packageID string
	err = pool.QueryRow(ctx, `
		INSERT INTO service_packages (service_id, name, description, price_minor, currency, delivery_days, revision_limit, sort_order, created_at, updated_at)
		VALUES ($1, 'Basic Package', 'Basic test package', 500000, 'IDR', 7, 2, 0, now(), now())
		RETURNING id
	`, serviceID).Scan(&packageID)
	if err != nil {
		t.Fatalf("insert service package: %v", err)
	}

	var orderID string
	err = pool.QueryRow(ctx, `
		INSERT INTO orders (client_user_id, creator_user_id, service_id, package_id, package_name, package_description, price_minor, currency, delivery_days, revision_limit, brief_content, status, accepted_at, deadline_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'Basic Package', 'Basic test package', 500000, 'IDR', 7, 2, 'Please create a post about my product with all necessary details and context.', 'accepted', now(), now() + interval '7 days', now(), now())
		RETURNING id
	`, clientID, creatorID, serviceID, packageID).Scan(&orderID)
	if err != nil {
		t.Fatalf("insert order: %v", err)
	}

	repo := repository.NewPostgresRepository(pool)
	prov := provider.NewSimulatedProvider("")
	svc := paymentservice.New(repo, prov)

	clientActor := domain.Actor{
		UserID:      clientID,
		Roles:       []string{"client"},
		Permissions: []string{"payments.pay", "payments.view"},
	}
	creatorActor := domain.Actor{
		UserID:      creatorID,
		Roles:       []string{"creator"},
		Permissions: []string{"payments.view", "payouts.request"},
	}
	adminActor := domain.Actor{
		UserID:      clientID, // reuse for simplicity
		Roles:       []string{"agency_admin"},
		Permissions: []string{"payments.pay", "payments.view", "payouts.request", "payouts.manage"},
	}

	// 1. Pay for order
	payment, err := svc.PayOrder(ctx, clientActor, orderID, domain.PayOrderInput{PaymentMethod: "simulated"})
	if err != nil {
		t.Fatalf("pay order: %v", err)
	}
	if payment.Status != domain.PaymentEscrowHeld {
		t.Fatalf("expected escrow_held, got %s", payment.Status)
	}
	if payment.AmountMinor != 500000 {
		t.Fatalf("expected 500000 minor units, got %d", payment.AmountMinor)
	}

	// 2. Duplicate payment should fail
	_, err = svc.PayOrder(ctx, clientActor, orderID, domain.PayOrderInput{PaymentMethod: "simulated"})
	if err == nil {
		t.Fatal("expected ErrAlreadyPaid for duplicate payment")
	}

	// 3. Get payment by order ID
	fetched, err := svc.GetOrderPayment(ctx, clientActor, orderID)
	if err != nil {
		t.Fatalf("get order payment: %v", err)
	}
	if fetched.ID != payment.ID {
		t.Fatalf("payment ID mismatch: %s vs %s", fetched.ID, payment.ID)
	}

	// 4. Creator cannot release escrow (only client can)
	_, err = svc.ReleaseOrderEscrow(ctx, creatorActor, orderID)
	if err == nil {
		t.Fatal("expected ErrForbidden for creator releasing escrow")
	}

	// 5. Client releases escrow (simulates order approval)
	released, err := svc.ReleaseOrderEscrow(ctx, clientActor, orderID)
	if err != nil {
		t.Fatalf("release order escrow: %v", err)
	}
	if released.Status != domain.PaymentReleased {
		t.Fatalf("expected released, got %s", released.Status)
	}

	// 6. Creator checks wallet — should have 85% available
	wallet, ledger, err := svc.GetCreatorWallet(ctx, creatorActor)
	if err != nil {
		t.Fatalf("get creator wallet: %v", err)
	}
	expectedCreatorAmount := int64(500000 * 8500 / 10000) // 85%
	if wallet.AvailableBalanceMinor != expectedCreatorAmount {
		t.Fatalf("expected creator available balance %d, got %d", expectedCreatorAmount, wallet.AvailableBalanceMinor)
	}
	if len(ledger) == 0 {
		t.Fatal("expected at least one ledger entry for creator")
	}

	// 7. Creator saves payout method
	method, err := svc.SavePayoutMethod(ctx, creatorActor, domain.SavePayoutMethodInput{
		PayoutType:        "bank_transfer",
		BankName:          "BCA",
		AccountNumber:     "1234567890",
		AccountHolderName: "Creator Test",
	})
	if err != nil {
		t.Fatalf("save payout method: %v", err)
	}
	if !method.IsDefault {
		t.Fatal("expected new payout method to be default")
	}

	// 8. Creator requests payout (minimum check: IDR 100,000)
	payoutInput := domain.RequestPayoutInput{
		AmountMinor:    400000,
		Currency:       "IDR",
		PayoutMethodID: &method.ID,
	}
	payout, err := svc.RequestPayout(ctx, creatorActor, payoutInput)
	if err != nil {
		t.Fatalf("request payout: %v", err)
	}
	if payout.Status != domain.PayoutPending {
		t.Fatalf("expected pending payout, got %s", payout.Status)
	}

	// 9. Below-minimum payout should fail
	_, err = svc.RequestPayout(ctx, creatorActor, domain.RequestPayoutInput{
		AmountMinor: 50000, // Below IDR 100,000 minimum
		Currency:    "IDR",
	})
	if err == nil {
		t.Fatal("expected ErrMinimumPayoutAmount for below-minimum payout")
	}

	// 10. List payouts for creator
	payouts, err := svc.ListCreatorPayouts(ctx, creatorActor)
	if err != nil {
		t.Fatalf("list creator payouts: %v", err)
	}
	if len(payouts) != 1 {
		t.Fatalf("expected 1 payout, got %d", len(payouts))
	}

	// 11. Admin approves payout
	processedPayout, err := svc.ProcessPayout(ctx, adminActor, payout.ID, domain.ProcessPayoutInput{
		Action: "approve",
		Note:   "Approved after verifying bank details.",
	})
	if err != nil {
		t.Fatalf("process payout: %v", err)
	}
	if processedPayout.Status != domain.PayoutCompleted {
		t.Fatalf("expected completed payout, got %s", processedPayout.Status)
	}

	// 12. Verify wallet total_withdrawn_minor updated
	finalWallet, _, err := svc.GetCreatorWallet(ctx, creatorActor)
	if err != nil {
		t.Fatalf("get final creator wallet: %v", err)
	}
	if finalWallet.TotalWithdrawnMinor != 400000 {
		t.Fatalf("expected total_withdrawn_minor=400000, got %d", finalWallet.TotalWithdrawnMinor)
	}

	// 13. Webhook: invalid signature rejected
	err = svc.HandleWebhook(ctx, "simulated", "bad_signature", []byte(`{"event_id":"evt1","event_type":"test"}`))
	if err == nil {
		t.Fatal("expected error for invalid webhook signature")
	}

	// 14. Webhook: valid signature accepted and idempotent
	payload := []byte(`{"event_id":"evt-unique-001","event_type":"payment.confirmed"}`)
	sig := prov.GenerateSignature(payload)
	err = svc.HandleWebhook(ctx, "simulated", sig, payload)
	if err != nil {
		t.Fatalf("handle valid webhook: %v", err)
	}
	// Duplicate webhook
	err = svc.HandleWebhook(ctx, "simulated", sig, payload)
	if err == nil {
		t.Fatal("expected ErrDuplicateWebhook for duplicate event")
	}
}

func insertPaymentUser(t *testing.T, ctx context.Context, pool *pgxpool.Pool, email, name, roleCode string) string {
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

func insertPaymentCreator(t *testing.T, ctx context.Context, pool *pgxpool.Pool, email, slug string) string {
	t.Helper()
	var userID string
	err := pool.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO users (email, password_hash, display_name, preferred_locale, status, email_verified_at)
			VALUES ($1, 'dummy_hash', 'Payment Creator', 'id', 'active', now())
			RETURNING id
		), assigned AS (
			INSERT INTO user_roles (user_id, role_id)
			SELECT inserted.id, roles.id FROM inserted CROSS JOIN roles WHERE roles.code = 'creator'
			RETURNING user_id
		), profile AS (
			INSERT INTO creator_profiles (user_id, slug, headline, bio, city, country_code, verification_status, reviewed_at)
			SELECT user_id, $2, 'Payment Test Creator', 'Testing payment flows end-to-end.', 'Jakarta', 'ID', 'verified', now()
			FROM assigned
			RETURNING user_id
		)
		SELECT user_id FROM profile
	`, email, slug).Scan(&userID)
	if err != nil {
		t.Fatalf("insert creator %s: %v", email, err)
	}
	return userID
}
