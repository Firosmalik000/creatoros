CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES orders(id) ON DELETE RESTRICT,
    campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
    client_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    creator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount_minor bigint NOT NULL,
    currency char(3) NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    payment_method text NOT NULL DEFAULT 'card',
    provider text NOT NULL DEFAULT 'simulated',
    provider_transaction_id text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT payments_status CHECK (
        status IN ('pending', 'escrow_held', 'released', 'refunded', 'failed')
    ),
    CONSTRAINT payments_currency CHECK (currency IN ('IDR', 'MYR', 'USD')),
    CONSTRAINT payments_amount CHECK (amount_minor > 0)
);

CREATE INDEX payments_order_idx ON payments (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX payments_campaign_idx ON payments (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX payments_client_idx ON payments (client_user_id, created_at DESC);
CREATE INDEX payments_creator_idx ON payments (creator_user_id, created_at DESC);
CREATE INDEX payments_status_idx ON payments (status);

CREATE TABLE ledger_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id uuid NOT NULL,
    reference_type text NOT NULL,
    reference_id uuid NOT NULL,
    account_type text NOT NULL,
    user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
    entry_type text NOT NULL,
    amount_minor bigint NOT NULL,
    currency char(3) NOT NULL,
    description text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ledger_entries_ref_type CHECK (
        reference_type IN ('order_escrow', 'commission', 'creator_payout', 'refund')
    ),
    CONSTRAINT ledger_entries_account_type CHECK (
        account_type IN ('client_cash', 'platform_escrow', 'creator_balance', 'platform_commission', 'payout_reserve')
    ),
    CONSTRAINT ledger_entries_entry_type CHECK (entry_type IN ('debit', 'credit')),
    CONSTRAINT ledger_entries_amount CHECK (amount_minor > 0),
    CONSTRAINT ledger_entries_currency CHECK (currency IN ('IDR', 'MYR', 'USD'))
);

CREATE INDEX ledger_entries_tx_idx ON ledger_entries (transaction_id);
CREATE INDEX ledger_entries_user_idx ON ledger_entries (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX ledger_entries_ref_idx ON ledger_entries (reference_type, reference_id);

CREATE TABLE creator_wallets (
    creator_user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    available_balance_minor bigint NOT NULL DEFAULT 0,
    escrow_balance_minor bigint NOT NULL DEFAULT 0,
    total_withdrawn_minor bigint NOT NULL DEFAULT 0,
    currency char(3) NOT NULL DEFAULT 'IDR',
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT creator_wallets_available CHECK (available_balance_minor >= 0),
    CONSTRAINT creator_wallets_escrow CHECK (escrow_balance_minor >= 0),
    CONSTRAINT creator_wallets_withdrawn CHECK (total_withdrawn_minor >= 0),
    CONSTRAINT creator_wallets_currency CHECK (currency IN ('IDR', 'MYR', 'USD'))
);

CREATE TABLE payout_methods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payout_type text NOT NULL DEFAULT 'bank_transfer',
    bank_name text NOT NULL,
    account_number text NOT NULL,
    account_holder_name text NOT NULL,
    is_default boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT payout_methods_type CHECK (payout_type IN ('bank_transfer', 'e_wallet')),
    CONSTRAINT payout_methods_bank CHECK (length(btrim(bank_name)) BETWEEN 2 AND 100),
    CONSTRAINT payout_methods_num CHECK (length(btrim(account_number)) BETWEEN 4 AND 50),
    CONSTRAINT payout_methods_holder CHECK (length(btrim(account_holder_name)) BETWEEN 2 AND 120)
);

CREATE INDEX payout_methods_creator_idx ON payout_methods (creator_user_id);

CREATE TABLE payout_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    payout_method_id uuid REFERENCES payout_methods(id) ON DELETE SET NULL,
    amount_minor bigint NOT NULL,
    currency char(3) NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    reference_note text NOT NULL DEFAULT '',
    processed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT payout_requests_status CHECK (
        status IN ('pending', 'processing', 'completed', 'rejected')
    ),
    CONSTRAINT payout_requests_amount CHECK (amount_minor > 0),
    CONSTRAINT payout_requests_currency CHECK (currency IN ('IDR', 'MYR', 'USD'))
);

CREATE INDEX payout_requests_creator_idx ON payout_requests (creator_user_id, created_at DESC);
CREATE INDEX payout_requests_status_idx ON payout_requests (status, created_at ASC);

CREATE TABLE payment_webhook_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    event_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    signature text NOT NULL DEFAULT '',
    processed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, event_id)
);

CREATE INDEX payment_webhook_events_provider_idx ON payment_webhook_events (provider, processed_at DESC);

INSERT INTO permissions (code, name)
VALUES
    ('payments.pay', 'Create payment intents and fund order/campaign escrow'),
    ('payments.view', 'View payment transactions, balances, and escrow records'),
    ('payouts.request', 'Request creator wallet withdrawals'),
    ('payouts.manage', 'Review and process creator payout requests')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'client'
  AND p.code IN ('payments.pay', 'payments.view')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'creator'
  AND p.code IN ('payments.view', 'payouts.request')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'agency_admin'
  AND p.code IN ('payments.pay', 'payments.view', 'payouts.request', 'payouts.manage')
ON CONFLICT DO NOTHING;
