package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/creatoros/platform/apps/api/internal/order/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

func (r *Postgres) Create(ctx context.Context, clientUserID string, input domain.CreateInput, now time.Time) (domain.Order, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Order{}, fmt.Errorf("begin create order tx: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var (
		creatorUserID      string
		packageName        string
		packageDescription string
		priceMinor         int64
		currency           string
		deliveryDays       int
		revisionLimit      int
	)

	err = tx.QueryRow(ctx, `
		SELECT
			s.creator_user_id,
			sp.name,
			sp.description,
			sp.price_minor,
			sp.currency,
			sp.delivery_days,
			sp.revision_limit
		FROM service_packages sp
		JOIN creator_services s ON s.id = sp.service_id
		JOIN creator_profiles cp ON cp.user_id = s.creator_user_id
		JOIN users u ON u.id = s.creator_user_id
		WHERE sp.id = $1 AND s.id = $2
			AND s.status = 'published'
			AND cp.verification_status = 'verified'
			AND u.status = 'active'
	`, input.PackageID, input.ServiceID).Scan(
		&creatorUserID,
		&packageName,
		&packageDescription,
		&priceMinor,
		&currency,
		&deliveryDays,
		&revisionLimit,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Order{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Order{}, fmt.Errorf("query package for order: %w", err)
	}

	if creatorUserID == clientUserID {
		return domain.Order{}, domain.ErrSelfOrder
	}

	var orderID string
	err = tx.QueryRow(ctx, `
		INSERT INTO orders (
			client_user_id,
			creator_user_id,
			service_id,
			package_id,
			package_name,
			package_description,
			price_minor,
			currency,
			delivery_days,
			revision_limit,
			brief_content,
			status,
			created_at,
			updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending_acceptance', $12, $12)
		RETURNING id
	`,
		clientUserID,
		creatorUserID,
		input.ServiceID,
		input.PackageID,
		packageName,
		packageDescription,
		priceMinor,
		currency,
		deliveryDays,
		revisionLimit,
		input.BriefContent,
		now,
	).Scan(&orderID)
	if err != nil {
		return domain.Order{}, fmt.Errorf("insert order: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO order_brief_versions (
			order_id,
			version,
			content,
			submitted_by,
			created_at
		)
		VALUES ($1, 1, $2, $3, $4)
	`, orderID, input.BriefContent, clientUserID, now)
	if err != nil {
		return domain.Order{}, fmt.Errorf("insert initial brief version: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO order_events (
			order_id,
			actor_user_id,
			from_status,
			to_status,
			note,
			created_at
		)
		VALUES ($1, $2, 'pending_acceptance', 'pending_acceptance', 'Order placed by client', $3)
	`, orderID, clientUserID, now)
	if err != nil {
		return domain.Order{}, fmt.Errorf("insert order placed event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Order{}, fmt.Errorf("commit create order tx: %w", err)
	}

	return r.loadOrder(ctx, r.pool, "o.id = $1", orderID)
}

func (r *Postgres) ListForClient(ctx context.Context, clientUserID string) ([]domain.Order, error) {
	return r.listOrders(ctx, "o.client_user_id = $1 ORDER BY o.created_at DESC", clientUserID)
}

func (r *Postgres) GetForClient(ctx context.Context, clientUserID, orderID string) (domain.OrderDetail, error) {
	order, err := r.loadOrder(ctx, r.pool, "o.id = $1 AND o.client_user_id = $2", orderID, clientUserID)
	if err != nil {
		return domain.OrderDetail{}, err
	}
	briefs, events, err := r.loadBriefsAndEvents(ctx, orderID)
	if err != nil {
		return domain.OrderDetail{}, err
	}
	return domain.OrderDetail{Order: order, Briefs: briefs, Events: events}, nil
}

func (r *Postgres) ListForCreator(ctx context.Context, creatorUserID string) ([]domain.Order, error) {
	return r.listOrders(ctx, "o.creator_user_id = $1 ORDER BY o.created_at DESC", creatorUserID)
}

func (r *Postgres) GetForCreator(ctx context.Context, creatorUserID, orderID string) (domain.OrderDetail, error) {
	order, err := r.loadOrder(ctx, r.pool, "o.id = $1 AND o.creator_user_id = $2", orderID, creatorUserID)
	if err != nil {
		return domain.OrderDetail{}, err
	}
	briefs, events, err := r.loadBriefsAndEvents(ctx, orderID)
	if err != nil {
		return domain.OrderDetail{}, err
	}
	return domain.OrderDetail{Order: order, Briefs: briefs, Events: events}, nil
}

func (r *Postgres) Accept(ctx context.Context, creatorUserID, orderID, note string, now time.Time) (domain.Order, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Order{}, fmt.Errorf("begin accept order tx: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var (
		currentStatus string
		deliveryDays  int
	)
	err = tx.QueryRow(ctx, `
		SELECT status, delivery_days FROM orders
		WHERE id = $1 AND creator_user_id = $2
		FOR UPDATE
	`, orderID, creatorUserID).Scan(&currentStatus, &deliveryDays)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Order{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Order{}, fmt.Errorf("check order for accept: %w", err)
	}

	if currentStatus != domain.StatusPendingAcceptance {
		return domain.Order{}, domain.ErrInvalidTransition
	}

	deadlineAt := now.AddDate(0, 0, deliveryDays)
	_, err = tx.Exec(ctx, `
		UPDATE orders
		SET status = 'accepted', accepted_at = $3, deadline_at = $4, updated_at = $3
		WHERE id = $1 AND creator_user_id = $2
	`, orderID, creatorUserID, now, deadlineAt)
	if err != nil {
		return domain.Order{}, fmt.Errorf("update order accepted: %w", err)
	}

	eventNote := "Order accepted by creator"
	if note != "" {
		eventNote = note
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO order_events (order_id, actor_user_id, from_status, to_status, note, created_at)
		VALUES ($1, $2, 'pending_acceptance', 'accepted', $3, $4)
	`, orderID, creatorUserID, eventNote, now)
	if err != nil {
		return domain.Order{}, fmt.Errorf("insert order accepted event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Order{}, fmt.Errorf("commit accept order tx: %w", err)
	}

	return r.loadOrder(ctx, r.pool, "o.id = $1", orderID)
}

func (r *Postgres) Decline(ctx context.Context, creatorUserID, orderID, note string, now time.Time) (domain.Order, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Order{}, fmt.Errorf("begin decline order tx: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var currentStatus string
	err = tx.QueryRow(ctx, `
		SELECT status FROM orders
		WHERE id = $1 AND creator_user_id = $2
		FOR UPDATE
	`, orderID, creatorUserID).Scan(&currentStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Order{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Order{}, fmt.Errorf("check order for decline: %w", err)
	}

	if currentStatus != domain.StatusPendingAcceptance {
		return domain.Order{}, domain.ErrInvalidTransition
	}

	_, err = tx.Exec(ctx, `
		UPDATE orders
		SET status = 'declined', updated_at = $3
		WHERE id = $1 AND creator_user_id = $2
	`, orderID, creatorUserID, now)
	if err != nil {
		return domain.Order{}, fmt.Errorf("update order declined: %w", err)
	}

	eventNote := "Order declined by creator"
	if note != "" {
		eventNote = note
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO order_events (order_id, actor_user_id, from_status, to_status, note, created_at)
		VALUES ($1, $2, 'pending_acceptance', 'declined', $3, $4)
	`, orderID, creatorUserID, eventNote, now)
	if err != nil {
		return domain.Order{}, fmt.Errorf("insert order declined event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Order{}, fmt.Errorf("commit decline order tx: %w", err)
	}

	return r.loadOrder(ctx, r.pool, "o.id = $1", orderID)
}

func (r *Postgres) Cancel(ctx context.Context, actorID, orderID, note string, isClient bool, now time.Time) (domain.Order, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Order{}, fmt.Errorf("begin cancel order tx: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var currentStatus string
	var query string
	if isClient {
		query = "SELECT status FROM orders WHERE id = $1 AND client_user_id = $2 FOR UPDATE"
	} else {
		query = "SELECT status FROM orders WHERE id = $1 AND creator_user_id = $2 FOR UPDATE"
	}

	err = tx.QueryRow(ctx, query, orderID, actorID).Scan(&currentStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Order{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Order{}, fmt.Errorf("check order for cancel: %w", err)
	}

	if currentStatus != domain.StatusPendingAcceptance && currentStatus != domain.StatusAccepted {
		return domain.Order{}, domain.ErrInvalidTransition
	}

	_, err = tx.Exec(ctx, `
		UPDATE orders
		SET status = 'cancelled', cancelled_at = $2, updated_at = $2
		WHERE id = $1
	`, orderID, now)
	if err != nil {
		return domain.Order{}, fmt.Errorf("update order cancelled: %w", err)
	}

	eventNote := "Order cancelled"
	if note != "" {
		eventNote = note
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO order_events (order_id, actor_user_id, from_status, to_status, note, created_at)
		VALUES ($1, $2, $3, 'cancelled', $4, $5)
	`, orderID, actorID, currentStatus, eventNote, now)
	if err != nil {
		return domain.Order{}, fmt.Errorf("insert order cancelled event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Order{}, fmt.Errorf("commit cancel order tx: %w", err)
	}

	return r.loadOrder(ctx, r.pool, "o.id = $1", orderID)
}

func (r *Postgres) SubmitBrief(ctx context.Context, clientUserID, orderID, content string, now time.Time) (domain.BriefVersion, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.BriefVersion{}, fmt.Errorf("begin submit brief tx: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var currentStatus string
	err = tx.QueryRow(ctx, `
		SELECT status FROM orders
		WHERE id = $1 AND client_user_id = $2
		FOR UPDATE
	`, orderID, clientUserID).Scan(&currentStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.BriefVersion{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.BriefVersion{}, fmt.Errorf("check order for submit brief: %w", err)
	}

	if currentStatus == domain.StatusDeclined || currentStatus == domain.StatusCancelled || currentStatus == domain.StatusCompleted {
		return domain.BriefVersion{}, domain.ErrInvalidTransition
	}

	var nextVersion int
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(MAX(version), 0) + 1
		FROM order_brief_versions
		WHERE order_id = $1
	`, orderID).Scan(&nextVersion)
	if err != nil {
		return domain.BriefVersion{}, fmt.Errorf("calculate next brief version: %w", err)
	}

	var briefID string
	err = tx.QueryRow(ctx, `
		INSERT INTO order_brief_versions (order_id, version, content, submitted_by, created_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, orderID, nextVersion, content, clientUserID, now).Scan(&briefID)
	if err != nil {
		return domain.BriefVersion{}, fmt.Errorf("insert brief version: %w", err)
	}

	_, err = tx.Exec(ctx, `
		UPDATE orders
		SET brief_content = $2, updated_at = $3
		WHERE id = $1
	`, orderID, content, now)
	if err != nil {
		return domain.BriefVersion{}, fmt.Errorf("update order brief_content: %w", err)
	}

	note := fmt.Sprintf("Brief version %d submitted", nextVersion)
	_, err = tx.Exec(ctx, `
		INSERT INTO order_events (order_id, actor_user_id, from_status, to_status, note, created_at)
		VALUES ($1, $2, $3, $3, $4, $5)
	`, orderID, clientUserID, currentStatus, note, now)
	if err != nil {
		return domain.BriefVersion{}, fmt.Errorf("insert brief update event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.BriefVersion{}, fmt.Errorf("commit submit brief tx: %w", err)
	}

	var clientName string
	_ = r.pool.QueryRow(ctx, `SELECT display_name FROM users WHERE id = $1`, clientUserID).Scan(&clientName)

	return domain.BriefVersion{
		ID:              briefID,
		OrderID:         orderID,
		Version:         nextVersion,
		Content:         content,
		SubmittedBy:     clientUserID,
		SubmittedByName: clientName,
		CreatedAt:       now,
	}, nil
}

type querier interface {
	QueryRow(context.Context, string, ...any) pgx.Row
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

func (r *Postgres) loadOrder(ctx context.Context, q querier, where string, args ...any) (domain.Order, error) {
	query := `
		SELECT
			o.id,
			o.client_user_id,
			cu.display_name AS client_display_name,
			o.creator_user_id,
			cru.display_name AS creator_display_name,
			cp.slug AS creator_slug,
			o.service_id,
			s.title AS service_title,
			o.package_id,
			o.package_name,
			o.package_description,
			o.price_minor,
			o.currency,
			o.delivery_days,
			o.revision_limit,
			o.brief_content,
			o.status,
			o.accepted_at,
			o.deadline_at,
			o.cancelled_at,
			o.created_at,
			o.updated_at
		FROM orders o
		JOIN users cu ON cu.id = o.client_user_id
		JOIN users cru ON cru.id = o.creator_user_id
		JOIN creator_profiles cp ON cp.user_id = o.creator_user_id
		JOIN creator_services s ON s.id = o.service_id
		WHERE ` + where

	var o domain.Order
	err := q.QueryRow(ctx, query, args...).Scan(
		&o.ID,
		&o.ClientUserID,
		&o.ClientDisplayName,
		&o.CreatorUserID,
		&o.CreatorDisplayName,
		&o.CreatorSlug,
		&o.ServiceID,
		&o.ServiceTitle,
		&o.PackageID,
		&o.PackageName,
		&o.PackageDescription,
		&o.PriceMinor,
		&o.Currency,
		&o.DeliveryDays,
		&o.RevisionLimit,
		&o.BriefContent,
		&o.Status,
		&o.AcceptedAt,
		&o.DeadlineAt,
		&o.CancelledAt,
		&o.CreatedAt,
		&o.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Order{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Order{}, fmt.Errorf("load order: %w", err)
	}
	return o, nil
}

func (r *Postgres) listOrders(ctx context.Context, whereAndOrder string, args ...any) ([]domain.Order, error) {
	query := `
		SELECT
			o.id,
			o.client_user_id,
			cu.display_name AS client_display_name,
			o.creator_user_id,
			cru.display_name AS creator_display_name,
			cp.slug AS creator_slug,
			o.service_id,
			s.title AS service_title,
			o.package_id,
			o.package_name,
			o.package_description,
			o.price_minor,
			o.currency,
			o.delivery_days,
			o.revision_limit,
			o.brief_content,
			o.status,
			o.accepted_at,
			o.deadline_at,
			o.cancelled_at,
			o.created_at,
			o.updated_at
		FROM orders o
		JOIN users cu ON cu.id = o.client_user_id
		JOIN users cru ON cru.id = o.creator_user_id
		JOIN creator_profiles cp ON cp.user_id = o.creator_user_id
		JOIN creator_services s ON s.id = o.service_id
		WHERE ` + whereAndOrder

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query orders list: %w", err)
	}
	defer rows.Close()

	items := make([]domain.Order, 0)
	for rows.Next() {
		var o domain.Order
		err := rows.Scan(
			&o.ID,
			&o.ClientUserID,
			&o.ClientDisplayName,
			&o.CreatorUserID,
			&o.CreatorDisplayName,
			&o.CreatorSlug,
			&o.ServiceID,
			&o.ServiceTitle,
			&o.PackageID,
			&o.PackageName,
			&o.PackageDescription,
			&o.PriceMinor,
			&o.Currency,
			&o.DeliveryDays,
			&o.RevisionLimit,
			&o.BriefContent,
			&o.Status,
			&o.AcceptedAt,
			&o.DeadlineAt,
			&o.CancelledAt,
			&o.CreatedAt,
			&o.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan order item: %w", err)
		}
		items = append(items, o)
	}
	return items, rows.Err()
}

func (r *Postgres) loadBriefsAndEvents(ctx context.Context, orderID string) ([]domain.BriefVersion, []domain.OrderEvent, error) {
	briefRows, err := r.pool.Query(ctx, `
		SELECT b.id, b.order_id, b.version, b.content, b.submitted_by, u.display_name, b.created_at
		FROM order_brief_versions b
		JOIN users u ON u.id = b.submitted_by
		WHERE b.order_id = $1
		ORDER BY b.version ASC
	`, orderID)
	if err != nil {
		return nil, nil, fmt.Errorf("query briefs: %w", err)
	}
	defer briefRows.Close()

	briefs := make([]domain.BriefVersion, 0)
	for briefRows.Next() {
		var b domain.BriefVersion
		if err := briefRows.Scan(&b.ID, &b.OrderID, &b.Version, &b.Content, &b.SubmittedBy, &b.SubmittedByName, &b.CreatedAt); err != nil {
			return nil, nil, fmt.Errorf("scan brief: %w", err)
		}
		briefs = append(briefs, b)
	}
	if err := briefRows.Err(); err != nil {
		return nil, nil, err
	}

	eventRows, err := r.pool.Query(ctx, `
		SELECT e.id, e.order_id, e.actor_user_id, u.display_name, e.from_status, e.to_status, COALESCE(e.note, ''), e.created_at
		FROM order_events e
		JOIN users u ON u.id = e.actor_user_id
		WHERE e.order_id = $1
		ORDER BY e.created_at ASC
	`, orderID)
	if err != nil {
		return nil, nil, fmt.Errorf("query events: %w", err)
	}
	defer eventRows.Close()

	events := make([]domain.OrderEvent, 0)
	for eventRows.Next() {
		var e domain.OrderEvent
		if err := eventRows.Scan(&e.ID, &e.OrderID, &e.ActorUserID, &e.ActorName, &e.FromStatus, &e.ToStatus, &e.Note, &e.CreatedAt); err != nil {
			return nil, nil, fmt.Errorf("scan event: %w", err)
		}
		events = append(events, e)
	}
	if err := eventRows.Err(); err != nil {
		return nil, nil, err
	}

	return briefs, events, nil
}
