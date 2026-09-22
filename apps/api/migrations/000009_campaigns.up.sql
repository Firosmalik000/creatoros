CREATE TABLE campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title text NOT NULL,
    description text NOT NULL,
    objective text NOT NULL DEFAULT 'brand_awareness',
    budget_minor bigint NOT NULL,
    currency char(3) NOT NULL,
    target_creators_count integer NOT NULL DEFAULT 1,
    deadline_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT campaigns_status CHECK (
        status IN ('draft', 'active', 'completed', 'cancelled')
    ),
    CONSTRAINT campaigns_objective CHECK (
        objective IN ('brand_awareness', 'traffic', 'conversions', 'ugc_creation')
    ),
    CONSTRAINT campaigns_currency CHECK (currency IN ('IDR', 'MYR', 'USD')),
    CONSTRAINT campaigns_budget_positive CHECK (budget_minor > 0),
    CONSTRAINT campaigns_target_creators CHECK (target_creators_count BETWEEN 1 AND 100),
    CONSTRAINT campaigns_title_length CHECK (length(btrim(title)) BETWEEN 5 AND 160),
    CONSTRAINT campaigns_description_length CHECK (length(btrim(description)) BETWEEN 20 AND 5000)
);

CREATE INDEX campaigns_client_idx ON campaigns (client_user_id, created_at DESC);
CREATE INDEX campaigns_active_idx ON campaigns (status, created_at DESC)
    WHERE status = 'active';

CREATE TABLE campaign_requirements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
    platform_id uuid REFERENCES platforms(id) ON DELETE SET NULL,
    min_followers integer NOT NULL DEFAULT 0,
    min_engagement_bps integer NOT NULL DEFAULT 0,
    deliverable_format text NOT NULL DEFAULT 'video',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (campaign_id),
    CONSTRAINT campaign_req_min_followers CHECK (min_followers >= 0),
    CONSTRAINT campaign_req_min_engagement CHECK (min_engagement_bps >= 0),
    CONSTRAINT campaign_req_format CHECK (
        deliverable_format IN ('video', 'image', 'story', 'carousel', 'mixed')
    )
);

CREATE TABLE campaign_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    creator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'invited',
    offered_fee_minor bigint NOT NULL DEFAULT 0,
    currency char(3) NOT NULL DEFAULT 'IDR',
    pitch_note text,
    responded_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (campaign_id, creator_user_id),
    CONSTRAINT campaign_inv_status CHECK (
        status IN ('invited', 'accepted', 'declined', 'selected', 'rejected')
    ),
    CONSTRAINT campaign_inv_currency CHECK (currency IN ('IDR', 'MYR', 'USD')),
    CONSTRAINT campaign_inv_offered_fee CHECK (offered_fee_minor >= 0)
);

CREATE INDEX campaign_invitations_creator_idx ON campaign_invitations (creator_user_id, created_at DESC);
CREATE INDEX campaign_invitations_campaign_idx ON campaign_invitations (campaign_id, status);

CREATE TABLE campaign_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    from_status text NOT NULL,
    to_status text NOT NULL,
    note text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX campaign_events_campaign_idx ON campaign_events (campaign_id, created_at ASC);

-- Permissions
INSERT INTO permissions (code, name)
VALUES
    ('campaigns.create', 'Create and manage brand campaigns'),
    ('campaigns.manage', 'Invite creators and select participants for campaigns'),
    ('campaigns.respond', 'View and respond to campaign invitations')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code IN ('campaigns.create', 'campaigns.manage')
WHERE roles.code IN ('client', 'agency_admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code = 'campaigns.respond'
WHERE roles.code IN ('creator', 'agency_admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;
