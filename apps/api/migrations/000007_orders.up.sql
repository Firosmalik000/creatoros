CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    creator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    service_id uuid NOT NULL REFERENCES creator_services(id) ON DELETE RESTRICT,
    package_id uuid NOT NULL REFERENCES service_packages(id) ON DELETE RESTRICT,
    -- price snapshot: locked at order time, immune to future package edits
    package_name text NOT NULL,
    package_description text NOT NULL DEFAULT '',
    price_minor bigint NOT NULL,
    currency char(3) NOT NULL,
    delivery_days integer NOT NULL,
    revision_limit integer NOT NULL,
    -- brief content (required at checkout)
    brief_content text NOT NULL,
    -- state
    status text NOT NULL DEFAULT 'pending_acceptance',
    -- timeline timestamps
    accepted_at timestamptz,
    deadline_at timestamptz,
    cancelled_at timestamptz,
    -- audit
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT orders_status CHECK (
        status IN ('pending_acceptance', 'accepted', 'declined', 'in_progress', 'completed', 'cancelled', 'disputed')
    ),
    CONSTRAINT orders_currency CHECK (currency IN ('IDR', 'MYR', 'USD')),
    CONSTRAINT orders_price_positive CHECK (price_minor > 0),
    CONSTRAINT orders_delivery_days CHECK (delivery_days BETWEEN 1 AND 365),
    CONSTRAINT orders_revision_limit CHECK (revision_limit BETWEEN 0 AND 20),
    CONSTRAINT orders_brief_content_length CHECK (length(btrim(brief_content)) BETWEEN 20 AND 5000),
    CONSTRAINT orders_timeline_consistency CHECK (
        (status = 'pending_acceptance' AND accepted_at IS NULL AND deadline_at IS NULL)
        OR (status = 'declined' AND accepted_at IS NULL AND deadline_at IS NULL)
        OR (status IN ('accepted', 'in_progress', 'completed') AND accepted_at IS NOT NULL AND deadline_at IS NOT NULL)
        OR (status IN ('cancelled', 'disputed'))
    ),
    CONSTRAINT orders_no_self_order CHECK (client_user_id <> creator_user_id)
);

CREATE INDEX orders_client_idx ON orders (client_user_id, created_at DESC);
CREATE INDEX orders_creator_idx ON orders (creator_user_id, created_at DESC);
CREATE INDEX orders_active_idx ON orders (status, updated_at DESC)
    WHERE status NOT IN ('completed', 'cancelled', 'declined');

-- Brief version history: append-only, version 1 created at checkout
CREATE TABLE order_brief_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    version integer NOT NULL,
    content text NOT NULL,
    submitted_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (order_id, version),
    CONSTRAINT order_brief_versions_content_length CHECK (length(btrim(content)) BETWEEN 20 AND 5000),
    CONSTRAINT order_brief_versions_version_positive CHECK (version >= 1)
);

CREATE INDEX order_brief_versions_order_idx ON order_brief_versions (order_id, version DESC);

-- Order event audit log: append-only, records every state transition
CREATE TABLE order_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    from_status text NOT NULL,
    to_status text NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT order_events_from_status CHECK (
        from_status IN ('pending_acceptance', 'accepted', 'declined', 'in_progress', 'completed', 'cancelled', 'disputed')
    ),
    CONSTRAINT order_events_to_status CHECK (
        to_status IN ('pending_acceptance', 'accepted', 'declined', 'in_progress', 'completed', 'cancelled', 'disputed')
    ),
    CONSTRAINT order_events_note_length CHECK (note IS NULL OR length(note) <= 1000)
);

CREATE INDEX order_events_order_idx ON order_events (order_id, created_at ASC);

-- orders.create: client permission to place orders
-- orders.manage: creator permission to accept/decline orders
INSERT INTO permissions (code, name)
VALUES
    ('orders.create', 'Place orders for published creator service packages'),
    ('orders.manage', 'Accept and decline incoming orders as a creator');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code = 'orders.create'
WHERE roles.code = 'client';

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code = 'orders.manage'
WHERE roles.code = 'creator';
