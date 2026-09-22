CREATE TABLE order_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    version integer NOT NULL,
    creator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title text NOT NULL,
    notes text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'submitted',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (order_id, version),
    CONSTRAINT order_submissions_status CHECK (
        status IN ('submitted', 'revision_requested', 'approved')
    ),
    CONSTRAINT order_submissions_version CHECK (version >= 1),
    CONSTRAINT order_submissions_title_length CHECK (length(btrim(title)) BETWEEN 3 AND 150),
    CONSTRAINT order_submissions_notes_length CHECK (length(notes) <= 3000)
);

CREATE INDEX order_submissions_order_idx ON order_submissions (order_id, version ASC);
CREATE INDEX order_submissions_creator_idx ON order_submissions (creator_user_id, created_at DESC);

CREATE TABLE submission_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id uuid NOT NULL REFERENCES order_submissions(id) ON DELETE RESTRICT,
    file_path text NOT NULL,
    file_name text NOT NULL,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT submission_files_size CHECK (size_bytes > 0 AND size_bytes <= 209715200),
    CONSTRAINT submission_files_mime CHECK (
        mime_type IN (
            'video/mp4', 'video/quicktime', 'video/webm',
            'image/jpeg', 'image/png', 'image/webp',
            'application/pdf', 'application/zip'
        )
    )
);

CREATE INDEX submission_files_submission_idx ON submission_files (submission_id);

CREATE TABLE submission_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id uuid NOT NULL REFERENCES order_submissions(id) ON DELETE RESTRICT,
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    client_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    revision_number integer NOT NULL,
    feedback text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT submission_revisions_number CHECK (revision_number >= 1),
    CONSTRAINT submission_revisions_feedback_length CHECK (length(btrim(feedback)) BETWEEN 10 AND 3000)
);

CREATE INDEX submission_revisions_order_idx ON submission_revisions (order_id, revision_number ASC);
CREATE INDEX submission_revisions_submission_idx ON submission_revisions (submission_id);

INSERT INTO permissions (code, name)
VALUES
    ('content.submit', 'Upload and submit content deliverables for active orders'),
    ('content.review', 'Review content submissions, request revisions, and approve deliverables');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code = 'content.submit'
WHERE roles.code = 'creator';

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code = 'content.review'
WHERE roles.code = 'client';
