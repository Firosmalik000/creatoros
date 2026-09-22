-- Phase 10: Admin Module Schema Rollback Migration

DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions WHERE code IN (
        'admin.access',
        'users.manage',
        'disputes.manage',
        'finance.manage',
        'categories.manage',
        'audit.view'
    )
);

DELETE FROM permissions
WHERE code IN (
    'admin.access',
    'users.manage',
    'disputes.manage',
    'finance.manage',
    'categories.manage',
    'audit.view'
);

DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS order_disputes CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
