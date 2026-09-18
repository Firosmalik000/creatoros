DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM users
        WHERE status = 'active' AND email_verified_at IS NULL
    ) THEN
        RAISE EXCEPTION 'cannot harden users verification constraint: active users without email_verified_at exist';
    END IF;
END $$;

ALTER TABLE users DROP CONSTRAINT users_verification_consistency;
ALTER TABLE users ADD CONSTRAINT users_verification_consistency CHECK (
    (status = 'pending_verification' AND email_verified_at IS NULL)
    OR (status = 'active' AND email_verified_at IS NOT NULL)
    OR status = 'disabled'
);

CREATE TABLE email_outbox (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient text NOT NULL,
    kind text NOT NULL,
    locale text NOT NULL,
    payload_ciphertext bytea NOT NULL,
    payload_nonce bytea NOT NULL,
    attempt_count integer NOT NULL DEFAULT 0,
    available_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    locked_at timestamptz,
    sent_at timestamptz,
    discarded_at timestamptz,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT email_outbox_recipient_length CHECK (length(recipient) BETWEEN 3 AND 320),
    CONSTRAINT email_outbox_kind CHECK (kind IN ('email_verification', 'password_reset')),
    CONSTRAINT email_outbox_locale CHECK (locale IN ('id', 'en', 'ms')),
    CONSTRAINT email_outbox_expiry CHECK (expires_at > created_at),
    CONSTRAINT email_outbox_payload_lifecycle CHECK (
        (sent_at IS NULL AND discarded_at IS NULL AND octet_length(payload_ciphertext) > 0 AND octet_length(payload_nonce) = 12)
        OR ((sent_at IS NOT NULL OR discarded_at IS NOT NULL) AND octet_length(payload_ciphertext) = 0 AND octet_length(payload_nonce) = 0)
    ),
    CONSTRAINT email_outbox_terminal_state CHECK (sent_at IS NULL OR discarded_at IS NULL),
    CONSTRAINT email_outbox_attempt_count CHECK (attempt_count >= 0)
);

CREATE INDEX email_outbox_pending_idx
    ON email_outbox (available_at, created_at)
    WHERE sent_at IS NULL AND discarded_at IS NULL;
