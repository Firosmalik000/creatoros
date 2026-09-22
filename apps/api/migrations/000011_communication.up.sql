CREATE TABLE conversation_threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
    campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT conversation_threads_context_check CHECK (
        (order_id IS NOT NULL AND campaign_id IS NULL)
        OR (order_id IS NULL AND campaign_id IS NOT NULL)
    ),
    CONSTRAINT conversation_threads_unique_order UNIQUE (order_id),
    CONSTRAINT conversation_threads_unique_campaign UNIQUE (campaign_id)
);

CREATE INDEX conversation_threads_order_idx ON conversation_threads (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX conversation_threads_campaign_idx ON conversation_threads (campaign_id) WHERE campaign_id IS NOT NULL;

CREATE TABLE conversation_participants (
    thread_id uuid NOT NULL REFERENCES conversation_threads(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at timestamptz NOT NULL DEFAULT now(),
    joined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX conversation_participants_user_idx ON conversation_participants (user_id);

CREATE TABLE messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id uuid NOT NULL REFERENCES conversation_threads(id) ON DELETE CASCADE,
    sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT messages_body_length CHECK (length(btrim(body)) BETWEEN 1 AND 5000)
);

CREATE INDEX messages_thread_created_idx ON messages (thread_id, created_at ASC);
CREATE INDEX messages_sender_idx ON messages (sender_user_id);

CREATE TABLE notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    action_url text NOT NULL DEFAULT '',
    is_read boolean NOT NULL DEFAULT false,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT notifications_kind_check CHECK (
        kind IN (
            'order_update',
            'submission_received',
            'revision_requested',
            'submission_approved',
            'payment_received',
            'escrow_released',
            'payout_update',
            'campaign_invitation',
            'campaign_response',
            'new_message',
            'system'
        )
    ),
    CONSTRAINT notifications_title_length CHECK (length(btrim(title)) BETWEEN 1 AND 255),
    CONSTRAINT notifications_body_length CHECK (length(btrim(body)) BETWEEN 1 AND 2000)
);

CREATE INDEX notifications_user_unread_idx ON notifications (user_id, created_at DESC) WHERE is_read = false;
CREATE INDEX notifications_user_all_idx ON notifications (user_id, created_at DESC);

CREATE TABLE notification_preferences (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_notifications boolean NOT NULL DEFAULT true,
    order_updates boolean NOT NULL DEFAULT true,
    messages boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Expand email_outbox kind to allow communication transactional emails
ALTER TABLE email_outbox DROP CONSTRAINT IF EXISTS email_outbox_kind;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_kind CHECK (
    kind IN ('email_verification', 'password_reset', 'new_message', 'order_update', 'notification')
);

-- Permissions
INSERT INTO permissions (code, name) VALUES
    ('messages.send', 'Send messages within authorized conversation threads'),
    ('messages.view', 'View conversation threads and messages for participated orders/campaigns'),
    ('notifications.view', 'View received notifications'),
    ('notifications.manage', 'Manage notification read status and communication preferences')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to client, creator, and agency_admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
CROSS JOIN permissions
WHERE roles.code IN ('client', 'creator', 'admin', 'agency_admin')
  AND permissions.code IN ('messages.send', 'messages.view', 'notifications.view', 'notifications.manage')
ON CONFLICT DO NOTHING;
