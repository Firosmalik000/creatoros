package domain

import (
	"context"
	"errors"
	"time"
)

type CampaignStatus string

const (
	StatusDraft     CampaignStatus = "draft"
	StatusActive    CampaignStatus = "active"
	StatusCompleted CampaignStatus = "completed"
	StatusCancelled CampaignStatus = "cancelled"
)

type CampaignObjective string

const (
	ObjectiveBrandAwareness CampaignObjective = "brand_awareness"
	ObjectiveTraffic        CampaignObjective = "traffic"
	ObjectiveConversions    CampaignObjective = "conversions"
	ObjectiveUGCCreation    CampaignObjective = "ugc_creation"
)

type DeliverableFormat string

const (
	FormatVideo    DeliverableFormat = "video"
	FormatImage    DeliverableFormat = "image"
	FormatStory    DeliverableFormat = "story"
	FormatCarousel DeliverableFormat = "carousel"
	FormatMixed    DeliverableFormat = "mixed"
)

type CampaignVisibility string

const (
	VisibilityPublic  CampaignVisibility = "public"
	VisibilityPrivate CampaignVisibility = "private"
)

type InvitationStatus string

const (
	InvitationInvited  InvitationStatus = "invited"
	InvitationApplied  InvitationStatus = "applied"
	InvitationAccepted InvitationStatus = "accepted"
	InvitationDeclined InvitationStatus = "declined"
	InvitationSelected InvitationStatus = "selected"
	InvitationRejected InvitationStatus = "rejected"
)

type Actor struct {
	UserID      string
	Roles       []string
	Permissions []string
}

type Campaign struct {
	ID                  string             `json:"id"`
	ClientUserID        string             `json:"client_user_id"`
	ClientDisplayName   string             `json:"client_display_name,omitempty"`
	ClientName          string             `json:"client_name,omitempty"`
	Title               string             `json:"title"`
	Description         string             `json:"description"`
	Objective           CampaignObjective  `json:"objective"`
	BudgetMinor         int64              `json:"budget_minor"`
	Currency            string             `json:"currency"`
	TargetCreatorsCount int                `json:"target_creators_count"`
	TargetCreators      int                `json:"target_creators"`
	DeadlineAt          time.Time          `json:"deadline_at"`
	Deadline            time.Time          `json:"deadline"`
	Status              CampaignStatus     `json:"status"`
	Visibility          CampaignVisibility `json:"visibility"`
	CreatedAt           time.Time          `json:"created_at"`
	UpdatedAt           time.Time          `json:"updated_at"`
}

type CampaignRequirements struct {
	ID                string            `json:"id"`
	CampaignID        string            `json:"campaign_id"`
	CategoryID        *string           `json:"category_id,omitempty"`
	CategoryName      string            `json:"category_name,omitempty"`
	PlatformID        *string           `json:"platform_id,omitempty"`
	PlatformName      string            `json:"platform_name,omitempty"`
	MinFollowers      int               `json:"min_followers"`
	MinEngagementBps  int               `json:"min_engagement_bps"`
	DeliverableFormat DeliverableFormat `json:"deliverable_format"`
	CreatedAt         time.Time         `json:"created_at"`
}

type CampaignInvitation struct {
	ID                 string           `json:"id"`
	CampaignID         string           `json:"campaign_id"`
	CreatorUserID      string           `json:"creator_user_id"`
	CreatorDisplayName string           `json:"creator_display_name,omitempty"`
	CreatorSlug        string           `json:"creator_slug,omitempty"`
	CampaignTitle      string           `json:"campaign_title,omitempty"`
	OfferedFeeMinor    int64            `json:"offered_fee_minor"`
	Currency           string           `json:"currency"`
	Status             InvitationStatus `json:"status"`
	PitchNote          string           `json:"pitch_note,omitempty"`
	RespondedAt        *time.Time       `json:"responded_at,omitempty"`
	CreatedAt          time.Time        `json:"created_at"`
	UpdatedAt          time.Time        `json:"updated_at"`
}

type CampaignEvent struct {
	ID          string    `json:"id"`
	CampaignID  string    `json:"campaign_id"`
	ActorUserID string    `json:"actor_user_id"`
	ActorName   string    `json:"actor_name,omitempty"`
	FromStatus  string    `json:"from_status"`
	ToStatus    string    `json:"to_status"`
	Note        string    `json:"note"`
	CreatedAt   time.Time `json:"created_at"`
}

type MatchedCreator struct {
	UserID            string  `json:"user_id"`
	CreatorUserID     string  `json:"creator_user_id"`
	Slug              string  `json:"slug"`
	DisplayName       string  `json:"display_name"`
	Headline          string  `json:"headline"`
	Bio               string  `json:"bio"`
	AvatarURL         *string `json:"avatar_url,omitempty"`
	CategoryName      string  `json:"category_name,omitempty"`
	PlatformName      string  `json:"platform_name,omitempty"`
	FollowerCount     int64   `json:"follower_count"`
	EngagementRateBps int     `json:"engagement_rate_bps"`
	EngagementBps     int     `json:"engagement_bps"`
	EngagementRate    float64 `json:"engagement_rate"`
	MatchScore        int     `json:"match_score"`
}

type CampaignDetail struct {
	Campaign
	Requirements CampaignRequirements `json:"requirements"`
	Invitations  []CampaignInvitation `json:"invitations"`
	Events       []CampaignEvent      `json:"events"`
}

type RequirementsInput struct {
	CategoryID        *string           `json:"category_id"`
	PlatformID        *string           `json:"platform_id"`
	MinFollowers      int               `json:"min_followers"`
	MinEngagementBps  int               `json:"min_engagement_bps"`
	DeliverableFormat DeliverableFormat `json:"deliverable_format"`
}

type CreateCampaignInput struct {
	Title               string             `json:"title"`
	Description         string             `json:"description"`
	Objective           CampaignObjective  `json:"objective"`
	BudgetMinor         int64              `json:"budget_minor"`
	Currency            string             `json:"currency"`
	TargetCreatorsCount int                `json:"target_creators_count"`
	DeadlineAt          time.Time          `json:"deadline_at"`
	Visibility          CampaignVisibility `json:"visibility"`
	Requirements        RequirementsInput  `json:"requirements"`
}

type UpdateCampaignInput struct {
	Title               string             `json:"title"`
	Description         string             `json:"description"`
	Objective           CampaignObjective  `json:"objective"`
	BudgetMinor         int64              `json:"budget_minor"`
	Currency            string             `json:"currency"`
	TargetCreatorsCount int                `json:"target_creators_count"`
	DeadlineAt          time.Time          `json:"deadline_at"`
	Visibility          CampaignVisibility `json:"visibility"`
	Requirements        RequirementsInput  `json:"requirements"`
}

type InviteCreatorInput struct {
	CreatorUserID   string `json:"creator_user_id"`
	OfferedFeeMinor int64  `json:"offered_fee_minor"`
	Currency        string `json:"currency"`
}

type ApplyCampaignInput struct {
	PitchNote        string `json:"pitch_note"`
	ProposedFeeMinor int64  `json:"proposed_fee_minor"`
	Currency         string `json:"currency"`
}

type RespondInvitationInput struct {
	Status    InvitationStatus `json:"status"` // accepted or declined
	PitchNote string           `json:"pitch_note"`
}

type SelectCreatorInput struct {
	Note string `json:"note"`
}

type TransitionStatusInput struct {
	Status CampaignStatus `json:"status"`
	Note   string         `json:"note"`
}

var (
	ErrValidation          = errors.New("campaign validation failed")
	ErrForbidden           = errors.New("forbidden")
	ErrNotFound            = errors.New("campaign not found")
	ErrInvalidTransition   = errors.New("invalid campaign transition")
	ErrSelfInviteForbidden = errors.New("self invitation is forbidden")
	ErrDuplicateInvitation = errors.New("creator already invited or applied to this campaign")
	ErrCampaignNotActive   = errors.New("campaign is not active")
	ErrCampaignNotPublic   = errors.New("campaign is not open for public applications")
)

type Repository interface {
	CreateCampaign(ctx context.Context, clientUserID string, input CreateCampaignInput) (CampaignDetail, error)
	UpdateCampaign(ctx context.Context, campaignID string, clientUserID string, input UpdateCampaignInput) (CampaignDetail, error)
	GetCampaignByID(ctx context.Context, campaignID string) (CampaignDetail, error)
	ListClientCampaigns(ctx context.Context, clientUserID string) ([]Campaign, error)
	ListPublicCampaigns(ctx context.Context, categoryID *string, search string, limit, offset int) ([]Campaign, int, error)
	FindMatchedCreators(ctx context.Context, campaignID string) ([]MatchedCreator, error)
	InviteCreator(ctx context.Context, campaignID string, clientUserID string, input InviteCreatorInput) (CampaignInvitation, error)
	ApplyToCampaign(ctx context.Context, campaignID string, creatorUserID string, input ApplyCampaignInput) (CampaignInvitation, error)
	RespondInvitation(ctx context.Context, invitationID string, creatorUserID string, input RespondInvitationInput) (CampaignInvitation, error)
	SelectCreator(ctx context.Context, campaignID string, invitationID string, clientUserID string, note string) (CampaignInvitation, error)
	ListCreatorInvitations(ctx context.Context, creatorUserID string) ([]CampaignInvitation, error)
	TransitionStatus(ctx context.Context, campaignID string, actorUserID string, fromStatus, toStatus CampaignStatus, note string) (Campaign, error)
}
