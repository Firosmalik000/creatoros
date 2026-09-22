package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/creatoros/platform/apps/api/internal/campaign/domain"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type Service struct {
	repo domain.Repository
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo}
}

func hasAnyPermission(actor domain.Actor, codes ...string) bool {
	permSet := make(map[string]bool, len(actor.Permissions))
	for _, p := range actor.Permissions {
		permSet[p] = true
	}
	for _, code := range codes {
		if permSet[code] {
			return true
		}
	}
	return false
}

func hasAnyRole(actor domain.Actor, roles ...string) bool {
	roleSet := make(map[string]bool, len(actor.Roles))
	for _, r := range actor.Roles {
		roleSet[r] = true
	}
	for _, role := range roles {
		if roleSet[role] {
			return true
		}
	}
	return false
}

func validateCampaignBasics(title, description string, objective domain.CampaignObjective, budget int64, currency string, targetCount int, deadline time.Time) error {
	tLen := utf8.RuneCountInString(strings.TrimSpace(title))
	if tLen < 5 || tLen > 160 {
		return fmt.Errorf("%w: title must be between 5 and 160 characters", domain.ErrValidation)
	}

	dLen := utf8.RuneCountInString(strings.TrimSpace(description))
	if dLen < 20 || dLen > 5000 {
		return fmt.Errorf("%w: description must be between 20 and 5000 characters", domain.ErrValidation)
	}

	switch objective {
	case domain.ObjectiveBrandAwareness, domain.ObjectiveTraffic, domain.ObjectiveConversions, domain.ObjectiveUGCCreation:
	default:
		return fmt.Errorf("%w: invalid objective", domain.ErrValidation)
	}

	if budget <= 0 {
		return fmt.Errorf("%w: budget must be greater than 0", domain.ErrValidation)
	}

	curr := strings.ToUpper(strings.TrimSpace(currency))
	if curr != "IDR" && curr != "MYR" && curr != "USD" {
		return fmt.Errorf("%w: unsupported currency %s", domain.ErrValidation, currency)
	}

	if targetCount < 1 || targetCount > 100 {
		return fmt.Errorf("%w: target creators count must be between 1 and 100", domain.ErrValidation)
	}

	if !deadline.After(time.Now()) {
		return fmt.Errorf("%w: deadline must be in the future", domain.ErrValidation)
	}

	return nil
}

func validateRequirements(req *domain.RequirementsInput) error {
	if req == nil {
		return nil
	}
	if req.CategoryID != nil && *req.CategoryID != "" && !uuidPattern.MatchString(*req.CategoryID) {
		return fmt.Errorf("%w: invalid category_id", domain.ErrValidation)
	}
	if req.PlatformID != nil && *req.PlatformID != "" && !uuidPattern.MatchString(*req.PlatformID) {
		return fmt.Errorf("%w: invalid platform_id", domain.ErrValidation)
	}
	if req.MinFollowers < 0 {
		return fmt.Errorf("%w: min_followers cannot be negative", domain.ErrValidation)
	}
	if req.MinEngagementBps < 0 {
		return fmt.Errorf("%w: min_engagement_bps cannot be negative", domain.ErrValidation)
	}
	switch req.DeliverableFormat {
	case domain.FormatVideo, domain.FormatImage, domain.FormatStory, domain.FormatCarousel, domain.FormatMixed:
	case "":
		req.DeliverableFormat = domain.FormatVideo
	default:
		return fmt.Errorf("%w: invalid deliverable format", domain.ErrValidation)
	}
	return nil
}

func (s *Service) CreateCampaign(ctx context.Context, actor domain.Actor, input domain.CreateCampaignInput) (domain.CampaignDetail, error) {
	if !hasAnyPermission(actor, "campaigns.create", "campaigns.manage") && !hasAnyRole(actor, "client", "agency_admin") {
		return domain.CampaignDetail{}, domain.ErrForbidden
	}

	if err := validateCampaignBasics(input.Title, input.Description, input.Objective, input.BudgetMinor, input.Currency, input.TargetCreatorsCount, input.DeadlineAt); err != nil {
		return domain.CampaignDetail{}, err
	}

	if err := validateRequirements(&input.Requirements); err != nil {
		return domain.CampaignDetail{}, err
	}

	input.Currency = strings.ToUpper(strings.TrimSpace(input.Currency))
	input.Title = strings.TrimSpace(input.Title)
	input.Description = strings.TrimSpace(input.Description)

	return s.repo.CreateCampaign(ctx, actor.UserID, input)
}

func (s *Service) UpdateCampaign(ctx context.Context, actor domain.Actor, campaignID string, input domain.UpdateCampaignInput) (domain.CampaignDetail, error) {
	if !hasAnyPermission(actor, "campaigns.manage", "campaigns.create") && !hasAnyRole(actor, "client", "agency_admin") {
		return domain.CampaignDetail{}, domain.ErrForbidden
	}

	if !uuidPattern.MatchString(campaignID) {
		return domain.CampaignDetail{}, domain.ErrNotFound
	}

	if err := validateCampaignBasics(input.Title, input.Description, input.Objective, input.BudgetMinor, input.Currency, input.TargetCreatorsCount, input.DeadlineAt); err != nil {
		return domain.CampaignDetail{}, err
	}

	if err := validateRequirements(&input.Requirements); err != nil {
		return domain.CampaignDetail{}, err
	}

	input.Currency = strings.ToUpper(strings.TrimSpace(input.Currency))
	input.Title = strings.TrimSpace(input.Title)
	input.Description = strings.TrimSpace(input.Description)

	return s.repo.UpdateCampaign(ctx, campaignID, actor.UserID, input)
}

func (s *Service) GetCampaign(ctx context.Context, actor domain.Actor, campaignID string) (domain.CampaignDetail, error) {
	if !uuidPattern.MatchString(campaignID) {
		return domain.CampaignDetail{}, domain.ErrNotFound
	}

	detail, err := s.repo.GetCampaignByID(ctx, campaignID)
	if err != nil {
		return domain.CampaignDetail{}, err
	}

	// Client owner or agency admin can view all details
	if detail.Campaign.ClientUserID == actor.UserID || hasAnyRole(actor, "agency_admin") {
		return detail, nil
	}

	// Creators can view active campaigns if invited
	if hasAnyRole(actor, "creator") {
		for _, inv := range detail.Invitations {
			if inv.CreatorUserID == actor.UserID {
				return detail, nil
			}
		}
		if detail.Campaign.Status == domain.StatusActive {
			// Creators can view active campaign public details
			detail.Events = nil
			return detail, nil
		}
	}

	return domain.CampaignDetail{}, domain.ErrForbidden
}

func (s *Service) ListClientCampaigns(ctx context.Context, actor domain.Actor) ([]domain.Campaign, error) {
	if !hasAnyPermission(actor, "campaigns.create", "campaigns.manage") && !hasAnyRole(actor, "client", "agency_admin") {
		return nil, domain.ErrForbidden
	}

	return s.repo.ListClientCampaigns(ctx, actor.UserID)
}

func (s *Service) FindMatchedCreators(ctx context.Context, actor domain.Actor, campaignID string) ([]domain.MatchedCreator, error) {
	if !uuidPattern.MatchString(campaignID) {
		return nil, domain.ErrNotFound
	}

	detail, err := s.repo.GetCampaignByID(ctx, campaignID)
	if err != nil {
		return nil, err
	}

	if detail.Campaign.ClientUserID != actor.UserID && !hasAnyRole(actor, "agency_admin") {
		return nil, domain.ErrForbidden
	}

	return s.repo.FindMatchedCreators(ctx, campaignID)
}

func (s *Service) InviteCreator(ctx context.Context, actor domain.Actor, campaignID string, input domain.InviteCreatorInput) (domain.CampaignInvitation, error) {
	if !hasAnyPermission(actor, "campaigns.manage") && !hasAnyRole(actor, "client", "agency_admin") {
		return domain.CampaignInvitation{}, domain.ErrForbidden
	}

	if !uuidPattern.MatchString(campaignID) || !uuidPattern.MatchString(input.CreatorUserID) {
		return domain.CampaignInvitation{}, domain.ErrNotFound
	}

	if actor.UserID == input.CreatorUserID {
		return domain.CampaignInvitation{}, domain.ErrSelfInviteForbidden
	}

	input.Currency = strings.ToUpper(strings.TrimSpace(input.Currency))
	if input.Currency == "" {
		input.Currency = "IDR"
	}
	if input.Currency != "IDR" && input.Currency != "MYR" && input.Currency != "USD" {
		return domain.CampaignInvitation{}, fmt.Errorf("%w: invalid currency", domain.ErrValidation)
	}

	if input.OfferedFeeMinor < 0 {
		return domain.CampaignInvitation{}, fmt.Errorf("%w: fee cannot be negative", domain.ErrValidation)
	}

	return s.repo.InviteCreator(ctx, campaignID, actor.UserID, input)
}

func (s *Service) RespondInvitation(ctx context.Context, actor domain.Actor, invitationID string, input domain.RespondInvitationInput) (domain.CampaignInvitation, error) {
	if !hasAnyPermission(actor, "campaigns.respond") && !hasAnyRole(actor, "creator", "agency_admin") {
		return domain.CampaignInvitation{}, domain.ErrForbidden
	}

	if !uuidPattern.MatchString(invitationID) {
		return domain.CampaignInvitation{}, domain.ErrNotFound
	}

	if input.Status != domain.InvitationAccepted && input.Status != domain.InvitationDeclined {
		return domain.CampaignInvitation{}, fmt.Errorf("%w: status must be accepted or declined", domain.ErrValidation)
	}

	input.PitchNote = strings.TrimSpace(input.PitchNote)

	return s.repo.RespondInvitation(ctx, invitationID, actor.UserID, input)
}

func (s *Service) SelectCreator(ctx context.Context, actor domain.Actor, campaignID string, invitationID string, note string) (domain.CampaignInvitation, error) {
	if !hasAnyPermission(actor, "campaigns.manage") && !hasAnyRole(actor, "client", "agency_admin") {
		return domain.CampaignInvitation{}, domain.ErrForbidden
	}

	if !uuidPattern.MatchString(campaignID) || !uuidPattern.MatchString(invitationID) {
		return domain.CampaignInvitation{}, domain.ErrNotFound
	}

	return s.repo.SelectCreator(ctx, campaignID, invitationID, actor.UserID, strings.TrimSpace(note))
}

func (s *Service) ListCreatorInvitations(ctx context.Context, actor domain.Actor) ([]domain.CampaignInvitation, error) {
	if !hasAnyPermission(actor, "campaigns.respond") && !hasAnyRole(actor, "creator", "agency_admin") {
		return nil, domain.ErrForbidden
	}

	return s.repo.ListCreatorInvitations(ctx, actor.UserID)
}

func (s *Service) PublishCampaign(ctx context.Context, actor domain.Actor, campaignID string, note string) (domain.Campaign, error) {
	if !hasAnyPermission(actor, "campaigns.manage") && !hasAnyRole(actor, "client", "agency_admin") {
		return domain.Campaign{}, domain.ErrForbidden
	}

	if !uuidPattern.MatchString(campaignID) {
		return domain.Campaign{}, domain.ErrNotFound
	}

	detail, err := s.repo.GetCampaignByID(ctx, campaignID)
	if err != nil {
		return domain.Campaign{}, err
	}

	if detail.Campaign.ClientUserID != actor.UserID && !hasAnyRole(actor, "agency_admin") {
		return domain.Campaign{}, domain.ErrForbidden
	}

	if detail.Campaign.Status != domain.StatusDraft {
		return domain.Campaign{}, fmt.Errorf("%w: only draft campaigns can be published", domain.ErrInvalidTransition)
	}

	if note == "" {
		note = "Campaign activated and open for creator invitations"
	}

	return s.repo.TransitionStatus(ctx, campaignID, actor.UserID, domain.StatusDraft, domain.StatusActive, note)
}

func (s *Service) CancelCampaign(ctx context.Context, actor domain.Actor, campaignID string, note string) (domain.Campaign, error) {
	if !hasAnyPermission(actor, "campaigns.manage") && !hasAnyRole(actor, "client", "agency_admin") {
		return domain.Campaign{}, domain.ErrForbidden
	}

	if !uuidPattern.MatchString(campaignID) {
		return domain.Campaign{}, domain.ErrNotFound
	}

	detail, err := s.repo.GetCampaignByID(ctx, campaignID)
	if err != nil {
		return domain.Campaign{}, err
	}

	if detail.Campaign.ClientUserID != actor.UserID && !hasAnyRole(actor, "agency_admin") {
		return domain.Campaign{}, domain.ErrForbidden
	}

	if detail.Campaign.Status == domain.StatusCompleted || detail.Campaign.Status == domain.StatusCancelled {
		return domain.Campaign{}, fmt.Errorf("%w: cannot cancel finished campaign", domain.ErrInvalidTransition)
	}

	if note == "" {
		note = "Campaign cancelled by brand"
	}

	return s.repo.TransitionStatus(ctx, campaignID, actor.UserID, detail.Campaign.Status, domain.StatusCancelled, note)
}

func (s *Service) CompleteCampaign(ctx context.Context, actor domain.Actor, campaignID string, note string) (domain.Campaign, error) {
	if !hasAnyPermission(actor, "campaigns.manage") && !hasAnyRole(actor, "client", "agency_admin") {
		return domain.Campaign{}, domain.ErrForbidden
	}

	if !uuidPattern.MatchString(campaignID) {
		return domain.Campaign{}, domain.ErrNotFound
	}

	detail, err := s.repo.GetCampaignByID(ctx, campaignID)
	if err != nil {
		return domain.Campaign{}, err
	}

	if detail.Campaign.ClientUserID != actor.UserID && !hasAnyRole(actor, "agency_admin") {
		return domain.Campaign{}, domain.ErrForbidden
	}

	if detail.Campaign.Status != domain.StatusActive {
		return domain.Campaign{}, fmt.Errorf("%w: only active campaigns can be completed", domain.ErrInvalidTransition)
	}

	if note == "" {
		note = "Campaign marked as completed"
	}

	return s.repo.TransitionStatus(ctx, campaignID, actor.UserID, domain.StatusActive, domain.StatusCompleted, note)
}

func (s *Service) ListPublicCampaigns(ctx context.Context, categoryID *string, search string, limit, offset int) ([]domain.Campaign, int, error) {
	if categoryID != nil && *categoryID != "" && !uuidPattern.MatchString(*categoryID) {
		categoryID = nil
	}
	search = strings.TrimSpace(search)
	return s.repo.ListPublicCampaigns(ctx, categoryID, search, limit, offset)
}

func (s *Service) ApplyToCampaign(ctx context.Context, actor domain.Actor, campaignID string, input domain.ApplyCampaignInput) (domain.CampaignInvitation, error) {
	if !hasAnyRole(actor, "creator") && !hasAnyPermission(actor, "campaigns.respond") {
		return domain.CampaignInvitation{}, domain.ErrForbidden
	}

	if !uuidPattern.MatchString(campaignID) {
		return domain.CampaignInvitation{}, domain.ErrNotFound
	}

	input.PitchNote = strings.TrimSpace(input.PitchNote)
	if utf8.RuneCountInString(input.PitchNote) > 2000 {
		return domain.CampaignInvitation{}, fmt.Errorf("%w: pitch note cannot exceed 2000 characters", domain.ErrValidation)
	}

	return s.repo.ApplyToCampaign(ctx, campaignID, actor.UserID, input)
}

