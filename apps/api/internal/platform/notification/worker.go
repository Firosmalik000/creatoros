package notification

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Sender interface {
	Send(context.Context, string, string, string) error
}

type Worker struct {
	pool    *pgxpool.Pool
	factory *Factory
	sender  Sender
	logger  *slog.Logger
}

type outboxItem struct {
	ID         string
	Recipient  string
	Kind       string
	Ciphertext []byte
	Nonce      []byte
	Attempts   int
}

func NewWorker(pool *pgxpool.Pool, factory *Factory, sender Sender, logger *slog.Logger) *Worker {
	return &Worker{pool: pool, factory: factory, sender: sender, logger: logger}
}

func (worker *Worker) Run(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		worker.processBatch(ctx)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (worker *Worker) processBatch(ctx context.Context) {
	if _, err := worker.pool.Exec(ctx, `
		UPDATE email_outbox
		SET discarded_at = now(), locked_at = NULL, payload_ciphertext = ''::bytea,
		    payload_nonce = ''::bytea, last_error = 'expired', updated_at = now()
		WHERE sent_at IS NULL AND discarded_at IS NULL AND expires_at <= now()
	`); err != nil {
		worker.logger.Error("expired email outbox cleanup failed", "error", err)
		return
	}
	for range 10 {
		item, ok, err := worker.claim(ctx)
		if err != nil {
			worker.logger.Error("email outbox claim failed", "error", err)
			return
		}
		if !ok {
			return
		}
		payload, err := worker.factory.Decrypt(item.Ciphertext, item.Nonce)
		if err == nil {
			sendContext, cancel := context.WithTimeout(ctx, 20*time.Second)
			err = worker.sender.Send(sendContext, item.Recipient, payload.Subject, payload.Body)
			cancel()
		}
		if err != nil {
			worker.logger.Error("email outbox delivery failed", "outbox_id", item.ID, "kind", item.Kind, "error", err)
			if markErr := worker.markFailed(ctx, item, err); markErr != nil {
				worker.logger.Error("email outbox retry scheduling failed", "outbox_id", item.ID, "kind", item.Kind, "error", markErr)
			}
			continue
		}
		if _, err := worker.pool.Exec(ctx, `
			UPDATE email_outbox
			SET sent_at = now(), locked_at = NULL, last_error = NULL,
			    payload_ciphertext = ''::bytea, payload_nonce = ''::bytea, updated_at = now()
			WHERE id = $1
		`, item.ID); err != nil {
			worker.logger.Error("email outbox completion failed", "outbox_id", item.ID, "kind", item.Kind, "error", err)
		}
	}
}

func (worker *Worker) claim(ctx context.Context) (outboxItem, bool, error) {
	tx, err := worker.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return outboxItem{}, false, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	var item outboxItem
	err = tx.QueryRow(ctx, `
		SELECT id, recipient, kind, payload_ciphertext, payload_nonce, attempt_count
		FROM email_outbox
		WHERE sent_at IS NULL
		  AND discarded_at IS NULL
		  AND expires_at > now()
		  AND available_at <= now()
		  AND (locked_at IS NULL OR locked_at < now() - interval '5 minutes')
		ORDER BY created_at
		FOR UPDATE SKIP LOCKED
		LIMIT 1
	`).Scan(&item.ID, &item.Recipient, &item.Kind, &item.Ciphertext, &item.Nonce, &item.Attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return outboxItem{}, false, nil
	}
	if err != nil {
		return outboxItem{}, false, err
	}
	if _, err := tx.Exec(ctx, "UPDATE email_outbox SET locked_at = now(), updated_at = now() WHERE id = $1", item.ID); err != nil {
		return outboxItem{}, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return outboxItem{}, false, err
	}
	return item, true, nil
}

func (worker *Worker) markFailed(ctx context.Context, item outboxItem, deliveryError error) error {
	attempts := item.Attempts + 1
	delayMinutes := math.Min(math.Pow(2, float64(attempts-1)), 360)
	_, err := worker.pool.Exec(ctx, `
		UPDATE email_outbox
		SET attempt_count = $2,
		    available_at = now() + ($3 * interval '1 minute'),
		    locked_at = NULL,
		    last_error = $4,
		    updated_at = now()
		WHERE id = $1
	`, item.ID, attempts, delayMinutes, truncateError(deliveryError))
	if err != nil {
		return fmt.Errorf("mark email outbox failed: %w", err)
	}
	return nil
}

func truncateError(err error) string {
	message := err.Error()
	if len(message) > 500 {
		return message[:500]
	}
	return message
}
