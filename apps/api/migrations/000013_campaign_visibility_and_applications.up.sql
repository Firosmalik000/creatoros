ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_visibility_check'
    ) THEN
        ALTER TABLE campaigns ADD CONSTRAINT campaigns_visibility_check CHECK (visibility IN ('private', 'public'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS campaigns_public_active_idx ON campaigns (status, created_at DESC) WHERE visibility = 'public' AND status = 'active';

ALTER TABLE campaign_invitations DROP CONSTRAINT IF EXISTS campaign_inv_status;
ALTER TABLE campaign_invitations ADD CONSTRAINT campaign_inv_status CHECK (status = ANY (ARRAY['invited'::text, 'applied'::text, 'accepted'::text, 'declined'::text, 'selected'::text, 'rejected'::text]));
