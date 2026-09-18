DROP TABLE IF EXISTS email_outbox;

ALTER TABLE users DROP CONSTRAINT users_verification_consistency;
ALTER TABLE users ADD CONSTRAINT users_verification_consistency CHECK (
    (status = 'pending_verification' AND email_verified_at IS NULL)
    OR (status IN ('active', 'disabled'))
);
