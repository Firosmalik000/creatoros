package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/creatoros/platform/apps/api/internal/admin/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

func (r *PostgresRepository) GetOverviewMetrics(ctx context.Context) (*domain.PlatformOverview, error) {
	metrics := &domain.PlatformOverview{
		Currency:  "IDR",
		Timestamp: time.Now().UTC(),
	}

	_ = r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&metrics.TotalUsers)
	_ = r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM creator_profiles WHERE verification_status = 'verified'`).Scan(&metrics.TotalCreators)
	_ = r.pool.QueryRow(ctx, `SELECT COUNT(DISTINCT client_user_id) FROM orders`).Scan(&metrics.TotalClients)
	_ = r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM orders`).Scan(&metrics.TotalOrders)
	_ = r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM campaigns`).Scan(&metrics.TotalCampaigns)
	_ = r.pool.QueryRow(ctx, `SELECT COALESCE(SUM(amount_minor), 0) FROM payments WHERE status IN ('escrow_held', 'released')`).Scan(&metrics.TotalGMVMinor)
	_ = r.pool.QueryRow(ctx, `SELECT COALESCE(SUM(amount_minor), 0) FROM payments WHERE status = 'escrow_held'`).Scan(&metrics.EscrowHeldMinor)
	_ = r.pool.QueryRow(ctx, `SELECT COALESCE(SUM(amount_minor), 0) FROM ledger_entries WHERE account_type = 'platform_commission' AND entry_type = 'credit'`).Scan(&metrics.CommissionEarnedMinor)
	_ = r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM creator_profiles WHERE verification_status = 'submitted'`).Scan(&metrics.PendingVerifications)
	_ = r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM order_disputes WHERE status IN ('opened', 'under_review')`).Scan(&metrics.ActiveDisputes)
	_ = r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM payout_requests WHERE status = 'pending'`).Scan(&metrics.PendingPayouts)

	return metrics, nil
}

func (r *PostgresRepository) ListUsers(ctx context.Context, roleFilter, statusFilter, search string, limit, offset int) ([]domain.AdminUser, int, error) {
	whereClauses := []string{"1=1"}
	args := []any{}
	argIdx := 1

	if roleFilter != "" && roleFilter != "all" {
		whereClauses = append(whereClauses, fmt.Sprintf("EXISTS (SELECT 1 FROM user_roles ur JOIN roles ro ON ur.role_id = ro.id WHERE ur.user_id = u.id AND ro.code = $%d)", argIdx))
		args = append(args, roleFilter)
		argIdx++
	}

	if statusFilter != "" && statusFilter != "all" {
		whereClauses = append(whereClauses, fmt.Sprintf("u.status = $%d", argIdx))
		args = append(args, statusFilter)
		argIdx++
	}

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(u.email ILIKE $%d OR u.display_name ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM users u WHERE %s", whereSQL)
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count users: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT
			u.id,
			u.email,
			u.display_name,
			u.status,
			u.preferred_locale,
			u.created_at,
			COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') as roles
		FROM users u
		LEFT JOIN user_roles ur ON u.id = ur.user_id
		LEFT JOIN roles r ON ur.role_id = r.id
		WHERE %s
		GROUP BY u.id, u.email, u.display_name, u.status, u.preferred_locale, u.created_at
		ORDER BY u.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	users := make([]domain.AdminUser, 0)
	for rows.Next() {
		var u domain.AdminUser
		if err := rows.Scan(
			&u.ID,
			&u.Email,
			&u.DisplayName,
			&u.Status,
			&u.PreferredLocale,
			&u.CreatedAt,
			&u.Roles,
		); err != nil {
			return nil, 0, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, u)
	}

	return users, total, nil
}

func (r *PostgresRepository) GetUser(ctx context.Context, userID string) (*domain.AdminUser, error) {
	query := `
		SELECT
			u.id,
			u.email,
			u.display_name,
			u.status,
			u.preferred_locale,
			u.created_at,
			COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') as roles
		FROM users u
		LEFT JOIN user_roles ur ON u.id = ur.user_id
		LEFT JOIN roles r ON ur.role_id = r.id
		WHERE u.id = $1
		GROUP BY u.id, u.email, u.display_name, u.status, u.preferred_locale, u.created_at
	`
	var u domain.AdminUser
	err := r.pool.QueryRow(ctx, query, userID).Scan(
		&u.ID,
		&u.Email,
		&u.DisplayName,
		&u.Status,
		&u.PreferredLocale,
		&u.CreatedAt,
		&u.Roles,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrUserNotFound
		}
		return nil, fmt.Errorf("get user: %w", err)
	}
	return &u, nil
}

func (r *PostgresRepository) UpdateUserStatus(ctx context.Context, userID, status string) error {
	res, err := r.pool.Exec(ctx, `UPDATE users SET status = $1, updated_at = now() WHERE id = $2`, status, userID)
	if err != nil {
		return fmt.Errorf("update user status: %w", err)
	}
	if res.RowsAffected() == 0 {
		return domain.ErrUserNotFound
	}
	return nil
}

func (r *PostgresRepository) UpdateUserRoles(ctx context.Context, userID string, roles []string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Check user exists
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)`, userID).Scan(&exists); err != nil || !exists {
		return domain.ErrUserNotFound
	}

	// Delete old roles
	if _, err := tx.Exec(ctx, `DELETE FROM user_roles WHERE user_id = $1`, userID); err != nil {
		return fmt.Errorf("delete user roles: %w", err)
	}

	// Insert new roles
	if len(roles) > 0 {
		insertQuery := `
			INSERT INTO user_roles (user_id, role_id)
			SELECT $1, id FROM roles WHERE code = ANY($2)
		`
		if _, err := tx.Exec(ctx, insertQuery, userID, roles); err != nil {
			return fmt.Errorf("insert user roles: %w", err)
		}
	}

	return tx.Commit(ctx)
}

func (r *PostgresRepository) ListOrders(ctx context.Context, statusFilter, search string, limit, offset int) ([]domain.AdminOrder, int, error) {
	whereClauses := []string{"1=1"}
	args := []any{}
	argIdx := 1

	if statusFilter != "" && statusFilter != "all" {
		whereClauses = append(whereClauses, fmt.Sprintf("o.status = $%d", argIdx))
		args = append(args, statusFilter)
		argIdx++
	}

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(cu.display_name ILIKE $%d OR cl.display_name ILIKE $%d OR cs.title ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM orders o
		JOIN users cl ON o.client_user_id = cl.id
		JOIN users cu ON o.creator_user_id = cu.id
		JOIN creator_services cs ON o.service_id = cs.id
		WHERE %s
	`, whereSQL)

	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count orders: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT
			o.id,
			o.client_user_id,
			cl.email,
			cl.display_name,
			o.creator_user_id,
			cu.display_name,
			cs.title as service_name,
			o.package_name,
			o.price_minor,
			o.currency,
			o.status,
			o.created_at,
			CASE WHEN od.id IS NOT NULL THEN true ELSE false END as has_dispute,
			od.status as dispute_status,
			od.reason as dispute_reason
		FROM orders o
		JOIN users cl ON o.client_user_id = cl.id
		JOIN users cu ON o.creator_user_id = cu.id
		JOIN creator_services cs ON o.service_id = cs.id
		LEFT JOIN order_disputes od ON o.id = od.order_id
		WHERE %s
		ORDER BY o.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list orders: %w", err)
	}
	defer rows.Close()

	orders := make([]domain.AdminOrder, 0)
	for rows.Next() {
		var o domain.AdminOrder
		var dStatus, dReason sql.NullString
		if err := rows.Scan(
			&o.ID,
			&o.ClientID,
			&o.ClientEmail,
			&o.ClientName,
			&o.CreatorID,
			&o.CreatorName,
			&o.ServiceName,
			&o.PackageName,
			&o.PriceMinor,
			&o.Currency,
			&o.Status,
			&o.CreatedAt,
			&o.HasDispute,
			&dStatus,
			&dReason,
		); err != nil {
			return nil, 0, fmt.Errorf("scan order: %w", err)
		}
		if dStatus.Valid {
			o.DisputeStatus = &dStatus.String
		}
		if dReason.Valid {
			o.DisputeReason = &dReason.String
		}
		orders = append(orders, o)
	}

	return orders, total, nil
}

func (r *PostgresRepository) ListCampaigns(ctx context.Context, statusFilter, search string, limit, offset int) ([]domain.AdminCampaign, int, error) {
	whereClauses := []string{"1=1"}
	args := []any{}
	argIdx := 1

	if statusFilter != "" && statusFilter != "all" {
		whereClauses = append(whereClauses, fmt.Sprintf("c.status = $%d", argIdx))
		args = append(args, statusFilter)
		argIdx++
	}

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(c.title ILIKE $%d OR u.display_name ILIKE $%d OR u.email ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM campaigns c JOIN users u ON c.client_user_id = u.id WHERE %s`, whereSQL)
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count campaigns: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT
			c.id,
			c.title,
			c.client_user_id,
			u.email,
			u.display_name,
			c.budget_minor,
			c.currency,
			c.target_creator_count,
			c.status,
			c.created_at
		FROM campaigns c
		JOIN users u ON c.client_user_id = u.id
		WHERE %s
		ORDER BY c.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list campaigns: %w", err)
	}
	defer rows.Close()

	campaigns := make([]domain.AdminCampaign, 0)
	for rows.Next() {
		var c domain.AdminCampaign
		if err := rows.Scan(
			&c.ID,
			&c.Title,
			&c.ClientID,
			&c.ClientEmail,
			&c.ClientName,
			&c.BudgetMinor,
			&c.Currency,
			&c.TargetCreators,
			&c.Status,
			&c.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan campaign: %w", err)
		}
		campaigns = append(campaigns, c)
	}

	return campaigns, total, nil
}

func (r *PostgresRepository) ListDisputes(ctx context.Context, statusFilter string, limit, offset int) ([]domain.OrderDispute, int, error) {
	whereSQL := "1=1"
	args := []any{}
	if statusFilter != "" && statusFilter != "all" {
		whereSQL = "status = $1"
		args = append(args, statusFilter)
	}

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM order_disputes WHERE %s", whereSQL)
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count disputes: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT
			id,
			order_id,
			initiator_user_id,
			reason,
			status,
			resolution_notes,
			resolved_by,
			resolved_at,
			created_at,
			updated_at
		FROM order_disputes
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, len(args)+1, len(args)+2)

	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list disputes: %w", err)
	}
	defer rows.Close()

	disputes := make([]domain.OrderDispute, 0)
	for rows.Next() {
		var d domain.OrderDispute
		var notes, rBy sql.NullString
		var rAt *time.Time
		if err := rows.Scan(
			&d.ID,
			&d.OrderID,
			&d.InitiatorUserID,
			&d.Reason,
			&d.Status,
			&notes,
			&rBy,
			&rAt,
			&d.CreatedAt,
			&d.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan dispute: %w", err)
		}
		if notes.Valid {
			d.ResolutionNotes = &notes.String
		}
		if rBy.Valid {
			d.ResolvedBy = &rBy.String
		}
		d.ResolvedAt = rAt
		disputes = append(disputes, d)
	}

	return disputes, total, nil
}

func (r *PostgresRepository) OpenDispute(ctx context.Context, orderID, initiatorID, reason string) (*domain.OrderDispute, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Update order status to disputed
	res, err := tx.Exec(ctx, `UPDATE orders SET status = 'disputed', updated_at = now() WHERE id = $1 AND status NOT IN ('completed', 'cancelled')`, orderID)
	if err != nil {
		return nil, fmt.Errorf("update order to disputed: %w", err)
	}
	if res.RowsAffected() == 0 {
		return nil, domain.ErrInvalidStatus
	}

	query := `
		INSERT INTO order_disputes (order_id, initiator_user_id, reason, status)
		VALUES ($1, $2, $3, 'opened')
		RETURNING id, order_id, initiator_user_id, reason, status, created_at, updated_at
	`
	var d domain.OrderDispute
	if err := tx.QueryRow(ctx, query, orderID, initiatorID, reason).Scan(
		&d.ID,
		&d.OrderID,
		&d.InitiatorUserID,
		&d.Reason,
		&d.Status,
		&d.CreatedAt,
		&d.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("insert dispute: %w", err)
	}

	// Insert order event
	_, _ = tx.Exec(ctx, `
		INSERT INTO order_events (order_id, actor_user_id, from_status, to_status, note)
		VALUES ($1, $2, 'in_progress', 'disputed', $3)
	`, orderID, initiatorID, "Dispute opened: "+reason)

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit dispute: %w", err)
	}

	return &d, nil
}

func (r *PostgresRepository) GetDisputeByOrderID(ctx context.Context, orderID string) (*domain.OrderDispute, error) {
	query := `
		SELECT id, order_id, initiator_user_id, reason, status, resolution_notes, resolved_by, resolved_at, created_at, updated_at
		FROM order_disputes
		WHERE order_id = $1
	`
	var d domain.OrderDispute
	var notes, rBy sql.NullString
	var rAt *time.Time
	err := r.pool.QueryRow(ctx, query, orderID).Scan(
		&d.ID,
		&d.OrderID,
		&d.InitiatorUserID,
		&d.Reason,
		&d.Status,
		&notes,
		&rBy,
		&rAt,
		&d.CreatedAt,
		&d.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrDisputeNotFound
		}
		return nil, fmt.Errorf("get dispute: %w", err)
	}
	if notes.Valid {
		d.ResolutionNotes = &notes.String
	}
	if rBy.Valid {
		d.ResolvedBy = &rBy.String
	}
	d.ResolvedAt = rAt
	return &d, nil
}

func (r *PostgresRepository) ResolveDispute(ctx context.Context, orderID, resolverID string, status domain.DisputeStatus, notes string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Fetch current dispute
	var currentStatus string
	err = tx.QueryRow(ctx, `SELECT status FROM order_disputes WHERE order_id = $1 FOR UPDATE`, orderID).Scan(&currentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrDisputeNotFound
		}
		return fmt.Errorf("query dispute for update: %w", err)
	}

	if currentStatus != "opened" && currentStatus != "under_review" {
		return domain.ErrDisputeAlreadyResolved
	}

	now := time.Now().UTC()
	_, err = tx.Exec(ctx, `
		UPDATE order_disputes
		SET status = $1, resolution_notes = $2, resolved_by = $3, resolved_at = $4, updated_at = $4
		WHERE order_id = $5
	`, status, notes, resolverID, now, orderID)
	if err != nil {
		return fmt.Errorf("update dispute: %w", err)
	}

	// Fetch order details for ledger/payment updates
	var clientID, creatorID string
	var priceMinor int64
	var currency string
	err = tx.QueryRow(ctx, `SELECT client_user_id, creator_user_id, price_minor, currency FROM orders WHERE id = $1`, orderID).Scan(&clientID, &creatorID, &priceMinor, &currency)
	if err != nil {
		return fmt.Errorf("query order: %w", err)
	}

	switch status {
	case domain.DisputeResolvedClientRefund:
		// Update order to cancelled
		_, _ = tx.Exec(ctx, `UPDATE orders SET status = 'cancelled', cancelled_at = $1, updated_at = $1 WHERE id = $2`, now, orderID)
		_, _ = tx.Exec(ctx, `INSERT INTO order_events (order_id, actor_user_id, from_status, to_status, note) VALUES ($1, $2, 'disputed', 'cancelled', $3)`,
			orderID, resolverID, "Dispute resolved: refunded to client. "+notes)

		// Refund payment and reverse escrow in ledger
		var paymentID string
		pErr := tx.QueryRow(ctx, `SELECT id FROM payments WHERE order_id = $1 AND status = 'escrow_held' LIMIT 1`, orderID).Scan(&paymentID)
		if pErr == nil {
			_, _ = tx.Exec(ctx, `UPDATE payments SET status = 'refunded', updated_at = $1 WHERE id = $2`, now, paymentID)

			// Double entry: Debit platform_escrow, Credit client_cash
			_, _ = tx.Exec(ctx, `
				INSERT INTO ledger_entries (
					id, transaction_id, reference_type, reference_id,
					account_type, user_id, entry_type, amount_minor,
					currency, description, created_at
				) VALUES
				(gen_random_uuid(), $1::uuid, 'refund', $2::uuid, 'platform_escrow', NULL, 'debit', $3::bigint, $4, 'Dispute client refund escrow release', now()),
				(gen_random_uuid(), $1::uuid, 'refund', $2::uuid, 'client_cash', $5::uuid, 'credit', $3::bigint, $4, 'Dispute client refund credited', now())
			`, paymentID, orderID, priceMinor, currency, clientID)

			// Decrease escrow balance in creator wallet
			_, _ = tx.Exec(ctx, `
				UPDATE creator_wallets
				SET escrow_balance_minor = GREATEST(0, escrow_balance_minor - $1), updated_at = $2
				WHERE creator_user_id = $3
			`, priceMinor, now, creatorID)
		}

	case domain.DisputeResolvedCreatorPayout:
		// Update order to completed
		_, _ = tx.Exec(ctx, `UPDATE orders SET status = 'completed', updated_at = $1 WHERE id = $2`, now, orderID)
		_, _ = tx.Exec(ctx, `INSERT INTO order_events (order_id, actor_user_id, from_status, to_status, note) VALUES ($1, $2, 'disputed', 'completed', $3)`,
			orderID, resolverID, "Dispute resolved: released to creator. "+notes)

		// Release escrow in payments and ledger
		var paymentID string
		pErr := tx.QueryRow(ctx, `SELECT id FROM payments WHERE order_id = $1 AND status = 'escrow_held' LIMIT 1`, orderID).Scan(&paymentID)
		if pErr == nil {
			commissionMinor := (priceMinor * 1500) / 10000
			creatorNetMinor := priceMinor - commissionMinor

			_, _ = tx.Exec(ctx, `UPDATE payments SET status = 'released', updated_at = $1 WHERE id = $2`, now, paymentID)

			// Double entry: Debit escrow, Credit creator balance, Credit commission
			_, _ = tx.Exec(ctx, `
				INSERT INTO ledger_entries (
					id, transaction_id, reference_type, reference_id,
					account_type, user_id, entry_type, amount_minor,
					currency, description, created_at
				) VALUES
				(gen_random_uuid(), $1::uuid, 'order_escrow', $2::uuid, 'platform_escrow', NULL, 'debit', $3::bigint, $4, 'Dispute creator release from escrow', now()),
				(gen_random_uuid(), $1::uuid, 'order_escrow', $2::uuid, 'creator_balance', $5::uuid, 'credit', $6::bigint, $4, 'Dispute creator payout earnings net', now()),
				(gen_random_uuid(), $1::uuid, 'commission', $2::uuid, 'platform_commission', NULL, 'credit', $7::bigint, $4, 'Dispute platform commission', now())
			`, paymentID, orderID, priceMinor, currency, creatorID, creatorNetMinor, commissionMinor)

			// Update creator wallet
			_, _ = tx.Exec(ctx, `
				INSERT INTO creator_wallets (creator_user_id, currency, available_balance_minor, escrow_balance_minor)
				VALUES ($1, $2, $3, 0)
				ON CONFLICT (creator_user_id) DO UPDATE SET
					available_balance_minor = creator_wallets.available_balance_minor + EXCLUDED.available_balance_minor,
					escrow_balance_minor = GREATEST(0, creator_wallets.escrow_balance_minor - $4),
					updated_at = $5
			`, creatorID, currency, creatorNetMinor, priceMinor, now)
		}

	case domain.DisputeDismissed:
		// Return order to in_progress
		_, _ = tx.Exec(ctx, `UPDATE orders SET status = 'in_progress', updated_at = $1 WHERE id = $2`, now, orderID)
		_, _ = tx.Exec(ctx, `INSERT INTO order_events (order_id, actor_user_id, from_status, to_status, note) VALUES ($1, $2, 'disputed', 'in_progress', $3)`,
			orderID, resolverID, "Dispute dismissed: "+notes)
	}

	return tx.Commit(ctx)
}

func (r *PostgresRepository) GetFinanceSummary(ctx context.Context) (*domain.AdminFinanceSummary, error) {
	summary := &domain.AdminFinanceSummary{
		Currency: "IDR",
	}

	_ = r.pool.QueryRow(ctx, `SELECT COALESCE(SUM(amount_minor), 0) FROM payments WHERE status IN ('escrow_held', 'released')`).Scan(&summary.TotalGMVMinor)
	_ = r.pool.QueryRow(ctx, `SELECT COALESCE(SUM(amount_minor), 0) FROM payments WHERE status = 'escrow_held'`).Scan(&summary.TotalEscrowMinor)
	_ = r.pool.QueryRow(ctx, `SELECT COALESCE(SUM(amount_minor), 0) FROM ledger_entries WHERE account_type = 'platform_commission' AND entry_type = 'credit'`).Scan(&summary.TotalCommissionsMinor)
	_ = r.pool.QueryRow(ctx, `SELECT COALESCE(SUM(amount_minor), 0) FROM payout_requests WHERE status = 'completed'`).Scan(&summary.TotalPayoutsSettledMinor)
	_ = r.pool.QueryRow(ctx, `SELECT COUNT(*), COALESCE(SUM(amount_minor), 0) FROM payout_requests WHERE status = 'pending'`).Scan(&summary.PendingPayoutsCount, &summary.PendingPayoutsSumMinor)

	return summary, nil
}

func (r *PostgresRepository) ListCategories(ctx context.Context) ([]domain.AdminCategory, error) {
	query := `
		SELECT id, slug, name_id, name_en, name_ms, sort_order, is_active, created_at
		FROM categories
		ORDER BY sort_order ASC, name_en ASC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query categories: %w", err)
	}
	defer rows.Close()

	cats := make([]domain.AdminCategory, 0)
	for rows.Next() {
		var c domain.AdminCategory
		if err := rows.Scan(&c.ID, &c.Slug, &c.NameID, &c.NameEN, &c.NameMS, &c.SortOrder, &c.IsActive, &c.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan category: %w", err)
		}
		cats = append(cats, c)
	}
	return cats, nil
}

func (r *PostgresRepository) CreateCategory(ctx context.Context, cat *domain.AdminCategory) error {
	query := `
		INSERT INTO categories (slug, name_id, name_en, name_ms, sort_order, is_active)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`
	err := r.pool.QueryRow(ctx, query, cat.Slug, cat.NameID, cat.NameEN, cat.NameMS, cat.SortOrder, cat.IsActive).Scan(&cat.ID, &cat.CreatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "categories_slug_key") || strings.Contains(err.Error(), "unique") {
			return domain.ErrCategorySlugExists
		}
		return fmt.Errorf("insert category: %w", err)
	}
	return nil
}

func (r *PostgresRepository) UpdateCategory(ctx context.Context, cat *domain.AdminCategory) error {
	query := `
		UPDATE categories
		SET name_id = $1, name_en = $2, name_ms = $3, sort_order = $4, is_active = $5, updated_at = now()
		WHERE id = $6
	`
	res, err := r.pool.Exec(ctx, query, cat.NameID, cat.NameEN, cat.NameMS, cat.SortOrder, cat.IsActive, cat.ID)
	if err != nil {
		return fmt.Errorf("update category: %w", err)
	}
	if res.RowsAffected() == 0 {
		return domain.ErrCategoryNotFound
	}
	return nil
}

func (r *PostgresRepository) RecordAuditLog(ctx context.Context, log *domain.AuditLog) error {
	detailsJSON, err := json.Marshal(log.Details)
	if err != nil {
		detailsJSON = []byte("{}")
	}

	query := `
		INSERT INTO audit_logs (actor_user_id, actor_email, action, resource_type, resource_id, details, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`
	return r.pool.QueryRow(
		ctx,
		query,
		log.ActorUserID,
		log.ActorEmail,
		log.Action,
		log.ResourceType,
		log.ResourceID,
		detailsJSON,
		log.IPAddress,
	).Scan(&log.ID, &log.CreatedAt)
}

func (r *PostgresRepository) ListAuditLogs(ctx context.Context, actionFilter, resourceType string, limit, offset int) ([]domain.AuditLog, int, error) {
	whereClauses := []string{"1=1"}
	args := []any{}
	argIdx := 1

	if actionFilter != "" && actionFilter != "all" {
		whereClauses = append(whereClauses, fmt.Sprintf("action = $%d", argIdx))
		args = append(args, actionFilter)
		argIdx++
	}

	if resourceType != "" && resourceType != "all" {
		whereClauses = append(whereClauses, fmt.Sprintf("resource_type = $%d", argIdx))
		args = append(args, resourceType)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM audit_logs WHERE %s", whereSQL)
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count audit logs: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT id, actor_user_id, actor_email, action, resource_type, resource_id, details, ip_address, created_at
		FROM audit_logs
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query audit logs: %w", err)
	}
	defer rows.Close()

	logs := make([]domain.AuditLog, 0)
	for rows.Next() {
		var l domain.AuditLog
		var actorID, ipAddr sql.NullString
		var detailsBytes []byte
		if err := rows.Scan(
			&l.ID,
			&actorID,
			&l.ActorEmail,
			&l.Action,
			&l.ResourceType,
			&l.ResourceID,
			&detailsBytes,
			&ipAddr,
			&l.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan audit log: %w", err)
		}
		if actorID.Valid {
			l.ActorUserID = &actorID.String
		}
		if ipAddr.Valid {
			l.IPAddress = &ipAddr.String
		}
		if len(detailsBytes) > 0 {
			_ = json.Unmarshal(detailsBytes, &l.Details)
		}
		logs = append(logs, l)
	}

	return logs, total, nil
}

func (r *PostgresRepository) CreateAnnouncement(ctx context.Context, ann *domain.Announcement) error {
	query := `
		INSERT INTO announcements (title, body, target_role, is_active, starts_at, ends_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at
	`
	return r.pool.QueryRow(
		ctx,
		query,
		ann.Title,
		ann.Body,
		ann.TargetRole,
		ann.IsActive,
		ann.StartsAt,
		ann.EndsAt,
	).Scan(&ann.ID, &ann.CreatedAt, &ann.UpdatedAt)
}

func (r *PostgresRepository) ListAnnouncements(ctx context.Context, targetRole string) ([]domain.Announcement, error) {
	query := `
		SELECT id, title, body, target_role, is_active, starts_at, ends_at, created_at, updated_at
		FROM announcements
		WHERE is_active = true
		  AND (target_role = 'all' OR target_role = $1)
		  AND starts_at <= now()
		  AND (ends_at IS NULL OR ends_at >= now())
		ORDER BY created_at DESC
	`
	rows, err := r.pool.Query(ctx, query, targetRole)
	if err != nil {
		return nil, fmt.Errorf("list announcements: %w", err)
	}
	defer rows.Close()

	announcements := make([]domain.Announcement, 0)
	for rows.Next() {
		var a domain.Announcement
		var endsAt *time.Time
		if err := rows.Scan(
			&a.ID,
			&a.Title,
			&a.Body,
			&a.TargetRole,
			&a.IsActive,
			&a.StartsAt,
			&endsAt,
			&a.CreatedAt,
			&a.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan announcement: %w", err)
		}
		a.EndsAt = endsAt
		announcements = append(announcements, a)
	}
	return announcements, nil
}
