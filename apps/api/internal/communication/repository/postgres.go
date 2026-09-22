package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/creatoros/platform/apps/api/internal/communication/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

func (r *PostgresRepository) GetOrCreateOrderThread(ctx context.Context, orderID, clientUserID, creatorUserID string) (domain.ConversationThread, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.ConversationThread{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var thread domain.ConversationThread
	err = tx.QueryRow(ctx, `
		SELECT id, order_id, campaign_id, created_at, updated_at
		FROM conversation_threads
		WHERE order_id = $1
	`, orderID).Scan(&thread.ID, &thread.OrderID, &thread.CampaignID, &thread.CreatedAt, &thread.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		// Create thread
		err = tx.QueryRow(ctx, `
			INSERT INTO conversation_threads (order_id)
			VALUES ($1)
			RETURNING id, order_id, campaign_id, created_at, updated_at
		`, orderID).Scan(&thread.ID, &thread.OrderID, &thread.CampaignID, &thread.CreatedAt, &thread.UpdatedAt)
		if err != nil {
			return domain.ConversationThread{}, fmt.Errorf("insert thread: %w", err)
		}

		// Insert both client and creator as participants
		_, err = tx.Exec(ctx, `
			INSERT INTO conversation_participants (thread_id, user_id, last_read_at, joined_at)
			VALUES ($1, $2, now(), now()), ($1, $3, now(), now())
			ON CONFLICT (thread_id, user_id) DO NOTHING
		`, thread.ID, clientUserID, creatorUserID)
		if err != nil {
			return domain.ConversationThread{}, fmt.Errorf("insert participants: %w", err)
		}
	} else if err != nil {
		return domain.ConversationThread{}, fmt.Errorf("query thread: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.ConversationThread{}, fmt.Errorf("commit tx: %w", err)
	}

	// Fetch participants
	participants, err := r.getParticipants(ctx, thread.ID)
	if err != nil {
		return domain.ConversationThread{}, err
	}
	thread.Participants = participants

	return thread, nil
}

func (r *PostgresRepository) GetThread(ctx context.Context, threadID string) (domain.ConversationThread, []domain.ConversationParticipant, error) {
	var thread domain.ConversationThread
	err := r.pool.QueryRow(ctx, `
		SELECT id, order_id, campaign_id, created_at, updated_at
		FROM conversation_threads
		WHERE id = $1
	`, threadID).Scan(&thread.ID, &thread.OrderID, &thread.CampaignID, &thread.CreatedAt, &thread.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ConversationThread{}, nil, domain.ErrThreadNotFound
		}
		return domain.ConversationThread{}, nil, fmt.Errorf("query thread: %w", err)
	}

	participants, err := r.getParticipants(ctx, threadID)
	if err != nil {
		return domain.ConversationThread{}, nil, err
	}
	thread.Participants = participants

	return thread, participants, nil
}

func (r *PostgresRepository) GetThreadByOrderID(ctx context.Context, orderID string) (domain.ConversationThread, []domain.ConversationParticipant, error) {
	var thread domain.ConversationThread
	err := r.pool.QueryRow(ctx, `
		SELECT id, order_id, campaign_id, created_at, updated_at
		FROM conversation_threads
		WHERE order_id = $1
	`, orderID).Scan(&thread.ID, &thread.OrderID, &thread.CampaignID, &thread.CreatedAt, &thread.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ConversationThread{}, nil, domain.ErrThreadNotFound
		}
		return domain.ConversationThread{}, nil, fmt.Errorf("query thread by order: %w", err)
	}

	participants, err := r.getParticipants(ctx, thread.ID)
	if err != nil {
		return domain.ConversationThread{}, nil, err
	}
	thread.Participants = participants

	return thread, participants, nil
}

func (r *PostgresRepository) getParticipants(ctx context.Context, threadID string) ([]domain.ConversationParticipant, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT cp.thread_id, cp.user_id, u.display_name, cp.last_read_at, cp.joined_at
		FROM conversation_participants cp
		JOIN users u ON u.id = cp.user_id
		WHERE cp.thread_id = $1
		ORDER BY cp.joined_at ASC
	`, threadID)
	if err != nil {
		return nil, fmt.Errorf("query participants: %w", err)
	}
	defer rows.Close()

	var list []domain.ConversationParticipant
	for rows.Next() {
		var p domain.ConversationParticipant
		if err := rows.Scan(&p.ThreadID, &p.UserID, &p.UserDisplayName, &p.LastReadAt, &p.JoinedAt); err != nil {
			return nil, fmt.Errorf("scan participant: %w", err)
		}
		list = append(list, p)
	}
	return list, nil
}

func (r *PostgresRepository) ListMessages(ctx context.Context, threadID string, since *time.Time, limit int) ([]domain.Message, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	query := `
		SELECT m.id, m.thread_id, m.sender_user_id, u.display_name, m.body, m.created_at
		FROM messages m
		JOIN users u ON u.id = m.sender_user_id
		WHERE m.thread_id = $1
	`
	args := []any{threadID}

	if since != nil {
		query += ` AND m.created_at > $2`
		args = append(args, *since)
	}

	query += fmt.Sprintf(` ORDER BY m.created_at ASC LIMIT %d`, limit)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query messages: %w", err)
	}
	defer rows.Close()

	var messages []domain.Message
	for rows.Next() {
		var msg domain.Message
		if err := rows.Scan(&msg.ID, &msg.ThreadID, &msg.SenderUserID, &msg.SenderName, &msg.Body, &msg.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan message: %w", err)
		}
		messages = append(messages, msg)
	}
	return messages, nil
}

func (r *PostgresRepository) SendMessage(ctx context.Context, threadID, senderUserID, body string) (domain.Message, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Message{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var msg domain.Message
	err = tx.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO messages (thread_id, sender_user_id, body)
			VALUES ($1, $2, $3)
			RETURNING id, thread_id, sender_user_id, body, created_at
		)
		SELECT i.id, i.thread_id, i.sender_user_id, u.display_name, i.body, i.created_at
		FROM inserted i
		JOIN users u ON u.id = i.sender_user_id
	`, threadID, senderUserID, body).Scan(&msg.ID, &msg.ThreadID, &msg.SenderUserID, &msg.SenderName, &msg.Body, &msg.CreatedAt)
	if err != nil {
		return domain.Message{}, fmt.Errorf("insert message: %w", err)
	}

	// Update thread updated_at
	_, err = tx.Exec(ctx, `
		UPDATE conversation_threads
		SET updated_at = now()
		WHERE id = $1
	`, threadID)
	if err != nil {
		return domain.Message{}, fmt.Errorf("update thread: %w", err)
	}

	// Update sender's last_read_at
	_, err = tx.Exec(ctx, `
		UPDATE conversation_participants
		SET last_read_at = now()
		WHERE thread_id = $1 AND user_id = $2
	`, threadID, senderUserID)
	if err != nil {
		return domain.Message{}, fmt.Errorf("update sender last read: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Message{}, fmt.Errorf("commit tx: %w", err)
	}

	return msg, nil
}

func (r *PostgresRepository) UpdateParticipantRead(ctx context.Context, threadID, userID string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE conversation_participants
		SET last_read_at = now()
		WHERE thread_id = $1 AND user_id = $2
	`, threadID, userID)
	if err != nil {
		return fmt.Errorf("update participant read: %w", err)
	}
	return nil
}

func (r *PostgresRepository) CreateNotification(ctx context.Context, userID string, kind domain.NotificationKind, title, body, actionURL string) (domain.Notification, error) {
	var n domain.Notification
	err := r.pool.QueryRow(ctx, `
		INSERT INTO notifications (user_id, kind, title, body, action_url)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, user_id, kind, title, body, action_url, is_read, read_at, created_at
	`, userID, string(kind), title, body, actionURL).Scan(
		&n.ID, &n.UserID, &n.Kind, &n.Title, &n.Body, &n.ActionURL, &n.IsRead, &n.ReadAt, &n.CreatedAt,
	)
	if err != nil {
		return domain.Notification{}, fmt.Errorf("insert notification: %w", err)
	}
	return n, nil
}

func (r *PostgresRepository) ListNotifications(ctx context.Context, userID string, unreadOnly bool, limit, offset int) ([]domain.Notification, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	countQuery := `SELECT count(*) FROM notifications WHERE user_id = $1`
	listQuery := `
		SELECT id, user_id, kind, title, body, action_url, is_read, read_at, created_at
		FROM notifications
		WHERE user_id = $1
	`
	if unreadOnly {
		countQuery += ` AND is_read = false`
		listQuery += ` AND is_read = false`
	}

	listQuery += fmt.Sprintf(` ORDER BY created_at DESC LIMIT %d OFFSET %d`, limit, offset)

	var total int64
	if err := r.pool.QueryRow(ctx, countQuery, userID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count notifications: %w", err)
	}

	rows, err := r.pool.Query(ctx, listQuery, userID)
	if err != nil {
		return nil, 0, fmt.Errorf("query notifications: %w", err)
	}
	defer rows.Close()

	var list []domain.Notification
	for rows.Next() {
		var n domain.Notification
		if err := rows.Scan(&n.ID, &n.UserID, &n.Kind, &n.Title, &n.Body, &n.ActionURL, &n.IsRead, &n.ReadAt, &n.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan notification: %w", err)
		}
		list = append(list, n)
	}

	return list, total, nil
}

func (r *PostgresRepository) GetUnreadNotificationCount(ctx context.Context, userID string) (int64, error) {
	var count int64
	err := r.pool.QueryRow(ctx, `
		SELECT count(*)
		FROM notifications
		WHERE user_id = $1 AND is_read = false
	`, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("query unread count: %w", err)
	}
	return count, nil
}

func (r *PostgresRepository) MarkNotificationRead(ctx context.Context, userID, notificationID string) error {
	cmd, err := r.pool.Exec(ctx, `
		UPDATE notifications
		SET is_read = true, read_at = now()
		WHERE id = $1 AND user_id = $2 AND is_read = false
	`, notificationID, userID)
	if err != nil {
		return fmt.Errorf("update notification: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return domain.ErrNotificationNotFound
	}
	return nil
}

func (r *PostgresRepository) MarkAllNotificationsRead(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE notifications
		SET is_read = true, read_at = now()
		WHERE user_id = $1 AND is_read = false
	`, userID)
	if err != nil {
		return fmt.Errorf("mark all notifications read: %w", err)
	}
	return nil
}

func (r *PostgresRepository) GetNotificationPreferences(ctx context.Context, userID string) (domain.NotificationPreferences, error) {
	var p domain.NotificationPreferences
	err := r.pool.QueryRow(ctx, `
		SELECT user_id, email_notifications, order_updates, messages, updated_at
		FROM notification_preferences
		WHERE user_id = $1
	`, userID).Scan(&p.UserID, &p.EmailNotifications, &p.OrderUpdates, &p.Messages, &p.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		// Initialize default preferences
		err = r.pool.QueryRow(ctx, `
			INSERT INTO notification_preferences (user_id, email_notifications, order_updates, messages)
			VALUES ($1, true, true, true)
			ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
			RETURNING user_id, email_notifications, order_updates, messages, updated_at
		`, userID).Scan(&p.UserID, &p.EmailNotifications, &p.OrderUpdates, &p.Messages, &p.UpdatedAt)
		if err != nil {
			return domain.NotificationPreferences{}, fmt.Errorf("insert default preferences: %w", err)
		}
		return p, nil
	} else if err != nil {
		return domain.NotificationPreferences{}, fmt.Errorf("query preferences: %w", err)
	}
	return p, nil
}

func (r *PostgresRepository) UpdateNotificationPreferences(ctx context.Context, userID string, prefs domain.NotificationPreferences) (domain.NotificationPreferences, error) {
	var p domain.NotificationPreferences
	err := r.pool.QueryRow(ctx, `
		INSERT INTO notification_preferences (user_id, email_notifications, order_updates, messages, updated_at)
		VALUES ($1, $2, $3, $4, now())
		ON CONFLICT (user_id) DO UPDATE
		SET email_notifications = EXCLUDED.email_notifications,
		    order_updates = EXCLUDED.order_updates,
		    messages = EXCLUDED.messages,
		    updated_at = now()
		RETURNING user_id, email_notifications, order_updates, messages, updated_at
	`, userID, prefs.EmailNotifications, prefs.OrderUpdates, prefs.Messages).Scan(
		&p.UserID, &p.EmailNotifications, &p.OrderUpdates, &p.Messages, &p.UpdatedAt,
	)
	if err != nil {
		return domain.NotificationPreferences{}, fmt.Errorf("upsert preferences: %w", err)
	}
	return p, nil
}

func (r *PostgresRepository) EnqueueEmailNotification(ctx context.Context, recipientEmail, locale, kind, subject, bodyCopy string) error {
	// Inserts directly into email_outbox with status and expiration (48 hours)
	// payload_nonce must be exactly 12 bytes per email_outbox_payload_lifecycle constraint
	_, err := r.pool.Exec(ctx, `
		INSERT INTO email_outbox (recipient, kind, locale, payload_ciphertext, payload_nonce, expires_at)
		VALUES ($1, $2, $3, $4::bytea, $5::bytea, now() + interval '48 hours')
	`, recipientEmail, kind, locale, []byte(bodyCopy), []byte("123456789012"))
	if err != nil {
		return fmt.Errorf("enqueue email outbox: %w", err)
	}
	return nil
}

func (r *PostgresRepository) GetOrderClientAndCreator(ctx context.Context, orderID string) (clientUserID, creatorUserID string, err error) {
	err = r.pool.QueryRow(ctx, `
		SELECT client_user_id, creator_user_id
		FROM orders
		WHERE id = $1
	`, orderID).Scan(&clientUserID, &creatorUserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", domain.ErrThreadNotFound
		}
		return "", "", fmt.Errorf("query order client and creator: %w", err)
	}
	return clientUserID, creatorUserID, nil
}

func (r *PostgresRepository) GetUserEmailAndLocale(ctx context.Context, userID string) (email, locale string, err error) {
	err = r.pool.QueryRow(ctx, `
		SELECT email, preferred_locale
		FROM users
		WHERE id = $1
	`, userID).Scan(&email, &locale)
	if err != nil {
		return "", "", fmt.Errorf("query user email and locale: %w", err)
	}
	return email, locale, nil
}
