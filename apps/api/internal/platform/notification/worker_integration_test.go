package notification

import (
	"bytes"
	"context"
	"encoding/base64"
	"io"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/creatoros/platform/apps/api/internal/auth/domain"
	"github.com/creatoros/platform/apps/api/internal/platform/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

type recordingSender struct {
	recipients []string
}

func (sender *recordingSender) Send(_ context.Context, recipient, _, _ string) error {
	sender.recipients = append(sender.recipients, recipient)
	return nil
}

func TestWorkerDeliversPendingAndDiscardsExpiredPayloads(t *testing.T) {
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
	lockConnection, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("acquire integration lock connection: %v", err)
	}
	if _, err := lockConnection.Exec(ctx, "SELECT pg_advisory_lock($1)", int64(772001)); err != nil {
		lockConnection.Release()
		t.Fatalf("acquire integration lock: %v", err)
	}
	defer func() {
		_, _ = lockConnection.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", int64(772001))
		lockConnection.Release()
	}()
	if _, err := pool.Exec(ctx, "DELETE FROM email_outbox"); err != nil {
		t.Fatalf("clear email outbox: %v", err)
	}
	factory, err := NewFactory(
		"https://creator.example",
		base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{5}, 32)),
	)
	if err != nil {
		t.Fatalf("create factory: %v", err)
	}
	now := time.Now().UTC()
	pending, err := factory.Verification("pending-worker@example.test", "en", "pending-token", now.Add(time.Hour))
	if err != nil {
		t.Fatalf("create pending message: %v", err)
	}
	expired, err := factory.PasswordReset("expired-worker@example.test", "id", "expired-token", now.Add(-time.Minute))
	if err != nil {
		t.Fatalf("create expired message: %v", err)
	}
	insert := func(message *domain.EmailOutboxMessage, createdAt time.Time) string {
		t.Helper()
		var id string
		err := pool.QueryRow(ctx, `
			INSERT INTO email_outbox (
				recipient, kind, locale, payload_ciphertext, payload_nonce, expires_at, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
			RETURNING id
		`, message.Recipient, message.Kind, message.Locale, message.Ciphertext, message.Nonce, message.ExpiresAt, createdAt).Scan(&id)
		if err != nil {
			t.Fatalf("insert outbox message: %v", err)
		}
		return id
	}
	pendingID := insert(pending, now)
	expiredID := insert(expired, now.Add(-time.Hour))
	defer func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM email_outbox WHERE id = $1 OR id = $2", pendingID, expiredID)
	}()
	sender := &recordingSender{}
	worker := NewWorker(pool, factory, sender, slog.New(slog.NewTextHandler(io.Discard, nil)))
	worker.processBatch(ctx)
	if len(sender.recipients) != 1 || sender.recipients[0] != pending.Recipient {
		t.Fatalf("unexpected deliveries: %#v", sender.recipients)
	}
	assertOutboxTerminalState(t, ctx, pool, pendingID, true)
	assertOutboxTerminalState(t, ctx, pool, expiredID, false)
}

func assertOutboxTerminalState(t *testing.T, ctx context.Context, pool *pgxpool.Pool, id string, sent bool) {
	t.Helper()
	var sentAt, discardedAt *time.Time
	var ciphertext, nonce []byte
	if err := pool.QueryRow(ctx, `
		SELECT sent_at, discarded_at, payload_ciphertext, payload_nonce
		FROM email_outbox WHERE id = $1
	`, id).Scan(&sentAt, &discardedAt, &ciphertext, &nonce); err != nil {
		t.Fatalf("query terminal outbox state: %v", err)
	}
	if sent && sentAt == nil || !sent && discardedAt == nil {
		t.Fatalf("unexpected terminal timestamps: sent=%v sent_at=%v discarded_at=%v", sent, sentAt, discardedAt)
	}
	if len(ciphertext) != 0 || len(nonce) != 0 {
		t.Fatal("terminal outbox payload was not cleared")
	}
}
