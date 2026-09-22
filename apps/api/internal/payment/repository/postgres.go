package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/creatoros/platform/apps/api/internal/payment/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

func (r *PostgresRepository) GetOrderClientAndCreator(ctx context.Context, orderID string) (clientUserID, creatorUserID string, priceMinor int64, currency string, orderStatus string, err error) {
	row := r.pool.QueryRow(ctx, `
		SELECT client_user_id, creator_user_id, price_minor, currency, status
		FROM orders
		WHERE id = $1
	`, orderID)
	err = row.Scan(&clientUserID, &creatorUserID, &priceMinor, &currency, &orderStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", 0, "", "", domain.ErrNotFound
		}
		return "", "", 0, "", "", fmt.Errorf("query order: %w", err)
	}
	return clientUserID, creatorUserID, priceMinor, currency, orderStatus, nil
}

func (r *PostgresRepository) CreateOrderPayment(ctx context.Context, orderID string, clientUserID, creatorUserID string, amountMinor int64, currency, method, provider, providerTxID string) (domain.Payment, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Payment{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var existingID string
	var existingStatus string
	err = tx.QueryRow(ctx, `
		SELECT id, status FROM payments
		WHERE order_id = $1 AND status IN ('escrow_held', 'released')
		LIMIT 1
	`, orderID).Scan(&existingID, &existingStatus)
	if err == nil {
		return domain.Payment{}, domain.ErrAlreadyPaid
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return domain.Payment{}, fmt.Errorf("check existing payment: %w", err)
	}

	var payment domain.Payment
	err = tx.QueryRow(ctx, `
		INSERT INTO payments (
			id, order_id, client_user_id, creator_user_id,
			amount_minor, currency, status, payment_method,
			provider, provider_transaction_id, created_at, updated_at
		) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
		RETURNING id, order_id, client_user_id, creator_user_id, amount_minor, currency, status, payment_method, provider, provider_transaction_id, created_at, updated_at
	`, orderID, clientUserID, creatorUserID, amountMinor, currency, string(domain.PaymentEscrowHeld), method, provider, providerTxID).Scan(
		&payment.ID, &payment.OrderID, &payment.ClientUserID, &payment.CreatorUserID,
		&payment.AmountMinor, &payment.Currency, &payment.Status, &payment.PaymentMethod,
		&payment.Provider, &payment.ProviderTransactionID, &payment.CreatedAt, &payment.UpdatedAt,
	)
	if err != nil {
		return domain.Payment{}, fmt.Errorf("insert payment: %w", err)
	}

	// Double-entry ledger: Debit client_cash, Credit platform_escrow
	// transaction_id reuses the payment ID already returned
	_, err = tx.Exec(ctx, `
		INSERT INTO ledger_entries (
			id, transaction_id, reference_type, reference_id,
			account_type, user_id, entry_type, amount_minor,
			currency, description, created_at
		) VALUES
		(gen_random_uuid(), $1::uuid, 'order_escrow', $2::uuid, 'client_cash', $3::uuid, 'debit', $4, $5, 'Order payment from client', now()),
		(gen_random_uuid(), $1::uuid, 'order_escrow', $2::uuid, 'platform_escrow', NULL, 'credit', $4, $5, 'Escrow held for order', now())
	`, payment.ID, orderID, clientUserID, amountMinor, currency)
	if err != nil {
		return domain.Payment{}, fmt.Errorf("insert ledger entries: %w", err)
	}

	// Ensure wallet exists and increase escrow_balance_minor
	_, err = tx.Exec(ctx, `
		INSERT INTO creator_wallets (
			creator_user_id, available_balance_minor, escrow_balance_minor, total_withdrawn_minor, currency, updated_at
		) VALUES ($1, 0, $2, 0, $3, now())
		ON CONFLICT (creator_user_id) DO UPDATE SET
			escrow_balance_minor = creator_wallets.escrow_balance_minor + EXCLUDED.escrow_balance_minor,
			updated_at = now()
	`, creatorUserID, amountMinor, currency)
	if err != nil {
		return domain.Payment{}, fmt.Errorf("update creator escrow balance: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Payment{}, fmt.Errorf("commit tx: %w", err)
	}

	return payment, nil
}

func (r *PostgresRepository) GetPaymentByOrderID(ctx context.Context, orderID string) (domain.Payment, error) {
	var payment domain.Payment
	err := r.pool.QueryRow(ctx, `
		SELECT
			id, order_id, campaign_id, client_user_id, creator_user_id,
			amount_minor, currency, status, payment_method,
			provider, provider_transaction_id, created_at, updated_at
		FROM payments
		WHERE order_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`, orderID).Scan(
		&payment.ID, &payment.OrderID, &payment.CampaignID, &payment.ClientUserID, &payment.CreatorUserID,
		&payment.AmountMinor, &payment.Currency, &payment.Status, &payment.PaymentMethod,
		&payment.Provider, &payment.ProviderTransactionID, &payment.CreatedAt, &payment.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Payment{}, domain.ErrNotFound
		}
		return domain.Payment{}, fmt.Errorf("query payment by order: %w", err)
	}
	return payment, nil
}

func (r *PostgresRepository) GetPaymentByID(ctx context.Context, paymentID string) (domain.Payment, error) {
	var payment domain.Payment
	err := r.pool.QueryRow(ctx, `
		SELECT
			id, order_id, campaign_id, client_user_id, creator_user_id,
			amount_minor, currency, status, payment_method,
			provider, provider_transaction_id, created_at, updated_at
		FROM payments
		WHERE id = $1
	`, paymentID).Scan(
		&payment.ID, &payment.OrderID, &payment.CampaignID, &payment.ClientUserID, &payment.CreatorUserID,
		&payment.AmountMinor, &payment.Currency, &payment.Status, &payment.PaymentMethod,
		&payment.Provider, &payment.ProviderTransactionID, &payment.CreatedAt, &payment.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Payment{}, domain.ErrNotFound
		}
		return domain.Payment{}, fmt.Errorf("query payment by id: %w", err)
	}
	return payment, nil
}

func (r *PostgresRepository) ReleaseOrderEscrow(ctx context.Context, orderID string, commissionBps int) (domain.Payment, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Payment{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var payment domain.Payment
	err = tx.QueryRow(ctx, `
		SELECT
			id, order_id, client_user_id, creator_user_id,
			amount_minor, currency, status, payment_method,
			provider, provider_transaction_id, created_at, updated_at
		FROM payments
		WHERE order_id = $1 AND status = 'escrow_held'
		FOR UPDATE
	`, orderID).Scan(
		&payment.ID, &payment.OrderID, &payment.ClientUserID, &payment.CreatorUserID,
		&payment.AmountMinor, &payment.Currency, &payment.Status, &payment.PaymentMethod,
		&payment.Provider, &payment.ProviderTransactionID, &payment.CreatedAt, &payment.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Payment{}, domain.ErrNotFound
		}
		return domain.Payment{}, fmt.Errorf("query payment for release: %w", err)
	}

	commissionMinor := (payment.AmountMinor * int64(commissionBps)) / 10000
	netCreatorMinor := payment.AmountMinor - commissionMinor

	// Update payment status to released
	err = tx.QueryRow(ctx, `
		UPDATE payments
		SET status = 'released', updated_at = now()
		WHERE id = $1
		RETURNING status, updated_at
	`, payment.ID).Scan(&payment.Status, &payment.UpdatedAt)
	if err != nil {
		return domain.Payment{}, fmt.Errorf("update payment status: %w", err)
	}

	// Record balanced double-entry ledger entries:
	// Debit platform_escrow (100%), Credit creator_balance (85%), Credit platform_commission (15%)
	txGroupID := payment.ID // reuse payment ID as tx group for escrow release
	_, err = tx.Exec(ctx, `
		INSERT INTO ledger_entries (
			id, transaction_id, reference_type, reference_id,
			account_type, user_id, entry_type, amount_minor,
			currency, description, created_at
		) VALUES
		(gen_random_uuid(), $1::uuid, 'order_escrow', $2::uuid, 'platform_escrow', NULL, 'debit', $3::bigint, $4, 'Escrow released for order fulfillment', now()),
		(gen_random_uuid(), $1::uuid, 'order_escrow', $2::uuid, 'creator_balance', $5::uuid, 'credit', $6::bigint, $4, 'Creator net earnings for order', now()),
		(gen_random_uuid(), $1::uuid, 'commission', $2::uuid, 'platform_commission', NULL, 'credit', $7::bigint, $4, 'Platform service commission fee', now())
	`, txGroupID, orderID, payment.AmountMinor, payment.Currency, payment.CreatorUserID, netCreatorMinor, commissionMinor)
	if err != nil {
		return domain.Payment{}, fmt.Errorf("insert release ledger entries: %w", err)
	}

	// Update creator wallet: escrow balance decreases by 100%, available balance increases by netCreatorMinor
	_, err = tx.Exec(ctx, `
		UPDATE creator_wallets
		SET
			escrow_balance_minor = GREATEST(0, escrow_balance_minor - $1),
			available_balance_minor = available_balance_minor + $2,
			updated_at = now()
		WHERE creator_user_id = $3
	`, payment.AmountMinor, netCreatorMinor, payment.CreatorUserID)
	if err != nil {
		return domain.Payment{}, fmt.Errorf("update wallet balances: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Payment{}, fmt.Errorf("commit tx: %w", err)
	}

	return payment, nil
}

func (r *PostgresRepository) GetOrCreateCreatorWallet(ctx context.Context, creatorUserID string, defaultCurrency string) (domain.CreatorWallet, error) {
	if defaultCurrency == "" {
		defaultCurrency = "IDR"
	}
	var wallet domain.CreatorWallet
	err := r.pool.QueryRow(ctx, `
		INSERT INTO creator_wallets (
			creator_user_id, available_balance_minor, escrow_balance_minor, total_withdrawn_minor, currency, updated_at
		) VALUES ($1, 0, 0, 0, $2, now())
		ON CONFLICT (creator_user_id) DO UPDATE SET
			updated_at = now()
		RETURNING creator_user_id, available_balance_minor, escrow_balance_minor, total_withdrawn_minor, currency, updated_at
	`, creatorUserID, defaultCurrency).Scan(
		&wallet.CreatorUserID, &wallet.AvailableBalanceMinor, &wallet.EscrowBalanceMinor,
		&wallet.TotalWithdrawnMinor, &wallet.Currency, &wallet.UpdatedAt,
	)
	if err != nil {
		return domain.CreatorWallet{}, fmt.Errorf("get or create wallet: %w", err)
	}
	return wallet, nil
}

func (r *PostgresRepository) GetCreatorLedger(ctx context.Context, creatorUserID string, limit int) ([]domain.LedgerEntry, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := r.pool.Query(ctx, `
		SELECT
			id, transaction_id, reference_type, reference_id,
			account_type, user_id, entry_type, amount_minor,
			currency, description, created_at
		FROM ledger_entries
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, creatorUserID, limit)
	if err != nil {
		return nil, fmt.Errorf("query creator ledger: %w", err)
	}
	defer rows.Close()

	entries := []domain.LedgerEntry{}
	for rows.Next() {
		var e domain.LedgerEntry
		if err := rows.Scan(
			&e.ID, &e.TransactionID, &e.ReferenceType, &e.ReferenceID,
			&e.AccountType, &e.UserID, &e.EntryType, &e.AmountMinor,
			&e.Currency, &e.Description, &e.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan ledger entry: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, nil
}

func (r *PostgresRepository) SavePayoutMethod(ctx context.Context, creatorUserID string, input domain.SavePayoutMethodInput) (domain.PayoutMethod, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.PayoutMethod{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Clear existing default
	_, err = tx.Exec(ctx, `
		UPDATE payout_methods SET is_default = false
		WHERE creator_user_id = $1
	`, creatorUserID)
	if err != nil {
		return domain.PayoutMethod{}, fmt.Errorf("clear existing default: %w", err)
	}

	var method domain.PayoutMethod
	err = tx.QueryRow(ctx, `
		INSERT INTO payout_methods (
			creator_user_id, payout_type, bank_name,
			account_number, account_holder_name, is_default,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, true, now(), now())
		RETURNING id, creator_user_id, payout_type, bank_name, account_number, account_holder_name, is_default, created_at, updated_at
	`, creatorUserID, input.PayoutType, input.BankName, input.AccountNumber, input.AccountHolderName).Scan(
		&method.ID, &method.CreatorUserID, &method.PayoutType, &method.BankName,
		&method.AccountNumber, &method.AccountHolderName, &method.IsDefault,
		&method.CreatedAt, &method.UpdatedAt,
	)
	if err != nil {
		return domain.PayoutMethod{}, fmt.Errorf("insert payout method: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.PayoutMethod{}, fmt.Errorf("commit tx: %w", err)
	}
	return method, nil
}

func (r *PostgresRepository) GetPayoutMethods(ctx context.Context, creatorUserID string) ([]domain.PayoutMethod, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
			id, creator_user_id, payout_type, bank_name,
			account_number, account_holder_name, is_default,
			created_at, updated_at
		FROM payout_methods
		WHERE creator_user_id = $1
		ORDER BY is_default DESC, created_at DESC
	`, creatorUserID)
	if err != nil {
		return nil, fmt.Errorf("query payout methods: %w", err)
	}
	defer rows.Close()

	methods := []domain.PayoutMethod{}
	for rows.Next() {
		var m domain.PayoutMethod
		if err := rows.Scan(
			&m.ID, &m.CreatorUserID, &m.PayoutType, &m.BankName,
			&m.AccountNumber, &m.AccountHolderName, &m.IsDefault,
			&m.CreatedAt, &m.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan payout method: %w", err)
		}
		methods = append(methods, m)
	}
	return methods, nil
}

func (r *PostgresRepository) CreatePayoutRequest(ctx context.Context, creatorUserID string, input domain.RequestPayoutInput) (domain.PayoutRequest, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.PayoutRequest{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Lock wallet and verify balance
	var currentAvailable int64
	err = tx.QueryRow(ctx, `
		SELECT available_balance_minor
		FROM creator_wallets
		WHERE creator_user_id = $1
		FOR UPDATE
	`, creatorUserID).Scan(&currentAvailable)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.PayoutRequest{}, domain.ErrInsufficientBalance
		}
		return domain.PayoutRequest{}, fmt.Errorf("lock wallet: %w", err)
	}

	if currentAvailable < input.AmountMinor {
		return domain.PayoutRequest{}, domain.ErrInsufficientBalance
	}

	// If no payout method specified, use default
	var methodID *string = input.PayoutMethodID
	if methodID == nil {
		var defID string
		err = tx.QueryRow(ctx, `
			SELECT id FROM payout_methods
			WHERE creator_user_id = $1 AND is_default = true
			LIMIT 1
		`, creatorUserID).Scan(&defID)
		if err == nil {
			methodID = &defID
		}
	}

	// Deduct from available balance
	_, err = tx.Exec(ctx, `
		UPDATE creator_wallets
		SET available_balance_minor = available_balance_minor - $1,
		    updated_at = now()
		WHERE creator_user_id = $2
	`, input.AmountMinor, creatorUserID)
	if err != nil {
		return domain.PayoutRequest{}, fmt.Errorf("deduct wallet balance: %w", err)
	}

	var req domain.PayoutRequest
	err = tx.QueryRow(ctx, `
		INSERT INTO payout_requests (
			creator_user_id, payout_method_id, amount_minor,
			currency, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, 'pending', now(), now())
		RETURNING id, creator_user_id, payout_method_id, amount_minor, currency, status, reference_note, processed_at, created_at, updated_at
	`, creatorUserID, methodID, input.AmountMinor, input.Currency).Scan(
		&req.ID, &req.CreatorUserID, &req.PayoutMethodID, &req.AmountMinor,
		&req.Currency, &req.Status, &req.ReferenceNote, &req.ProcessedAt,
		&req.CreatedAt, &req.UpdatedAt,
	)
	if err != nil {
		return domain.PayoutRequest{}, fmt.Errorf("insert payout request: %w", err)
	}

	// Record ledger: Debit creator_balance, Credit payout_reserve
	_, err = tx.Exec(ctx, `
		INSERT INTO ledger_entries (
			id, transaction_id, reference_type, reference_id,
			account_type, user_id, entry_type, amount_minor,
			currency, description, created_at
		) VALUES
		(gen_random_uuid(), $1::uuid, 'creator_payout', $2::uuid, 'creator_balance', $3::uuid, 'debit', $4, $5, 'Payout request hold', now()),
		(gen_random_uuid(), $1::uuid, 'creator_payout', $2::uuid, 'payout_reserve', NULL, 'credit', $4, $5, 'Reserve allocation for payout', now())
	`, req.ID, req.ID, creatorUserID, input.AmountMinor, input.Currency)
	if err != nil {
		return domain.PayoutRequest{}, fmt.Errorf("insert payout ledger entries: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.PayoutRequest{}, fmt.Errorf("commit tx: %w", err)
	}
	return req, nil
}

func (r *PostgresRepository) ListCreatorPayouts(ctx context.Context, creatorUserID string) ([]domain.PayoutRequest, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
			pr.id, pr.creator_user_id, pr.payout_method_id, pr.amount_minor,
			pr.currency, pr.status, pr.reference_note, pr.processed_at,
			pr.created_at, pr.updated_at,
			COALESCE(pm.bank_name, ''),
			COALESCE(pm.account_number, ''),
			COALESCE(pm.account_holder_name, '')
		FROM payout_requests pr
		LEFT JOIN payout_methods pm ON pm.id = pr.payout_method_id
		WHERE pr.creator_user_id = $1
		ORDER BY pr.created_at DESC
	`, creatorUserID)
	if err != nil {
		return nil, fmt.Errorf("query creator payouts: %w", err)
	}
	defer rows.Close()

	requests := []domain.PayoutRequest{}
	for rows.Next() {
		var pr domain.PayoutRequest
		if err := rows.Scan(
			&pr.ID, &pr.CreatorUserID, &pr.PayoutMethodID, &pr.AmountMinor,
			&pr.Currency, &pr.Status, &pr.ReferenceNote, &pr.ProcessedAt,
			&pr.CreatedAt, &pr.UpdatedAt,
			&pr.BankName, &pr.AccountNumber, &pr.AccountHolderName,
		); err != nil {
			return nil, fmt.Errorf("scan payout request: %w", err)
		}
		requests = append(requests, pr)
	}
	return requests, nil
}

func (r *PostgresRepository) ProcessPayoutRequest(ctx context.Context, payoutID string, adminUserID string, input domain.ProcessPayoutInput) (domain.PayoutRequest, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.PayoutRequest{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var req domain.PayoutRequest
	err = tx.QueryRow(ctx, `
		SELECT
			id, creator_user_id, payout_method_id, amount_minor,
			currency, status, reference_note, processed_at,
			created_at, updated_at
		FROM payout_requests
		WHERE id = $1
		FOR UPDATE
	`, payoutID).Scan(
		&req.ID, &req.CreatorUserID, &req.PayoutMethodID, &req.AmountMinor,
		&req.Currency, &req.Status, &req.ReferenceNote, &req.ProcessedAt,
		&req.CreatedAt, &req.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.PayoutRequest{}, domain.ErrNotFound
		}
		return domain.PayoutRequest{}, fmt.Errorf("query payout request: %w", err)
	}

	if req.Status != domain.PayoutPending && req.Status != domain.PayoutProcessing {
		return domain.PayoutRequest{}, domain.ErrInvalidStatus
	}

	var newStatus domain.PayoutStatus
	if input.Action == "approve" {
		newStatus = domain.PayoutCompleted
		// Update total withdrawn
		_, err = tx.Exec(ctx, `
			UPDATE creator_wallets
			SET total_withdrawn_minor = total_withdrawn_minor + $1,
			    updated_at = now()
			WHERE creator_user_id = $2
		`, req.AmountMinor, req.CreatorUserID)
		if err != nil {
			return domain.PayoutRequest{}, fmt.Errorf("update total withdrawn: %w", err)
		}

		// Debit payout_reserve — settlement complete
		_, err = tx.Exec(ctx, `
			INSERT INTO ledger_entries (
				id, transaction_id, reference_type, reference_id,
				account_type, user_id, entry_type, amount_minor,
				currency, description, created_at
			) VALUES
			(gen_random_uuid(), gen_random_uuid(), 'creator_payout', $1::uuid, 'payout_reserve', NULL, 'debit', $2, $3, 'Settled payout to creator', now())
		`, req.ID, req.AmountMinor, req.Currency)
		if err != nil {
			return domain.PayoutRequest{}, fmt.Errorf("insert payout completion ledger: %w", err)
		}
	} else {
		newStatus = domain.PayoutRejected
		// Refund available balance
		_, err = tx.Exec(ctx, `
			UPDATE creator_wallets
			SET available_balance_minor = available_balance_minor + $1,
			    updated_at = now()
			WHERE creator_user_id = $2
		`, req.AmountMinor, req.CreatorUserID)
		if err != nil {
			return domain.PayoutRequest{}, fmt.Errorf("refund available balance: %w", err)
		}

		// Reversal ledger: Debit payout_reserve, Credit creator_balance
		_, err = tx.Exec(ctx, `
			INSERT INTO ledger_entries (
				id, transaction_id, reference_type, reference_id,
				account_type, user_id, entry_type, amount_minor,
				currency, description, created_at
			) VALUES
			(gen_random_uuid(), gen_random_uuid(), 'refund', $1::uuid, 'payout_reserve', NULL, 'debit', $2::bigint, $3, 'Payout rejection reserve release', now()),
			(gen_random_uuid(), gen_random_uuid(), 'refund', $1::uuid, 'creator_balance', $4::uuid, 'credit', $2::bigint, $3, 'Payout refund to wallet', now())
		`, req.ID, req.AmountMinor, req.Currency, req.CreatorUserID)
		if err != nil {
			return domain.PayoutRequest{}, fmt.Errorf("insert payout rejection ledger: %w", err)
		}
	}

	err = tx.QueryRow(ctx, `
		UPDATE payout_requests
		SET status = $1, reference_note = $2, processed_at = now(), updated_at = now()
		WHERE id = $3
		RETURNING status, reference_note, processed_at, updated_at
	`, string(newStatus), input.Note, req.ID).Scan(
		&req.Status, &req.ReferenceNote, &req.ProcessedAt, &req.UpdatedAt,
	)
	if err != nil {
		return domain.PayoutRequest{}, fmt.Errorf("update payout request status: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.PayoutRequest{}, fmt.Errorf("commit tx: %w", err)
	}
	return req, nil
}

func (r *PostgresRepository) RecordWebhookEvent(ctx context.Context, provider, eventID, eventType string, payload []byte, signature string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO payment_webhook_events (
			provider, event_id, event_type, payload, signature, processed_at
		) VALUES ($1, $2, $3, $4, $5, now())
	`, provider, eventID, eventType, payload, signature)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
			return domain.ErrDuplicateWebhook
		}
		return fmt.Errorf("record webhook event: %w", err)
	}
	return nil
}
