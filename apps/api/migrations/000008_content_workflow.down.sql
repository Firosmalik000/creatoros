DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions WHERE code IN ('content.submit', 'content.review')
);

DELETE FROM permissions WHERE code IN ('content.submit', 'content.review');

DROP TABLE IF EXISTS submission_revisions;
DROP TABLE IF EXISTS submission_files;
DROP TABLE IF EXISTS order_submissions;
