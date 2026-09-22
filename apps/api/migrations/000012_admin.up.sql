-- Phase 10: Admin Module Schema Migration

-- 1. Centralized Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    actor_email text NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text NOT NULL,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    ip_address text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);

-- 2. Order Disputes Table
CREATE TABLE IF NOT EXISTS order_disputes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    initiator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason text NOT NULL,
    status text NOT NULL CHECK (status IN ('opened', 'under_review', 'resolved_client_refund', 'resolved_creator_payout', 'dismissed')),
    resolution_notes text,
    resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT order_disputes_order_unique UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_disputes_status ON order_disputes (status);
CREATE INDEX IF NOT EXISTS idx_order_disputes_created_at ON order_disputes (created_at DESC);

-- 3. System Announcements Table
CREATE TABLE IF NOT EXISTS announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    body text NOT NULL,
    target_role text NOT NULL CHECK (target_role IN ('all', 'creator', 'client')),
    is_active boolean NOT NULL DEFAULT true,
    starts_at timestamptz NOT NULL DEFAULT now(),
    ends_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements (is_active, starts_at, ends_at);

-- 4. Permissions & Role Assignments
INSERT INTO roles (code, name)
VALUES ('agency_admin', 'Agency Administrator')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name)
VALUES
    ('admin.access', 'Access the administrative control center'),
    ('users.manage', 'Manage users, statuses, and role assignments'),
    ('disputes.manage', 'Review and resolve order disputes'),
    ('finance.manage', 'Review payouts and oversee platform finances'),
    ('categories.manage', 'Manage platform categories and catalog'),
    ('audit.view', 'View system-wide audit logs')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('admin', 'agency_admin')
  AND p.code IN (
      'admin.access',
      'users.manage',
      'disputes.manage',
      'finance.manage',
      'categories.manage',
      'audit.view'
  )
ON CONFLICT DO NOTHING;
