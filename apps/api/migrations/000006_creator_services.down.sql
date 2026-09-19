DELETE FROM role_permissions
WHERE permission_id = (SELECT id FROM permissions WHERE code = 'creator.services.manage');

DELETE FROM permissions WHERE code = 'creator.services.manage';

DROP TABLE IF EXISTS service_packages;
DROP TABLE IF EXISTS creator_services;
