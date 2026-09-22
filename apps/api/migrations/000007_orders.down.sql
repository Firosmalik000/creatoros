DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions WHERE code IN ('orders.create', 'orders.manage')
);

DELETE FROM permissions WHERE code IN ('orders.create', 'orders.manage');

DROP TABLE IF EXISTS order_events;
DROP TABLE IF EXISTS order_brief_versions;
DROP TABLE IF EXISTS orders;
