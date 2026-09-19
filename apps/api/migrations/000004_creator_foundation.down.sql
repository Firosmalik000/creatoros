DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE code IN (
        'creator.profile.read',
        'creator.profile.update',
        'creator.verification.submit',
        'creator.verification.review'
    )
);

DELETE FROM permissions
WHERE code IN (
    'creator.profile.read',
    'creator.profile.update',
    'creator.verification.submit',
    'creator.verification.review'
);

DROP TABLE creator_verification_events;
DROP TABLE creator_portfolios;
DROP TABLE creator_languages;
DROP TABLE creator_categories;
DROP TABLE creator_social_accounts;
DROP TABLE creator_profiles;
DROP TABLE categories;
DROP TABLE platforms;
