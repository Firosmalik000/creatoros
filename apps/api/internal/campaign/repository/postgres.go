package repository

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/creatoros/platform/apps/api/internal/campaign/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

func (r *PostgresRepository) CreateCampaign(ctx context.Context, clientUserID string, input domain.CreateCampaignInput) (domain.CampaignDetail, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.CampaignDetail{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var camp domain.Campaign
	camp.ClientUserID = clientUserID
	camp.Title = input.Title
	camp.Description = input.Description
	camp.Objective = input.Objective
	camp.BudgetMinor = input.BudgetMinor
	camp.Currency = input.Currency
	camp.TargetCreatorsCount = input.TargetCreatorsCount
	if input.Visibility == "" {
		input.Visibility = domain.VisibilityPublic
	}
	camp.Visibility = input.Visibility

	row := tx.QueryRow(ctx, `
		INSERT INTO campaigns (
			client_user_id, title, description, objective,
			budget_minor, currency, target_creators_count,
			deadline_at, status, visibility
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at, updated_at
	`, clientUserID, input.Title, input.Description, string(input.Objective),
		input.BudgetMinor, input.Currency, input.TargetCreatorsCount,
		input.DeadlineAt, string(domain.StatusDraft), string(input.Visibility),
	)
	if err := row.Scan(&camp.ID, &camp.CreatedAt, &camp.UpdatedAt); err != nil {
		return domain.CampaignDetail{}, fmt.Errorf("insert campaign: %w", err)
	}
	camp.Status = domain.StatusDraft
	camp.DeadlineAt = input.DeadlineAt
	camp.TargetCreators = camp.TargetCreatorsCount
	camp.Deadline = camp.DeadlineAt

	platformID, err := resolvePlatformID(ctx, tx, input.Requirements.PlatformID)
	if err != nil {
		return domain.CampaignDetail{}, fmt.Errorf("resolve platform: %w", err)
	}
	categoryID, err := resolveCategoryID(ctx, tx, input.Requirements.CategoryID)
	if err != nil {
		return domain.CampaignDetail{}, fmt.Errorf("resolve category: %w", err)
	}

	var req domain.CampaignRequirements
	req.CampaignID = camp.ID
	req.CategoryID = categoryID
	req.PlatformID = platformID
	req.MinFollowers = input.Requirements.MinFollowers
	req.MinEngagementBps = input.Requirements.MinEngagementBps
	req.DeliverableFormat = input.Requirements.DeliverableFormat

	reqRow := tx.QueryRow(ctx, `
		INSERT INTO campaign_requirements (
			campaign_id, category_id, platform_id,
			min_followers, min_engagement_bps, deliverable_format
		) VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`, camp.ID, categoryID, platformID,
		input.Requirements.MinFollowers, input.Requirements.MinEngagementBps,
		string(input.Requirements.DeliverableFormat),
	)
	if err := reqRow.Scan(&req.ID, &req.CreatedAt); err != nil {
		return domain.CampaignDetail{}, fmt.Errorf("insert campaign requirements: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO campaign_events (
			campaign_id, actor_user_id, from_status, to_status, note
		) VALUES ($1, $2, $3, $4, $5)
	`, camp.ID, clientUserID, "", string(domain.StatusDraft), "Campaign draft created")
	if err != nil {
		return domain.CampaignDetail{}, fmt.Errorf("insert initial campaign event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.CampaignDetail{}, fmt.Errorf("commit tx: %w", err)
	}

	return domain.CampaignDetail{
		Campaign:     camp,
		Requirements: req,
		Invitations:  []domain.CampaignInvitation{},
		Events: []domain.CampaignEvent{
			{
				CampaignID:  camp.ID,
				ActorUserID: clientUserID,
				FromStatus:  "",
				ToStatus:    string(domain.StatusDraft),
				Note:        "Campaign draft created",
				CreatedAt:   camp.CreatedAt,
			},
		},
	}, nil
}

func (r *PostgresRepository) UpdateCampaign(ctx context.Context, campaignID string, clientUserID string, input domain.UpdateCampaignInput) (domain.CampaignDetail, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.CampaignDetail{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var currentStatus string
	err = tx.QueryRow(ctx, `
		SELECT status FROM campaigns
		WHERE id = $1 AND client_user_id = $2
		FOR UPDATE
	`, campaignID, clientUserID).Scan(&currentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.CampaignDetail{}, domain.ErrNotFound
		}
		return domain.CampaignDetail{}, fmt.Errorf("query campaign for update: %w", err)
	}

	if currentStatus != string(domain.StatusDraft) {
		return domain.CampaignDetail{}, fmt.Errorf("%w: only draft campaigns can be updated", domain.ErrInvalidTransition)
	}

	vis := input.Visibility
	if vis == "" {
		vis = domain.VisibilityPublic
	}

	res, err := tx.Exec(ctx, `
		UPDATE campaigns SET
			title = $1,
			description = $2,
			objective = $3,
			budget_minor = $4,
			currency = $5,
			target_creators_count = $6,
			deadline_at = $7,
			visibility = $8,
			updated_at = now()
		WHERE id = $9 AND client_user_id = $10
	`, input.Title, input.Description, string(input.Objective),
		input.BudgetMinor, input.Currency, input.TargetCreatorsCount,
		input.DeadlineAt, string(vis), campaignID, clientUserID,
	)
	if err != nil {
		return domain.CampaignDetail{}, fmt.Errorf("update campaign: %w", err)
	}
	if res.RowsAffected() == 0 {
		return domain.CampaignDetail{}, domain.ErrNotFound
	}

	platformID, err := resolvePlatformID(ctx, tx, input.Requirements.PlatformID)
	if err != nil {
		return domain.CampaignDetail{}, fmt.Errorf("resolve platform: %w", err)
	}
	categoryID, err := resolveCategoryID(ctx, tx, input.Requirements.CategoryID)
	if err != nil {
		return domain.CampaignDetail{}, fmt.Errorf("resolve category: %w", err)
	}

	_, err = tx.Exec(ctx, `
		UPDATE campaign_requirements SET
			category_id = $1,
			platform_id = $2,
			min_followers = $3,
			min_engagement_bps = $4,
			deliverable_format = $5
		WHERE campaign_id = $6
	`, categoryID, platformID,
		input.Requirements.MinFollowers, input.Requirements.MinEngagementBps,
		string(input.Requirements.DeliverableFormat), campaignID,
	)
	if err != nil {
		return domain.CampaignDetail{}, fmt.Errorf("update campaign requirements: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.CampaignDetail{}, fmt.Errorf("commit tx: %w", err)
	}

	return r.GetCampaignByID(ctx, campaignID)
}

func (r *PostgresRepository) GetCampaignByID(ctx context.Context, campaignID string) (domain.CampaignDetail, error) {
	var detail domain.CampaignDetail
	var obj string
	var status string
	var visibility string

	err := r.pool.QueryRow(ctx, `
		SELECT
			c.id, c.client_user_id, COALESCE(u.display_name, ''),
			c.title, c.description, c.objective,
			c.budget_minor, c.currency, c.target_creators_count,
			c.deadline_at, c.status, c.visibility, c.created_at, c.updated_at
		FROM campaigns c
		JOIN users u ON u.id = c.client_user_id
		WHERE c.id = $1
	`, campaignID).Scan(
		&detail.Campaign.ID,
		&detail.Campaign.ClientUserID,
		&detail.Campaign.ClientDisplayName,
		&detail.Campaign.Title,
		&detail.Campaign.Description,
		&obj,
		&detail.Campaign.BudgetMinor,
		&detail.Campaign.Currency,
		&detail.Campaign.TargetCreatorsCount,
		&detail.Campaign.DeadlineAt,
		&status,
		&visibility,
		&detail.Campaign.CreatedAt,
		&detail.Campaign.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.CampaignDetail{}, domain.ErrNotFound
		}
		return domain.CampaignDetail{}, fmt.Errorf("query campaign: %w", err)
	}
	detail.Campaign.Objective = domain.CampaignObjective(obj)
	detail.Campaign.Status = domain.CampaignStatus(status)
	detail.Campaign.Visibility = domain.CampaignVisibility(visibility)
	detail.Campaign.TargetCreators = detail.Campaign.TargetCreatorsCount
	detail.Campaign.Deadline = detail.Campaign.DeadlineAt
	detail.Campaign.ClientName = detail.Campaign.ClientDisplayName

	// Requirements
	var format string
	err = r.pool.QueryRow(ctx, `
		SELECT
			cr.id, cr.campaign_id, cr.category_id, COALESCE(cat.name_en, ''),
			cr.platform_id, COALESCE(p.name, ''),
			cr.min_followers, cr.min_engagement_bps, cr.deliverable_format,
			cr.created_at
		FROM campaign_requirements cr
		LEFT JOIN categories cat ON cat.id = cr.category_id
		LEFT JOIN platforms p ON p.id = cr.platform_id
		WHERE cr.campaign_id = $1
	`, campaignID).Scan(
		&detail.Requirements.ID,
		&detail.Requirements.CampaignID,
		&detail.Requirements.CategoryID,
		&detail.Requirements.CategoryName,
		&detail.Requirements.PlatformID,
		&detail.Requirements.PlatformName,
		&detail.Requirements.MinFollowers,
		&detail.Requirements.MinEngagementBps,
		&format,
		&detail.Requirements.CreatedAt,
	)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return domain.CampaignDetail{}, fmt.Errorf("query campaign requirements: %w", err)
	}
	detail.Requirements.DeliverableFormat = domain.DeliverableFormat(format)

	// Invitations
	invRows, err := r.pool.Query(ctx, `
		SELECT
			ci.id, ci.campaign_id, ci.creator_user_id,
			COALESCE(u.display_name, ''), COALESCE(cp.slug, ''),
			ci.offered_fee_minor, ci.currency, ci.status,
			COALESCE(ci.pitch_note, ''), ci.responded_at,
			ci.created_at, ci.updated_at
		FROM campaign_invitations ci
		JOIN users u ON u.id = ci.creator_user_id
		LEFT JOIN creator_profiles cp ON cp.user_id = ci.creator_user_id
		WHERE ci.campaign_id = $1
		ORDER BY ci.created_at DESC
	`, campaignID)
	if err != nil {
		return domain.CampaignDetail{}, fmt.Errorf("query invitations: %w", err)
	}
	defer invRows.Close()

	detail.Invitations = []domain.CampaignInvitation{}
	for invRows.Next() {
		var inv domain.CampaignInvitation
		var invStatus string
		if err := invRows.Scan(
			&inv.ID, &inv.CampaignID, &inv.CreatorUserID,
			&inv.CreatorDisplayName, &inv.CreatorSlug,
			&inv.OfferedFeeMinor, &inv.Currency, &invStatus,
			&inv.PitchNote, &inv.RespondedAt,
			&inv.CreatedAt, &inv.UpdatedAt,
		); err != nil {
			return domain.CampaignDetail{}, fmt.Errorf("scan invitation: %w", err)
		}
		inv.Status = domain.InvitationStatus(invStatus)
		detail.Invitations = append(detail.Invitations, inv)
	}

	// Events
	eventRows, err := r.pool.Query(ctx, `
		SELECT
			ce.id, ce.campaign_id, ce.actor_user_id,
			COALESCE(u.display_name, ''),
			ce.from_status, ce.to_status, ce.note, ce.created_at
		FROM campaign_events ce
		JOIN users u ON u.id = ce.actor_user_id
		WHERE ce.campaign_id = $1
		ORDER BY ce.created_at ASC
	`, campaignID)
	if err != nil {
		return domain.CampaignDetail{}, fmt.Errorf("query campaign events: %w", err)
	}
	defer eventRows.Close()

	detail.Events = []domain.CampaignEvent{}
	for eventRows.Next() {
		var ev domain.CampaignEvent
		if err := eventRows.Scan(
			&ev.ID, &ev.CampaignID, &ev.ActorUserID,
			&ev.ActorName, &ev.FromStatus, &ev.ToStatus,
			&ev.Note, &ev.CreatedAt,
		); err != nil {
			return domain.CampaignDetail{}, fmt.Errorf("scan campaign event: %w", err)
		}
		detail.Events = append(detail.Events, ev)
	}

	return detail, nil
}

func (r *PostgresRepository) ListClientCampaigns(ctx context.Context, clientUserID string) ([]domain.Campaign, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
			c.id, c.client_user_id, COALESCE(u.display_name, ''),
			c.title, c.description, c.objective,
			c.budget_minor, c.currency, c.target_creators_count,
			c.deadline_at, c.status, c.visibility, c.created_at, c.updated_at
		FROM campaigns c
		JOIN users u ON u.id = c.client_user_id
		WHERE c.client_user_id = $1
		ORDER BY c.created_at DESC
	`, clientUserID)
	if err != nil {
		return nil, fmt.Errorf("query client campaigns: %w", err)
	}
	defer rows.Close()

	campaigns := []domain.Campaign{}
	for rows.Next() {
		var c domain.Campaign
		var obj string
		var status string
		var visibility string
		if err := rows.Scan(
			&c.ID, &c.ClientUserID, &c.ClientDisplayName,
			&c.Title, &c.Description, &obj,
			&c.BudgetMinor, &c.Currency, &c.TargetCreatorsCount,
			&c.DeadlineAt, &status, &visibility, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan client campaign: %w", err)
		}
		c.Objective = domain.CampaignObjective(obj)
		c.Status = domain.CampaignStatus(status)
		c.Visibility = domain.CampaignVisibility(visibility)
		c.TargetCreators = c.TargetCreatorsCount
		c.Deadline = c.DeadlineAt
		c.ClientName = c.ClientDisplayName
		campaigns = append(campaigns, c)
	}

	return campaigns, nil
}

func (r *PostgresRepository) FindMatchedCreators(ctx context.Context, campaignID string) ([]domain.MatchedCreator, error) {
	var req domain.CampaignRequirements
	var format string
	err := r.pool.QueryRow(ctx, `
		SELECT
			category_id, platform_id, min_followers,
			min_engagement_bps, deliverable_format
		FROM campaign_requirements
		WHERE campaign_id = $1
	`, campaignID).Scan(
		&req.CategoryID,
		&req.PlatformID,
		&req.MinFollowers,
		&req.MinEngagementBps,
		&format,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("query requirements for matching: %w", err)
	}

	query := `
		SELECT DISTINCT
			u.id, cp.slug, u.display_name, cp.headline, cp.bio,
			COALESCE(cat.name_en, ''),
			COALESCE(p.name, ''),
			COALESCE(sa.follower_count, 0),
			COALESCE(sa.engagement_bps, 0)
		FROM creator_profiles cp
		JOIN users u ON u.id = cp.user_id AND u.status = 'active'
		LEFT JOIN creator_categories cc ON cc.creator_user_id = cp.user_id
		LEFT JOIN categories cat ON cat.id = cc.category_id
		LEFT JOIN creator_social_accounts sa ON sa.creator_user_id = cp.user_id
		LEFT JOIN platforms p ON p.id = sa.platform_id
		WHERE cp.verification_status = 'verified'
		  AND NOT EXISTS (
			SELECT 1 FROM campaign_invitations ci
			WHERE ci.campaign_id = $1 AND ci.creator_user_id = cp.user_id
		  )
	`
	args := []any{campaignID}
	argIdx := 2

	if req.CategoryID != nil {
		query += fmt.Sprintf(" AND cc.category_id = $%d", argIdx)
		args = append(args, *req.CategoryID)
		argIdx++
	}

	if req.PlatformID != nil {
		query += fmt.Sprintf(" AND sa.platform_id = $%d", argIdx)
		args = append(args, *req.PlatformID)
		argIdx++
	}

	if req.MinFollowers > 0 {
		query += fmt.Sprintf(" AND COALESCE(sa.follower_count, 0) >= $%d", argIdx)
		args = append(args, req.MinFollowers)
		argIdx++
	}

	if req.MinEngagementBps > 0 {
		query += fmt.Sprintf(" AND COALESCE(sa.engagement_bps, 0) >= $%d", argIdx)
		args = append(args, req.MinEngagementBps)
		argIdx++
	}

	query += " ORDER BY COALESCE(sa.follower_count, 0) DESC LIMIT 50"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query matched creators: %w", err)
	}
	defer rows.Close()

	var matches []domain.MatchedCreator
	seen := make(map[string]bool)
	for rows.Next() {
		var m domain.MatchedCreator
		if err := rows.Scan(
			&m.UserID, &m.Slug, &m.DisplayName, &m.Headline, &m.Bio,
			&m.CategoryName, &m.PlatformName, &m.FollowerCount, &m.EngagementRateBps,
		); err != nil {
			return nil, fmt.Errorf("scan matched creator: %w", err)
		}
		m.CreatorUserID = m.UserID
		m.EngagementBps = m.EngagementRateBps
		m.EngagementRate = float64(m.EngagementRateBps) / 100.0
		m.MatchScore = 85
		if m.FollowerCount > 10000 {
			m.MatchScore += 5
		}
		if m.EngagementRateBps > 200 {
			m.MatchScore += 5
		}
		if m.MatchScore > 98 {
			m.MatchScore = 98
		}
		if !seen[m.UserID] {
			seen[m.UserID] = true
			matches = append(matches, m)
		}
	}

	return matches, nil
}

func (r *PostgresRepository) InviteCreator(ctx context.Context, campaignID string, clientUserID string, input domain.InviteCreatorInput) (domain.CampaignInvitation, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.CampaignInvitation{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var campStatus string
	var ownerID string
	err = tx.QueryRow(ctx, `
		SELECT status, client_user_id FROM campaigns
		WHERE id = $1
		FOR UPDATE
	`, campaignID).Scan(&campStatus, &ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.CampaignInvitation{}, domain.ErrNotFound
		}
		return domain.CampaignInvitation{}, fmt.Errorf("lock campaign for invite: %w", err)
	}

	if ownerID != clientUserID {
		return domain.CampaignInvitation{}, domain.ErrForbidden
	}

	if campStatus != string(domain.StatusActive) {
		return domain.CampaignInvitation{}, domain.ErrCampaignNotActive
	}

	if clientUserID == input.CreatorUserID {
		return domain.CampaignInvitation{}, domain.ErrSelfInviteForbidden
	}

	var creatorVerified bool
	err = tx.QueryRow(ctx, `
		SELECT (verification_status = 'verified')
		FROM creator_profiles
		WHERE user_id = $1
	`, input.CreatorUserID).Scan(&creatorVerified)
	if err != nil || !creatorVerified {
		return domain.CampaignInvitation{}, fmt.Errorf("%w: target creator is not verified", domain.ErrValidation)
	}

	var inv domain.CampaignInvitation
	inv.CampaignID = campaignID
	inv.CreatorUserID = input.CreatorUserID
	inv.OfferedFeeMinor = input.OfferedFeeMinor
	inv.Currency = input.Currency
	inv.Status = domain.InvitationInvited

	err = tx.QueryRow(ctx, `
		INSERT INTO campaign_invitations (
			campaign_id, creator_user_id, offered_fee_minor, currency, status
		) VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`, campaignID, input.CreatorUserID, input.OfferedFeeMinor, input.Currency, string(domain.InvitationInvited),
	).Scan(&inv.ID, &inv.CreatedAt, &inv.UpdatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			return domain.CampaignInvitation{}, domain.ErrDuplicateInvitation
		}
		return domain.CampaignInvitation{}, fmt.Errorf("insert invitation: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.CampaignInvitation{}, fmt.Errorf("commit tx: %w", err)
	}

	return inv, nil
}

func (r *PostgresRepository) RespondInvitation(ctx context.Context, invitationID string, creatorUserID string, input domain.RespondInvitationInput) (domain.CampaignInvitation, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.CampaignInvitation{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var currentStatus string
	var targetCreatorID string
	err = tx.QueryRow(ctx, `
		SELECT status, creator_user_id
		FROM campaign_invitations
		WHERE id = $1
		FOR UPDATE
	`, invitationID).Scan(&currentStatus, &targetCreatorID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.CampaignInvitation{}, domain.ErrNotFound
		}
		return domain.CampaignInvitation{}, fmt.Errorf("lock invitation: %w", err)
	}

	if targetCreatorID != creatorUserID {
		return domain.CampaignInvitation{}, domain.ErrForbidden
	}

	if currentStatus != string(domain.InvitationInvited) {
		return domain.CampaignInvitation{}, fmt.Errorf("%w: invitation is not in invited state", domain.ErrInvalidTransition)
	}

	var inv domain.CampaignInvitation
	var st string
	err = tx.QueryRow(ctx, `
		UPDATE campaign_invitations SET
			status = $1,
			pitch_note = $2,
			responded_at = now(),
			updated_at = now()
		WHERE id = $3
		RETURNING id, campaign_id, creator_user_id, offered_fee_minor, currency, status, pitch_note, responded_at, created_at, updated_at
	`, string(input.Status), input.PitchNote, invitationID).Scan(
		&inv.ID, &inv.CampaignID, &inv.CreatorUserID,
		&inv.OfferedFeeMinor, &inv.Currency, &st,
		&inv.PitchNote, &inv.RespondedAt,
		&inv.CreatedAt, &inv.UpdatedAt,
	)
	if err != nil {
		return domain.CampaignInvitation{}, fmt.Errorf("update invitation response: %w", err)
	}
	inv.Status = domain.InvitationStatus(st)

	if err := tx.Commit(ctx); err != nil {
		return domain.CampaignInvitation{}, fmt.Errorf("commit tx: %w", err)
	}

	return inv, nil
}

func (r *PostgresRepository) SelectCreator(ctx context.Context, campaignID string, invitationID string, clientUserID string, note string) (domain.CampaignInvitation, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.CampaignInvitation{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var ownerID string
	var campStatus string
	err = tx.QueryRow(ctx, `
		SELECT client_user_id, status FROM campaigns
		WHERE id = $1
		FOR UPDATE
	`, campaignID).Scan(&ownerID, &campStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.CampaignInvitation{}, domain.ErrNotFound
		}
		return domain.CampaignInvitation{}, fmt.Errorf("lock campaign: %w", err)
	}

	if ownerID != clientUserID {
		return domain.CampaignInvitation{}, domain.ErrForbidden
	}

	if campStatus != string(domain.StatusActive) {
		return domain.CampaignInvitation{}, fmt.Errorf("%w: campaign is not active", domain.ErrInvalidTransition)
	}

	var invStatus string
	var invCampID string
	err = tx.QueryRow(ctx, `
		SELECT status, campaign_id FROM campaign_invitations
		WHERE id = $1
		FOR UPDATE
	`, invitationID).Scan(&invStatus, &invCampID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.CampaignInvitation{}, domain.ErrNotFound
		}
		return domain.CampaignInvitation{}, fmt.Errorf("lock invitation: %w", err)
	}

	if invCampID != campaignID {
		return domain.CampaignInvitation{}, domain.ErrNotFound
	}

	if invStatus != string(domain.InvitationAccepted) && invStatus != string(domain.InvitationApplied) {
		return domain.CampaignInvitation{}, fmt.Errorf("%w: creator has not accepted the invitation or applied", domain.ErrInvalidTransition)
	}

	var inv domain.CampaignInvitation
	var st string
	err = tx.QueryRow(ctx, `
		UPDATE campaign_invitations SET
			status = $1,
			updated_at = now()
		WHERE id = $2
		RETURNING id, campaign_id, creator_user_id, offered_fee_minor, currency, status, COALESCE(pitch_note, ''), responded_at, created_at, updated_at
	`, string(domain.InvitationSelected), invitationID).Scan(
		&inv.ID, &inv.CampaignID, &inv.CreatorUserID,
		&inv.OfferedFeeMinor, &inv.Currency, &st,
		&inv.PitchNote, &inv.RespondedAt,
		&inv.CreatedAt, &inv.UpdatedAt,
	)
	if err != nil {
		return domain.CampaignInvitation{}, fmt.Errorf("select invitation: %w", err)
	}
	inv.Status = domain.InvitationStatus(st)

	actionNote := fmt.Sprintf("Creator selected for campaign participation. Note: %s", note)
	_, _ = tx.Exec(ctx, `
		INSERT INTO campaign_events (
			campaign_id, actor_user_id, from_status, to_status, note
		) VALUES ($1, $2, $3, $4, $5)
	`, campaignID, clientUserID, string(domain.StatusActive), string(domain.StatusActive), actionNote)

	if err := tx.Commit(ctx); err != nil {
		return domain.CampaignInvitation{}, fmt.Errorf("commit tx: %w", err)
	}

	return inv, nil
}

func (r *PostgresRepository) ListCreatorInvitations(ctx context.Context, creatorUserID string) ([]domain.CampaignInvitation, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
			ci.id, ci.campaign_id, ci.creator_user_id,
			COALESCE(u.display_name, ''), COALESCE(cp.slug, ''),
			c.title, ci.offered_fee_minor, ci.currency,
			ci.status, COALESCE(ci.pitch_note, ''), ci.responded_at,
			ci.created_at, ci.updated_at
		FROM campaign_invitations ci
		JOIN campaigns c ON c.id = ci.campaign_id
		JOIN users u ON u.id = ci.creator_user_id
		LEFT JOIN creator_profiles cp ON cp.user_id = ci.creator_user_id
		WHERE ci.creator_user_id = $1
		ORDER BY ci.created_at DESC
	`, creatorUserID)
	if err != nil {
		return nil, fmt.Errorf("query creator invitations: %w", err)
	}
	defer rows.Close()

	var invitations []domain.CampaignInvitation
	for rows.Next() {
		var inv domain.CampaignInvitation
		var st string
		if err := rows.Scan(
			&inv.ID, &inv.CampaignID, &inv.CreatorUserID,
			&inv.CreatorDisplayName, &inv.CreatorSlug,
			&inv.CampaignTitle, &inv.OfferedFeeMinor, &inv.Currency,
			&st, &inv.PitchNote, &inv.RespondedAt,
			&inv.CreatedAt, &inv.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan creator invitation: %w", err)
		}
		inv.Status = domain.InvitationStatus(st)
		invitations = append(invitations, inv)
	}

	return invitations, nil
}

func (r *PostgresRepository) TransitionStatus(ctx context.Context, campaignID string, actorUserID string, fromStatus, toStatus domain.CampaignStatus, note string) (domain.Campaign, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Campaign{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var currentStatus string
	err = tx.QueryRow(ctx, `
		SELECT status FROM campaigns
		WHERE id = $1
		FOR UPDATE
	`, campaignID).Scan(&currentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Campaign{}, domain.ErrNotFound
		}
		return domain.Campaign{}, fmt.Errorf("lock campaign for transition: %w", err)
	}

	if currentStatus != string(fromStatus) {
		return domain.Campaign{}, fmt.Errorf("%w: cannot transition from %s to %s", domain.ErrInvalidTransition, currentStatus, toStatus)
	}

	var camp domain.Campaign
	var obj string
	var st string
	err = tx.QueryRow(ctx, `
		UPDATE campaigns SET
			status = $1,
			updated_at = now()
		WHERE id = $2
		RETURNING
			id, client_user_id, title, description, objective,
			budget_minor, currency, target_creators_count,
			deadline_at, status, created_at, updated_at
	`, string(toStatus), campaignID).Scan(
		&camp.ID, &camp.ClientUserID, &camp.Title, &camp.Description,
		&obj, &camp.BudgetMinor, &camp.Currency, &camp.TargetCreatorsCount,
		&camp.DeadlineAt, &st, &camp.CreatedAt, &camp.UpdatedAt,
	)
	if err != nil {
		return domain.Campaign{}, fmt.Errorf("update campaign status: %w", err)
	}
	camp.Objective = domain.CampaignObjective(obj)
	camp.Status = domain.CampaignStatus(st)

	_, err = tx.Exec(ctx, `
		INSERT INTO campaign_events (
			campaign_id, actor_user_id, from_status, to_status, note
		) VALUES ($1, $2, $3, $4, $5)
	`, campaignID, actorUserID, string(fromStatus), string(toStatus), note)
	if err != nil {
		return domain.Campaign{}, fmt.Errorf("insert campaign event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Campaign{}, fmt.Errorf("commit tx: %w", err)
	}

	return camp, nil
}

func (r *PostgresRepository) ListPublicCampaigns(ctx context.Context, categoryID *string, search string, limit, offset int) ([]domain.Campaign, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	whereClauses := []string{"c.visibility = 'public'", "c.status = 'active'"}
	args := []any{}
	argIdx := 1

	if categoryID != nil && *categoryID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("cr.category_id = $%d", argIdx))
		args = append(args, *categoryID)
		argIdx++
	}

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(c.title ILIKE $%d OR c.description ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	countQuery := fmt.Sprintf(`
		SELECT COUNT(DISTINCT c.id)
		FROM campaigns c
		LEFT JOIN campaign_requirements cr ON cr.campaign_id = c.id
		WHERE %s
	`, whereSQL)

	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count public campaigns: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT DISTINCT
			c.id, c.client_user_id, COALESCE(u.display_name, ''),
			c.title, c.description, c.objective,
			c.budget_minor, c.currency, c.target_creators_count,
			c.deadline_at, c.status, c.visibility, c.created_at, c.updated_at
		FROM campaigns c
		JOIN users u ON u.id = c.client_user_id
		LEFT JOIN campaign_requirements cr ON cr.campaign_id = c.id
		WHERE %s
		ORDER BY c.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query public campaigns: %w", err)
	}
	defer rows.Close()

	campaigns := []domain.Campaign{}
	for rows.Next() {
		var c domain.Campaign
		var obj, status, visibility string
		if err := rows.Scan(
			&c.ID, &c.ClientUserID, &c.ClientDisplayName,
			&c.Title, &c.Description, &obj,
			&c.BudgetMinor, &c.Currency, &c.TargetCreatorsCount,
			&c.DeadlineAt, &status, &visibility, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan public campaign: %w", err)
		}
		c.Objective = domain.CampaignObjective(obj)
		c.Status = domain.CampaignStatus(status)
		c.Visibility = domain.CampaignVisibility(visibility)
		c.TargetCreators = c.TargetCreatorsCount
		c.Deadline = c.DeadlineAt
		c.ClientName = c.ClientDisplayName
		campaigns = append(campaigns, c)
	}

	return campaigns, total, nil
}

func (r *PostgresRepository) ApplyToCampaign(ctx context.Context, campaignID string, creatorUserID string, input domain.ApplyCampaignInput) (domain.CampaignInvitation, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.CampaignInvitation{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var campStatus, visibility, ownerID, campTitle, campCurrency string
	var budgetMinor int64
	err = tx.QueryRow(ctx, `
		SELECT status, visibility, client_user_id, title, currency, budget_minor
		FROM campaigns
		WHERE id = $1
		FOR UPDATE
	`, campaignID).Scan(&campStatus, &visibility, &ownerID, &campTitle, &campCurrency, &budgetMinor)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.CampaignInvitation{}, domain.ErrNotFound
		}
		return domain.CampaignInvitation{}, fmt.Errorf("lock campaign for apply: %w", err)
	}

	if campStatus != string(domain.StatusActive) {
		return domain.CampaignInvitation{}, domain.ErrCampaignNotActive
	}

	if visibility != string(domain.VisibilityPublic) {
		return domain.CampaignInvitation{}, domain.ErrCampaignNotPublic
	}

	if ownerID == creatorUserID {
		return domain.CampaignInvitation{}, domain.ErrSelfInviteForbidden
	}

	var exists bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM campaign_invitations
			WHERE campaign_id = $1 AND creator_user_id = $2
		)
	`, campaignID, creatorUserID).Scan(&exists)
	if err != nil {
		return domain.CampaignInvitation{}, fmt.Errorf("check existing application: %w", err)
	}
	if exists {
		return domain.CampaignInvitation{}, domain.ErrDuplicateInvitation
	}

	fee := input.ProposedFeeMinor
	if fee <= 0 {
		fee = budgetMinor
	}
	currency := input.Currency
	if currency == "" {
		currency = campCurrency
	}

	var inv domain.CampaignInvitation
	var st string
	err = tx.QueryRow(ctx, `
		INSERT INTO campaign_invitations (
			campaign_id, creator_user_id, status,
			offered_fee_minor, currency, pitch_note
		) VALUES ($1, $2, 'applied', $3, $4, $5)
		RETURNING id, campaign_id, creator_user_id, offered_fee_minor, currency, status, COALESCE(pitch_note, ''), created_at, updated_at
	`, campaignID, creatorUserID, fee, currency, input.PitchNote).Scan(
		&inv.ID, &inv.CampaignID, &inv.CreatorUserID,
		&inv.OfferedFeeMinor, &inv.Currency, &st,
		&inv.PitchNote, &inv.CreatedAt, &inv.UpdatedAt,
	)
	if err != nil {
		return domain.CampaignInvitation{}, fmt.Errorf("insert campaign application: %w", err)
	}
	inv.Status = domain.InvitationStatus(st)

	_, err = tx.Exec(ctx, `
		INSERT INTO campaign_events (
			campaign_id, actor_user_id, from_status, to_status, note
		) VALUES ($1, $2, '', 'applied', $3)
	`, campaignID, creatorUserID, fmt.Sprintf("Creator applied with proposed fee %d %s", fee, currency))
	if err != nil {
		return domain.CampaignInvitation{}, fmt.Errorf("record application event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.CampaignInvitation{}, fmt.Errorf("commit tx: %w", err)
	}

	inv.CampaignTitle = campTitle
	return inv, nil
}

var uuidRegex = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func resolvePlatformID(ctx context.Context, tx pgx.Tx, val *string) (*string, error) {
	if val == nil || *val == "" {
		return nil, nil
	}
	v := strings.TrimSpace(*val)
	var id string
	var err error
	if uuidRegex.MatchString(v) {
		err = tx.QueryRow(ctx, "SELECT id::text FROM platforms WHERE id = $1::uuid LIMIT 1", v).Scan(&id)
	} else {
		err = tx.QueryRow(ctx, "SELECT id::text FROM platforms WHERE code = $1 LIMIT 1", v).Scan(&id)
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &id, nil
}

func resolveCategoryID(ctx context.Context, tx pgx.Tx, val *string) (*string, error) {
	if val == nil || *val == "" {
		return nil, nil
	}
	v := strings.TrimSpace(*val)
	var id string
	var err error
	if uuidRegex.MatchString(v) {
		err = tx.QueryRow(ctx, "SELECT id::text FROM categories WHERE id = $1::uuid LIMIT 1", v).Scan(&id)
	} else {
		err = tx.QueryRow(ctx, "SELECT id::text FROM categories WHERE slug = $1 LIMIT 1", v).Scan(&id)
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &id, nil
}

