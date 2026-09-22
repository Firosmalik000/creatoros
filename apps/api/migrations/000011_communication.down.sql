DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions WHERE code IN (
        'messages.send', 'messages.view', 'notifications.view', 'notifications.manage'
    )
);

DELETE FROM permissions
WHERE code IN ('messages.send', 'messages.view', 'notifications.view', 'notifications.manage');

DROP TABLE IF EXISTS notification_preferences CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversation_participants CASCADE;
DROP TABLE IF EXISTS conversation_threads CASCADE;

ALTER TABLE email_outbox DROP CONSTRAINT IF EXISTS email_outbox_kind;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_kind CHECK (
    kind IN ('email_verification', 'password_reset')
);
