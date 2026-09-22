# Database

PostgreSQL is the system of record. Redis is used only for ephemeral concerns such as rate limits, locks, queues, and caches; it is never the sole source of durable business state.

## Conventions

- IDs use UUIDs consistently; time-sortable UUIDv7 is preferred where supported.
- Timestamps are UTC `timestamptz` values.
- Money uses `bigint` minor units plus a required ISO 4217 currency code.
- State fields use constrained values and backend transition validation.
- User-generated historical files and brief versions are append-only rather than overwritten.
- Every schema change is introduced by a paired, versioned migration.

## Phase 1 identity schema

- `users` stores normalized unique email, Argon2id password hashes, verification state, and preferred locale.
- `roles`, `permissions`, `user_roles`, and `role_permissions` enforce durable role assignments and permission grants.
- `auth_sessions` stores hashed opaque session and CSRF tokens with expiry and revocation timestamps.
- `email_verification_tokens` and `password_reset_tokens` store only token hashes and are one-time consumable.
- Registration, role assignment, and verification-token creation are one transaction.
- Password reset consumes the token, updates the password, and revokes every existing session in one transaction.
- `email_outbox` durably stores encrypted verification/reset payloads; token issuance and enqueueing share one transaction, and payload bytes are cleared after delivery or expiry.
- An `active` user must have `email_verified_at`; consuming a verification token cannot transition a disabled account.

Migrations run through `cmd/migrate` and are serialized with a PostgreSQL advisory lock. Every `.up.sql` has a paired `.down.sql`; production rollback still requires an explicit data-impact review.

## Phase 2 creator schema

- `creator_profiles` is owned one-to-one by a creator user and has a unique public slug plus a constrained verification status.
- `platforms` and localized `categories` are agency-controlled reference data. Join tables enforce valid category, platform, and language references.
- `creator_social_accounts` stores integer followers/views and engagement basis points; a creator has at most one account per platform.
- `creator_portfolios` stores ordered external HTTPS work references until managed uploads arrive in a later phase.
- `creator_verification_events` is append-only audit history for submit, review, suspension, and review-reset transitions.
- Onboarding aggregate writes replace profile-owned collections in one transaction. Any invalid reference rolls the complete write back.
- Editing a reviewed profile returns it to `draft`. Public reads join an active user and require `verification_status = 'verified'`, so non-verified data is excluded at the database query boundary.

## Phase 3 marketplace schema

- `creator_favorites` stores the client-to-creator relationship with a composite primary key, cascading cleanup, and a client-role permission assignment.
- Directory reads derive follower and engagement aggregates from creator evidence and only include active, verified profiles. Favorite writes are idempotent and never overwrite creator-owned data.

## Phase 4 services schema

- `creator_services` belongs to one creator profile and has a creator-scoped unique slug plus constrained `draft`/`published` state. Published rows require `published_at`.
- `service_packages` belongs to one service and stores `price_minor bigint` with required `IDR`, `MYR`, or `USD` currency, delivery days, revision limit, and a database-constrained order allowing at most three packages.
- Service and package writes replace the owned aggregate in one transaction. Editing always clears publication, so stale pricing cannot remain public without explicit republishing.
- Public service queries independently require the account to be active, creator verification to be `verified`, and the service to be `published`.

## Phase 5 order schema

- `orders` stores immutable snapshots of package details (`package_name`, `price_minor`, `currency`, `delivery_days`, `revision_limit`), creator and client foreign keys, the initial `brief_content`, timeline timestamps (`accepted_at`, `deadline_at`, `cancelled_at`), and status constrained to valid states (`pending_acceptance`, `accepted`, `declined`, `in_progress`, `completed`, `cancelled`, `disputed`).
- Self-ordering is prohibited at the database boundary (`client_user_id <> creator_user_id`).
- `order_brief_versions` stores an append-only, versioned brief history per order. Version 1 is created synchronously upon checkout. Clients can submit updated versions while the order is active.
- `order_events` is an immutable, append-only audit trail capturing every lifecycle status transition, actor ID, previous status, next status, and optional transition rationale note.
- `orders.create` permission is granted to the `client` role, and `orders.manage` is granted to the `creator` role. Transitions are validated in the Go domain service and executed within serialized database transactions.

## Phase 6 content workflow schema

- `order_submissions` stores append-only deliverable submission versions per order. Each submission has a version number (`UNIQUE (order_id, version)`), submission status constrained to `submitted`, `revision_requested`, or `approved`, title, optional creator notes, and timestamps.
- `submission_files` stores individual deliverable assets attached to each submission version (`file_path`, `file_name`, `mime_type`, `file_size_bytes`). Files are stored on local server storage (`./uploads/deliverables`) and served via authenticated streaming API endpoints.
- `submission_revisions` stores an append-only revision request history per submission (`revision_number`, `feedback`, `requested_by`, `created_at`).
- Revision limits are authoritative and enforced in Go against the snapshot `revision_limit` locked in the `orders` table. Reaching the revision limit rejects further requests with `ErrRevisionLimitExceeded`.
- Submissions and revisions are append-only. Approving a submission transitions `order_submissions.status = 'approved'`, updates `orders.status = 'completed'`, and records an immutable audit event in `order_events`.
- Role permissions: `content.submit` is granted to `creator` and `agency_admin` roles; `content.review` is granted to `client` and `agency_admin` roles.

## Phase 7 campaign schema

- `campaigns` stores client-initiated marketing campaigns with budget in integer minor units (`budget_minor bigint`), explicit ISO currency (`currency text`), target creator count, deadline, and status constrained to `draft`, `active`, `completed`, or `cancelled`.
- `campaign_requirements` stores matching criteria attached to each campaign: category reference, platform reference, minimum follower count, minimum engagement basis points, deliverable format/type, and deliverable quantity.
- `campaign_invitations` tracks the bidirectional creator invitation lifecycle (`invited` -> `accepted` / `declined` -> `selected`). A creator cannot be invited to the same campaign multiple times (`UNIQUE (campaign_id, creator_user_id)`). Self-invitation is prevented at the application and database boundaries.
- `campaign_events` provides an immutable, append-only audit trail logging all campaign status changes with actor user ID, previous status, next status, and rationale notes.
- Creator matching executes an automated SQL scoring query ranking verified creators based on platform account evidence, category alignment, follower thresholds, and engagement rates.
- Role permissions: `campaigns.create` and `campaigns.manage` granted to `client` and `agency_admin`; `campaigns.respond` granted to `creator` and `agency_admin`.

## Phase 8 payment schema

- `payments` tracks client order/campaign payments with amounts in integer minor units (`amount_minor bigint`), explicit ISO currency (`currency char(3)`: `IDR`, `MYR`, `USD`), payment status (`pending`, `escrow_held`, `released`, `refunded`, `failed`), payment provider, and provider transaction identifier.
- `ledger_entries` implements a balanced double-entry transaction ledger enforcing zero-sum financial accounting across client cash, platform escrow, creator balance, platform commission (1500 bps = 15%), and payout reserves.
- `creator_wallets` maintains authoritatively calculated balances for creators: `available_balance_minor`, `escrow_balance_minor`, and `total_withdrawn_minor`.
- `payout_methods` stores verified creator payout destinations (`bank_transfer`, `e_wallet`) with default-method selection.
- `payout_requests` tracks creator withdrawal requests through review and settlement (`pending`, `processing`, `completed`, `rejected`) with minimum withdrawal limits (IDR 100,000 / MYR 5,000 / USD 1,000 in minor units).
- `payment_webhook_events` ensures signed, idempotent processing of provider webhook events (HMAC-SHA256 signature verification and unique event idempotency).
- Role permissions: `payments.pay` (client, agency_admin), `payments.view` (client, creator, agency_admin), `payouts.request` (creator, agency_admin), `payouts.manage` (agency_admin).

## Phase 9 communication schema

- `conversation_threads` anchors direct and contextual communication linked to domain resources (`order`, `campaign`, `direct`). It tracks thread participants, creation timestamp, and `updated_at`.
- `conversation_participants` records user participation in each thread (`thread_id`, `user_id`), joined timestamp, and `last_read_at` to support unread counts and read receipts.
- `messages` durably stores append-only messages (`thread_id`, `sender_id`, `body`, `attachments jsonb`, `created_at`). Messages are immutable and cannot be altered or overwritten once sent.
- `notifications` stores structured in-app notifications for users (`user_id`, `kind`, `title`, `body`, `action_url`, `is_read`, `read_at`, `created_at`). Kinds include `order_created`, `order_status`, `order_submission`, `revision_requested`, `submission_approved`, `campaign_invite`, `campaign_status`, `new_message`, `payment_received`, `payout_status`, `general`.
- `notification_preferences` maintains per-user notification channel preferences (`user_id`, `email_notifications`, `order_updates`, `messages`, `updated_at`), defaulting to all enabled.
- `email_outbox` check constraint was expanded to support communication notification kinds (`new_message`, `order_update`, `notification`), allowing transactional emails to be enqueued synchronously in database transactions when notification preferences allow.
- Role permissions: `messages.send` and `messages.view` granted to `client`, `creator`, and `agency_admin` (and `admin`); `notifications.view` and `notifications.manage` granted to `client`, `creator`, and `agency_admin` (and `admin`).

## Phase 10 admin schema

- `audit_logs` provides an immutable, append-only security and operational audit trail (`actor_user_id`, `actor_email`, `action`, `resource_type`, `resource_id`, `details jsonb`, `ip_address`, `created_at`). Captures all administrative actions including account suspensions, role modifications, dispute resolutions, and category edits.
- `order_disputes` tracks formal dispute cases between clients and creators (`order_id`, `initiator_user_id`, `reason`, `status`, `resolution_notes`, `resolved_by`, `resolved_at`). Statuses: `opened`, `under_review`, `resolved_client_refund`, `resolved_creator_payout`, `dismissed`.
- `announcements` stores platform-wide notices and broadcast messages (`title`, `body`, `target_role`, `is_active`, `starts_at`, `ends_at`). Target roles include `all`, `creator`, `client`.
- Roles & Permissions: `agency_admin` role added to `roles` table. New admin permissions: `admin.access`, `users.manage`, `disputes.manage`, `finance.manage`, `categories.manage`, `audit.view` granted to both `admin` and `agency_admin`.
- Dispute resolution integrates directly with the balanced double-entry `ledger_entries` table: refunding a client creates debit/credit ledger entries reversing platform escrow back to client cash; paying the creator releases escrow to creator balance with platform commission deducted.

