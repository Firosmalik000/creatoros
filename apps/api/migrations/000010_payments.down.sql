DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions WHERE code IN (
        'payments.pay', 'payments.view', 'payouts.request', 'payouts.manage'
    )
);

DELETE FROM permissions
WHERE code IN (
    'payments.pay', 'payments.view', 'payouts.request', 'payouts.manage'
);

DROP TABLE IF EXISTS payment_webhook_events CASCADE;
DROP TABLE IF EXISTS payout_requests CASCADE;
DROP TABLE IF EXISTS payout_methods CASCADE;
DROP TABLE IF EXISTS creator_wallets CASCADE;
DROP TABLE IF EXISTS ledger_entries CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
