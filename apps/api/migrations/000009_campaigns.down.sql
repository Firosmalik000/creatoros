DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions WHERE code IN ('campaigns.create', 'campaigns.manage', 'campaigns.respond')
);

DELETE FROM permissions
WHERE code IN ('campaigns.create', 'campaigns.manage', 'campaigns.respond');

DROP TABLE IF EXISTS campaign_events;
DROP TABLE IF EXISTS campaign_invitations;
DROP TABLE IF EXISTS campaign_requirements;
DROP TABLE IF EXISTS campaigns;
