CREATE TABLE creator_favorites (
    client_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_user_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (client_user_id, creator_user_id),
    CONSTRAINT creator_favorites_not_self CHECK (client_user_id <> creator_user_id)
);

CREATE INDEX creator_favorites_client_idx ON creator_favorites (client_user_id, created_at DESC);
CREATE INDEX creator_favorites_creator_idx ON creator_favorites (creator_user_id);

INSERT INTO permissions (code, name)
VALUES ('marketplace.favorites.manage', 'Save and remove creator favorites');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code = 'marketplace.favorites.manage'
WHERE roles.code = 'client';
