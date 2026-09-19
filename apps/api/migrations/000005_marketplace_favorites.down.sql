DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'marketplace.favorites.manage');

DELETE FROM permissions WHERE code = 'marketplace.favorites.manage';
DROP TABLE creator_favorites;
