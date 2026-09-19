CREATE TABLE platforms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    profile_url_template text,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT platforms_code_format CHECK (code ~ '^[a-z][a-z0-9-]*$'),
    CONSTRAINT platforms_name_not_blank CHECK (length(btrim(name)) BETWEEN 1 AND 80),
    CONSTRAINT platforms_sort_order_nonnegative CHECK (sort_order >= 0)
);

CREATE TABLE categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name_id text NOT NULL,
    name_en text NOT NULL,
    name_ms text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT categories_slug_format CHECK (slug ~ '^[a-z][a-z0-9-]*$'),
    CONSTRAINT categories_names_not_blank CHECK (
        length(btrim(name_id)) BETWEEN 2 AND 80
        AND length(btrim(name_en)) BETWEEN 2 AND 80
        AND length(btrim(name_ms)) BETWEEN 2 AND 80
    ),
    CONSTRAINT categories_sort_order_nonnegative CHECK (sort_order >= 0)
);

CREATE TABLE creator_profiles (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    slug text NOT NULL UNIQUE,
    headline text NOT NULL,
    bio text NOT NULL,
    city text NOT NULL,
    country_code char(2) NOT NULL,
    verification_status text NOT NULL DEFAULT 'draft',
    submitted_at timestamptz,
    reviewed_at timestamptz,
    reviewed_by uuid REFERENCES users(id) ON DELETE RESTRICT,
    review_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT creator_profiles_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT creator_profiles_headline_length CHECK (length(btrim(headline)) BETWEEN 3 AND 120),
    CONSTRAINT creator_profiles_bio_length CHECK (length(btrim(bio)) BETWEEN 20 AND 2000),
    CONSTRAINT creator_profiles_city_length CHECK (length(btrim(city)) BETWEEN 2 AND 100),
    CONSTRAINT creator_profiles_country_code_format CHECK (country_code ~ '^[A-Z]{2}$'),
    CONSTRAINT creator_profiles_verification_status CHECK (
        verification_status IN ('draft', 'submitted', 'under_review', 'revision_required', 'verified', 'rejected', 'suspended')
    ),
    CONSTRAINT creator_profiles_review_note_length CHECK (review_note IS NULL OR length(review_note) <= 1000)
);

CREATE INDEX creator_profiles_public_idx
    ON creator_profiles (updated_at DESC)
    WHERE verification_status = 'verified';

CREATE TABLE creator_social_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_user_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    platform_id uuid NOT NULL REFERENCES platforms(id) ON DELETE RESTRICT,
    handle text NOT NULL,
    profile_url text NOT NULL,
    follower_count bigint NOT NULL DEFAULT 0,
    average_views bigint NOT NULL DEFAULT 0,
    engagement_bps integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (creator_user_id, platform_id),
    CONSTRAINT creator_social_accounts_handle_length CHECK (length(btrim(handle)) BETWEEN 1 AND 100),
    CONSTRAINT creator_social_accounts_profile_url_length CHECK (length(profile_url) BETWEEN 8 AND 2048),
    CONSTRAINT creator_social_accounts_follower_count CHECK (follower_count >= 0),
    CONSTRAINT creator_social_accounts_average_views CHECK (average_views >= 0),
    CONSTRAINT creator_social_accounts_engagement_bps CHECK (engagement_bps BETWEEN 0 AND 10000)
);

CREATE INDEX creator_social_accounts_creator_idx ON creator_social_accounts (creator_user_id);

CREATE TABLE creator_categories (
    creator_user_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (creator_user_id, category_id)
);

CREATE INDEX creator_categories_category_idx ON creator_categories (category_id);

CREATE TABLE creator_languages (
    creator_user_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    language_code text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (creator_user_id, language_code),
    CONSTRAINT creator_languages_code CHECK (language_code IN ('id', 'en', 'ms'))
);

CREATE TABLE creator_portfolios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_user_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    media_url text NOT NULL,
    thumbnail_url text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT creator_portfolios_title_length CHECK (length(btrim(title)) BETWEEN 2 AND 120),
    CONSTRAINT creator_portfolios_description_length CHECK (length(description) <= 1000),
    CONSTRAINT creator_portfolios_media_url_length CHECK (length(media_url) BETWEEN 8 AND 2048),
    CONSTRAINT creator_portfolios_thumbnail_url_length CHECK (thumbnail_url IS NULL OR length(thumbnail_url) BETWEEN 8 AND 2048),
    CONSTRAINT creator_portfolios_sort_order_nonnegative CHECK (sort_order >= 0)
);

CREATE INDEX creator_portfolios_creator_order_idx
    ON creator_portfolios (creator_user_id, sort_order, created_at);

CREATE TABLE creator_verification_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_user_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE RESTRICT,
    actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    from_status text NOT NULL,
    to_status text NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT creator_verification_events_from_status CHECK (
        from_status IN ('draft', 'submitted', 'under_review', 'revision_required', 'verified', 'rejected', 'suspended')
    ),
    CONSTRAINT creator_verification_events_to_status CHECK (
        to_status IN ('draft', 'submitted', 'under_review', 'revision_required', 'verified', 'rejected', 'suspended')
    ),
    CONSTRAINT creator_verification_events_note_length CHECK (note IS NULL OR length(note) <= 1000)
);

CREATE INDEX creator_verification_events_creator_idx
    ON creator_verification_events (creator_user_id, created_at DESC);

INSERT INTO platforms (code, name, profile_url_template, sort_order)
VALUES
    ('tiktok', 'TikTok', 'https://www.tiktok.com/@{handle}', 10),
    ('instagram', 'Instagram', 'https://www.instagram.com/{handle}', 20),
    ('youtube', 'YouTube', 'https://www.youtube.com/@{handle}', 30),
    ('facebook', 'Facebook', 'https://www.facebook.com/{handle}', 40),
    ('x', 'X', 'https://x.com/{handle}', 50);

INSERT INTO categories (slug, name_id, name_en, name_ms, sort_order)
VALUES
    ('food-lifestyle', 'Makanan & Gaya Hidup', 'Food & Lifestyle', 'Makanan & Gaya Hidup', 10),
    ('beauty', 'Kecantikan', 'Beauty', 'Kecantikan', 20),
    ('fashion', 'Fesyen', 'Fashion', 'Fesyen', 30),
    ('technology', 'Teknologi', 'Technology', 'Teknologi', 40),
    ('travel', 'Perjalanan', 'Travel', 'Pelancongan', 50),
    ('fitness-wellness', 'Kebugaran & Kesehatan', 'Fitness & Wellness', 'Kecergasan & Kesejahteraan', 60),
    ('gaming', 'Gaming', 'Gaming', 'Permainan', 70),
    ('parenting-family', 'Parenting & Keluarga', 'Parenting & Family', 'Keibubapaan & Keluarga', 80);

INSERT INTO permissions (code, name)
VALUES
    ('creator.profile.read', 'Read own creator profile'),
    ('creator.profile.update', 'Update own creator profile'),
    ('creator.verification.submit', 'Submit creator verification'),
    ('creator.verification.review', 'Review creator verification');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code IN (
    'creator.profile.read',
    'creator.profile.update',
    'creator.verification.submit'
)
WHERE roles.code = 'creator';

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code IN (
    'creator.profile.read',
    'creator.profile.update',
    'creator.verification.submit',
    'creator.verification.review'
)
WHERE roles.code = 'admin';
