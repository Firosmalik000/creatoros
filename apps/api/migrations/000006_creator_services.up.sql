CREATE TABLE creator_services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_user_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    slug text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (creator_user_id, slug),
    CONSTRAINT creator_services_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT creator_services_title_length CHECK (length(btrim(title)) BETWEEN 3 AND 120),
    CONSTRAINT creator_services_description_length CHECK (length(btrim(description)) BETWEEN 20 AND 3000),
    CONSTRAINT creator_services_status CHECK (status IN ('draft', 'published')),
    CONSTRAINT creator_services_publication_time CHECK (
        (status = 'draft' AND published_at IS NULL)
        OR (status = 'published' AND published_at IS NOT NULL)
    )
);

CREATE INDEX creator_services_owner_idx ON creator_services (creator_user_id, updated_at DESC);
CREATE INDEX creator_services_public_idx ON creator_services (creator_user_id, published_at DESC)
    WHERE status = 'published';

CREATE TABLE service_packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id uuid NOT NULL REFERENCES creator_services(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    price_minor bigint NOT NULL,
    currency char(3) NOT NULL,
    delivery_days integer NOT NULL,
    revision_limit integer NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (service_id, sort_order),
    CONSTRAINT service_packages_name_length CHECK (length(btrim(name)) BETWEEN 2 AND 80),
    CONSTRAINT service_packages_description_length CHECK (length(description) <= 1000),
    CONSTRAINT service_packages_price CHECK (price_minor > 0),
    CONSTRAINT service_packages_currency CHECK (currency IN ('IDR', 'MYR', 'USD')),
    CONSTRAINT service_packages_delivery CHECK (delivery_days BETWEEN 1 AND 365),
    CONSTRAINT service_packages_revisions CHECK (revision_limit BETWEEN 0 AND 20),
    CONSTRAINT service_packages_sort_order CHECK (sort_order BETWEEN 0 AND 2)
);

CREATE INDEX service_packages_service_idx ON service_packages (service_id, sort_order);

INSERT INTO permissions (code, name)
VALUES ('creator.services.manage', 'Create, edit, publish, and unpublish own creator services');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code = 'creator.services.manage'
WHERE roles.code = 'creator';
