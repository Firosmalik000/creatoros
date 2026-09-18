CREATE TABLE roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT roles_code_format CHECK (code ~ '^[a-z][a-z0-9._-]*$')
);

CREATE TABLE permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT permissions_code_format CHECK (code ~ '^[a-z][a-z0-9._-]*$')
);

CREATE TABLE role_permissions (
    role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    password_hash text NOT NULL,
    display_name text NOT NULL,
    preferred_locale text NOT NULL DEFAULT 'id',
    status text NOT NULL DEFAULT 'pending_verification',
    email_verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_email_normalized CHECK (email = lower(btrim(email))),
    CONSTRAINT users_email_not_blank CHECK (length(email) BETWEEN 3 AND 320),
    CONSTRAINT users_display_name_length CHECK (length(btrim(display_name)) BETWEEN 2 AND 100),
    CONSTRAINT users_preferred_locale CHECK (preferred_locale IN ('id', 'en', 'ms')),
    CONSTRAINT users_status CHECK (status IN ('pending_verification', 'active', 'disabled')),
    CONSTRAINT users_verification_consistency CHECK (
        (status = 'pending_verification' AND email_verified_at IS NULL)
        OR (status IN ('active', 'disabled'))
    )
);

CREATE UNIQUE INDEX users_email_unique ON users (email);

CREATE TABLE user_roles (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX user_roles_role_id_idx ON user_roles (role_id);

CREATE TABLE auth_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash bytea NOT NULL UNIQUE,
    csrf_token_hash bytea NOT NULL,
    expires_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT auth_sessions_expiry CHECK (expires_at > created_at)
);

CREATE INDEX auth_sessions_user_active_idx
    ON auth_sessions (user_id, expires_at)
    WHERE revoked_at IS NULL;

CREATE TABLE email_verification_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash bytea NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT email_verification_tokens_expiry CHECK (expires_at > created_at)
);

CREATE INDEX email_verification_tokens_user_idx
    ON email_verification_tokens (user_id, expires_at DESC);

CREATE TABLE password_reset_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash bytea NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT password_reset_tokens_expiry CHECK (expires_at > created_at)
);

CREATE INDEX password_reset_tokens_user_idx
    ON password_reset_tokens (user_id, expires_at DESC);

INSERT INTO roles (code, name)
VALUES
    ('client', 'Client'),
    ('creator', 'Creator'),
    ('admin', 'Administrator');

INSERT INTO permissions (code, name)
VALUES
    ('account.read', 'Read own account'),
    ('account.update', 'Update own account'),
    ('marketplace.purchase', 'Purchase marketplace services'),
    ('creator.onboard', 'Complete creator onboarding'),
    ('admin.access', 'Access administration');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code IN ('account.read', 'account.update', 'marketplace.purchase')
WHERE roles.code = 'client';

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code IN ('account.read', 'account.update', 'creator.onboard')
WHERE roles.code = 'creator';

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
CROSS JOIN permissions
WHERE roles.code = 'admin';
