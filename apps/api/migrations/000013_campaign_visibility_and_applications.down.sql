DROP INDEX IF EXISTS campaigns_public_active_idx;

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_visibility_check;
ALTER TABLE campaigns DROP COLUMN IF EXISTS visibility;

ALTER TABLE campaign_invitations DROP CONSTRAINT IF EXISTS campaign_inv_status;
ALTER TABLE campaign_invitations ADD CONSTRAINT campaign_inv_status CHECK (status = ANY (ARRAY['invited'::text, 'accepted'::text, 'declined'::text, 'selected'::text, 'rejected'::text]));
