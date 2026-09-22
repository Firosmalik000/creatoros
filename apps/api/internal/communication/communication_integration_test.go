package communication_test

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/creatoros/platform/apps/api/internal/communication/domain"
	"github.com/creatoros/platform/apps/api/internal/communication/repository"
	communicationservice "github.com/creatoros/platform/apps/api/internal/communication/service"
	"github.com/creatoros/platform/apps/api/internal/platform/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestCommunicationFullLifecycle(t *testing.T) {
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
	if _, err := lock.Exec(ctx, "SELECT pg_advisory_lock($1)", int64(772003)); err != nil {
		lock.Release()
		t.Fatalf("lock integration database: %v", err)
	}
	defer func() {
		_, _ = lock.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", int64(772003))
		lock.Release()
	}()

	if _, err := pool.Exec(ctx, "TRUNCATE users, email_outbox CASCADE"); err != nil {
		t.Fatalf("truncate users: %v", err)
	}
	defer func() {
		_, _ = pool.Exec(context.Background(), "TRUNCATE users, email_outbox CASCADE")
	}()

	clientID := insertCommUser(t, ctx, pool, "comm-client@example.test", "Comm Client", "client")
	creatorID := insertCommCreator(t, ctx, pool, "comm-creator@example.test", "comm-creator-slug")
	outsiderID := insertCommUser(t, ctx, pool, "comm-outsider@example.test", "Comm Outsider", "client")
	adminID := insertCommUser(t, ctx, pool, "comm-admin@example.test", "Comm Admin", "admin")

	orderID := insertCommOrder(t, ctx, pool, clientID, creatorID)

	repo := repository.NewPostgresRepository(pool)
	service := communicationservice.New(repo)

	clientActor := domain.Actor{
		UserID:      clientID,
		Roles:       []string{"client"},
		Permissions: []string{"messages.view", "messages.send", "notifications.view", "notifications.manage"},
	}
	creatorActor := domain.Actor{
		UserID:      creatorID,
		Roles:       []string{"creator"},
		Permissions: []string{"messages.view", "messages.send", "notifications.view", "notifications.manage"},
	}
	outsiderActor := domain.Actor{
		UserID:      outsiderID,
		Roles:       []string{"client"},
		Permissions: []string{"messages.view", "messages.send", "notifications.view", "notifications.manage"},
	}
	adminActor := domain.Actor{
		UserID:      adminID,
		Roles:       []string{"agency_admin"},
		Permissions: []string{"messages.view", "messages.send", "notifications.view", "notifications.manage"},
	}

	// 1. GetOrderThread by client: initializes thread
	thread, err := service.GetOrderThread(ctx, clientActor, orderID)
	if err != nil {
		t.Fatalf("get order thread by client: %v", err)
	}
	if thread.ID == "" {
		t.Fatal("expected non-empty thread id")
	}
	if len(thread.Participants) != 2 {
		t.Fatalf("expected 2 participants, got %d", len(thread.Participants))
	}

	// 2. GetOrderThread by outsider: forbidden
	_, err = service.GetOrderThread(ctx, outsiderActor, orderID)
	if !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("expected ErrForbidden for outsider, got %v", err)
	}

	// 3. SendMessage by client
	msg1, err := service.SendMessage(ctx, clientActor, thread.ID, domain.SendMessageInput{
		Body: "Hello creator, excited to work together on this shoot!",
	})
	if err != nil {
		t.Fatalf("send message by client: %v", err)
	}
	if msg1.ID == "" || msg1.SenderUserID != clientID {
		t.Fatalf("unexpected message result: %+v", msg1)
	}

	// 4. Verify creator received in-app notification
	creatorUnreadCount, err := service.GetUnreadCount(ctx, creatorActor)
	if err != nil {
		t.Fatalf("get creator unread count: %v", err)
	}
	if creatorUnreadCount != 1 {
		t.Fatalf("expected 1 unread notification for creator, got %d", creatorUnreadCount)
	}

	// 5. Verify email outbox enqueued
	var outboxCount int
	err = pool.QueryRow(ctx, "SELECT count(*) FROM email_outbox WHERE recipient = 'comm-creator@example.test'").Scan(&outboxCount)
	if err != nil {
		t.Fatalf("query email outbox: %v", err)
	}
	if outboxCount != 1 {
		t.Fatalf("expected 1 enqueued email for creator, got %d", outboxCount)
	}

	// 6. SendMessage by creator
	msg2, err := service.SendMessage(ctx, creatorActor, thread.ID, domain.SendMessageInput{
		Body: "Thank you! I will prepare the shot list tonight.",
	})
	if err != nil {
		t.Fatalf("send message by creator: %v", err)
	}
	if msg2.ID == "" || msg2.SenderUserID != creatorID {
		t.Fatalf("unexpected message result: %+v", msg2)
	}

	// 7. ListThreadMessages: verify 2 messages in order
	messages, err := service.ListThreadMessages(ctx, clientActor, thread.ID, nil, 10)
	if err != nil {
		t.Fatalf("list messages by client: %v", err)
	}
	if len(messages) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(messages))
	}
	if messages[0].ID != msg1.ID || messages[1].ID != msg2.ID {
		t.Fatalf("messages order incorrect: %+v", messages)
	}

	// 8. Validation: empty message rejected
	_, err = service.SendMessage(ctx, clientActor, thread.ID, domain.SendMessageInput{Body: "   "})
	if !errors.Is(err, domain.ErrEmptyMessage) {
		t.Fatalf("expected ErrEmptyMessage for blank body, got %v", err)
	}

	// 9. Outsider cannot send message to thread
	_, err = service.SendMessage(ctx, outsiderActor, thread.ID, domain.SendMessageInput{Body: "I am trespassing"})
	if !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("expected ErrForbidden for outsider send, got %v", err)
	}

	// 10. Mark notification read for creator
	notifs, total, err := service.ListNotifications(ctx, creatorActor, true, 10, 0)
	if err != nil {
		t.Fatalf("list notifications for creator: %v", err)
	}
	if total != 1 || len(notifs) != 1 {
		t.Fatalf("expected 1 unread notification, got total=%d len=%d", total, len(notifs))
	}

	err = service.MarkNotificationRead(ctx, creatorActor, notifs[0].ID)
	if err != nil {
		t.Fatalf("mark notification read: %v", err)
	}

	creatorUnreadAfter, err := service.GetUnreadCount(ctx, creatorActor)
	if err != nil {
		t.Fatalf("get creator unread count after read: %v", err)
	}
	if creatorUnreadAfter != 0 {
		t.Fatalf("expected 0 unread notifications, got %d", creatorUnreadAfter)
	}

	// 11. Notification Preferences: toggle email off
	prefs, err := service.GetNotificationPreferences(ctx, creatorActor)
	if err != nil {
		t.Fatalf("get preferences: %v", err)
	}
	if !prefs.EmailNotifications {
		t.Fatal("expected default email_notifications to be true")
	}

	emailOff := false
	updatedPrefs, err := service.UpdateNotificationPreferences(ctx, creatorActor, domain.UpdatePreferencesInput{
		EmailNotifications: &emailOff,
	})
	if err != nil {
		t.Fatalf("update preferences: %v", err)
	}
	if updatedPrefs.EmailNotifications {
		t.Fatal("expected email_notifications to be false after update")
	}

	// Client sends another message
	_, err = service.SendMessage(ctx, clientActor, thread.ID, domain.SendMessageInput{
		Body: "Let's check the lighting schedule.",
	})
	if err != nil {
		t.Fatalf("send 3rd message: %v", err)
	}

	// Verify email outbox count did NOT increase for creator
	var outboxCountAfter int
	err = pool.QueryRow(ctx, "SELECT count(*) FROM email_outbox WHERE recipient = 'comm-creator@example.test'").Scan(&outboxCountAfter)
	if err != nil {
		t.Fatalf("query email outbox count after: %v", err)
	}
	if outboxCountAfter != 1 {
		t.Fatalf("expected outbox count to remain 1 when email_notifications is false, got %d", outboxCountAfter)
	}

	// 12. Mark all read
	err = service.MarkAllNotificationsRead(ctx, creatorActor)
	if err != nil {
		t.Fatalf("mark all notifications read: %v", err)
	}

	// 13. Admin can participate in thread
	adminMsg, err := service.SendMessage(ctx, adminActor, thread.ID, domain.SendMessageInput{
		Body: "Agency support here: all deliverables are on track.",
	})
	if err != nil {
		t.Fatalf("admin send message: %v", err)
	}
	if adminMsg.ID == "" {
		t.Fatal("expected valid admin message")
	}
}

func insertCommUser(t *testing.T, ctx context.Context, pool *pgxpool.Pool, email, displayName, roleCode string) string {
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
	`, email, displayName, roleCode).Scan(&userID)
	if err != nil {
		t.Fatalf("insert user %s: %v", email, err)
	}

	return userID
}

func insertCommCreator(t *testing.T, ctx context.Context, pool *pgxpool.Pool, email, slug string) string {
	t.Helper()
	var userID string
	err := pool.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO users (email, password_hash, display_name, preferred_locale, status, email_verified_at)
			VALUES ($1, 'dummy_hash', 'Comm Creator', 'id', 'active', now())
			RETURNING id
		), assigned AS (
			INSERT INTO user_roles (user_id, role_id)
			SELECT inserted.id, roles.id FROM inserted CROSS JOIN roles WHERE roles.code = 'creator'
			RETURNING user_id
		), profile AS (
			INSERT INTO creator_profiles (user_id, slug, headline, bio, city, country_code, verification_status, reviewed_at)
			SELECT user_id, $2, 'Comm Test Creator', 'Testing communication flows end-to-end.', 'Jakarta', 'ID', 'verified', now()
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

func insertCommOrder(t *testing.T, ctx context.Context, pool *pgxpool.Pool, clientID, creatorID string) string {
	t.Helper()

	var serviceID string
	err := pool.QueryRow(ctx, `
		INSERT INTO creator_services (creator_user_id, slug, title, description, status, published_at)
		VALUES ($1, 'comm-test-service', 'Comm Test Service', 'This is a complete service description exceeding twenty characters.', 'published', now())
		RETURNING id
	`, creatorID).Scan(&serviceID)
	if err != nil {
		t.Fatalf("insert creator service: %v", err)
	}

	var packageID string
	err = pool.QueryRow(ctx, `
		INSERT INTO service_packages (service_id, name, description, price_minor, currency, delivery_days, revision_limit, sort_order)
		VALUES ($1, 'Standard Package', 'Package Description', 1000000, 'IDR', 7, 2, 1)
		RETURNING id
	`, serviceID).Scan(&packageID)
	if err != nil {
		t.Fatalf("insert service package: %v", err)
	}

	var orderID string
	err = pool.QueryRow(ctx, `
		INSERT INTO orders (
			client_user_id, creator_user_id, service_id, package_id,
			package_name, package_description, price_minor, currency,
			delivery_days, revision_limit, brief_content, status,
			accepted_at, deadline_at
		) VALUES (
			$1, $2, $3, $4,
			'Standard Package', 'Package Description', 1000000, 'IDR',
			7, 2, 'Initial brief for communication test', 'accepted',
			now(), now() + interval '7 days'
		)
		RETURNING id
	`, clientID, creatorID, serviceID, packageID).Scan(&orderID)
	if err != nil {
		t.Fatalf("insert order: %v", err)
	}

	return orderID
}
