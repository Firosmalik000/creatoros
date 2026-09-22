package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	authhandler "github.com/creatoros/platform/apps/api/internal/auth/handler"
	"github.com/creatoros/platform/apps/api/internal/campaign/domain"
	campaignservice "github.com/creatoros/platform/apps/api/internal/campaign/service"
	"github.com/go-chi/chi/v5"
)

const maxRequestBytes = 1 << 20

type Middleware func(http.Handler) http.Handler

type Handler struct {
	service *campaignservice.Service
	logger  *slog.Logger
}

type dataResponse struct {
	Data any `json:"data"`
}

type errorResponse struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

type campaignRequirementInputPayload struct {
	CategoryID        *string                  `json:"category_id"`
	PlatformID        *string                  `json:"platform_id"`
	MinFollowers      int                      `json:"min_followers"`
	MinEngagementBps  int                      `json:"min_engagement_bps"`
	MinEngagementRate float64                  `json:"min_engagement_rate"`
	DeliverableFormat domain.DeliverableFormat `json:"deliverable_format"`
	DeliverableType   string                   `json:"deliverable_type"`
}

type campaignRequestPayload struct {
	Title               string                    `json:"title"`
	Description         string                    `json:"description"`
	Objective           domain.CampaignObjective  `json:"objective"`
	BudgetMinor         int64                     `json:"budget_minor"`
	Currency            string                    `json:"currency"`
	TargetCreatorsCount int                       `json:"target_creators_count"`
	TargetCreators      int                       `json:"target_creators"`
	DeadlineAt          *time.Time                `json:"deadline_at"`
	Deadline            *time.Time                `json:"deadline"`
	Visibility          domain.CampaignVisibility `json:"visibility"`
	Requirements        json.RawMessage           `json:"requirements"`
}

func parseRequirementsInput(raw json.RawMessage) domain.RequirementsInput {
	if len(raw) == 0 || string(raw) == "null" {
		return domain.RequirementsInput{DeliverableFormat: domain.FormatVideo}
	}
	var p campaignRequirementInputPayload
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) > 0 && trimmed[0] == '[' {
		var list []campaignRequirementInputPayload
		if err := json.Unmarshal(raw, &list); err == nil && len(list) > 0 {
			p = list[0]
		}
	} else {
		_ = json.Unmarshal(raw, &p)
	}

	format := p.DeliverableFormat
	if format == "" && p.DeliverableType != "" {
		lowerType := strings.ToLower(p.DeliverableType)
		switch {
		case strings.Contains(lowerType, "video") || strings.Contains(lowerType, "reel") || strings.Contains(lowerType, "tiktok"):
			format = domain.FormatVideo
		case strings.Contains(lowerType, "image") || strings.Contains(lowerType, "photo"):
			format = domain.FormatImage
		case strings.Contains(lowerType, "story"):
			format = domain.FormatStory
		case strings.Contains(lowerType, "carousel"):
			format = domain.FormatCarousel
		default:
			format = domain.FormatVideo
		}
	}
	if format == "" {
		format = domain.FormatVideo
	}

	bps := p.MinEngagementBps
	if bps == 0 && p.MinEngagementRate > 0 {
		if p.MinEngagementRate <= 1.0 {
			bps = int(p.MinEngagementRate * 10000)
		} else {
			bps = int(p.MinEngagementRate * 100)
		}
	}

	return domain.RequirementsInput{
		CategoryID:        p.CategoryID,
		PlatformID:        p.PlatformID,
		MinFollowers:      p.MinFollowers,
		MinEngagementBps:  bps,
		DeliverableFormat: format,
	}
}

func (p campaignRequestPayload) toCreateInput() domain.CreateCampaignInput {
	obj := p.Objective
	if obj == "" {
		obj = domain.ObjectiveBrandAwareness
	}
	targetCount := p.TargetCreatorsCount
	if targetCount == 0 && p.TargetCreators > 0 {
		targetCount = p.TargetCreators
	}
	deadline := time.Time{}
	if p.DeadlineAt != nil {
		deadline = *p.DeadlineAt
	} else if p.Deadline != nil {
		deadline = *p.Deadline
	}
	vis := p.Visibility
	if vis == "" {
		vis = domain.VisibilityPublic
	}
	return domain.CreateCampaignInput{
		Title:               p.Title,
		Description:         p.Description,
		Objective:           obj,
		BudgetMinor:         p.BudgetMinor,
		Currency:            p.Currency,
		TargetCreatorsCount: targetCount,
		DeadlineAt:          deadline,
		Visibility:          vis,
		Requirements:        parseRequirementsInput(p.Requirements),
	}
}

func (p campaignRequestPayload) toUpdateInput() domain.UpdateCampaignInput {
	obj := p.Objective
	if obj == "" {
		obj = domain.ObjectiveBrandAwareness
	}
	targetCount := p.TargetCreatorsCount
	if targetCount == 0 && p.TargetCreators > 0 {
		targetCount = p.TargetCreators
	}
	deadline := time.Time{}
	if p.DeadlineAt != nil {
		deadline = *p.DeadlineAt
	} else if p.Deadline != nil {
		deadline = *p.Deadline
	}
	vis := p.Visibility
	if vis == "" {
		vis = domain.VisibilityPublic
	}
	return domain.UpdateCampaignInput{
		Title:               p.Title,
		Description:         p.Description,
		Objective:           obj,
		BudgetMinor:         p.BudgetMinor,
		Currency:            p.Currency,
		TargetCreatorsCount: targetCount,
		DeadlineAt:          deadline,
		Visibility:          vis,
		Requirements:        parseRequirementsInput(p.Requirements),
	}
}

type inviteCreatorRequest struct {
	CreatorUserID   string `json:"creator_user_id"`
	OfferedFeeMinor int64  `json:"offered_fee_minor"`
	Currency        string `json:"currency"`
}

type respondInvitationRequest struct {
	Status    domain.InvitationStatus `json:"status"`
	PitchNote string                  `json:"pitch_note"`
}

type noteActionRequest struct {
	Note string `json:"note"`
}

func New(service *campaignservice.Service, logger *slog.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

func (h *Handler) Mount(router chi.Router, authenticate, requireCSRF Middleware) {
	// Public routes
	router.Get("/campaigns/explore", h.explore)

	router.Group(func(protected chi.Router) {
		protected.Use(authenticate)

		// Client campaign routes
		protected.Get("/campaigns", h.listClient)
		protected.With(requireCSRF).Post("/campaigns", h.create)
		protected.Get("/campaigns/{campaignID}", h.get)
		protected.With(requireCSRF).Put("/campaigns/{campaignID}", h.update)
		protected.With(requireCSRF).Post("/campaigns/{campaignID}/publish", h.publish)
		protected.With(requireCSRF).Post("/campaigns/{campaignID}/cancel", h.cancel)
		protected.With(requireCSRF).Post("/campaigns/{campaignID}/complete", h.complete)
		protected.Get("/campaigns/{campaignID}/matches", h.matches)
		protected.With(requireCSRF).Post("/campaigns/{campaignID}/invitations", h.invite)
		protected.With(requireCSRF).Post("/campaigns/{campaignID}/invitations/{invitationID}/select", h.selectParticipant)

		// Creator campaign routes
		protected.Get("/creator/campaign-invitations", h.listCreatorInvitations)
		protected.With(requireCSRF).Post("/creator/campaign-invitations/{invitationID}/respond", h.respondInvitation)
		protected.With(requireCSRF).Post("/campaigns/{campaignID}/apply", h.apply)
	})
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req campaignRequestPayload
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "Malformed request body.")
		return
	}

	detail, err := h.service.CreateCampaign(r.Context(), actor(r), req.toCreateInput())
	if err != nil {
		h.writeDomainError(w, r, err)
		return
	}

	writeJSON(w, http.StatusCreated, dataResponse{Data: detail})
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	campaignID := chi.URLParam(r, "campaignID")
	var req campaignRequestPayload
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "Malformed request body.")
		return
	}

	detail, err := h.service.UpdateCampaign(r.Context(), actor(r), campaignID, req.toUpdateInput())
	if err != nil {
		h.writeDomainError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, dataResponse{Data: detail})
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	campaignID := chi.URLParam(r, "campaignID")
	detail, err := h.service.GetCampaign(r.Context(), actor(r), campaignID)
	if err != nil {
		h.writeDomainError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, dataResponse{Data: detail})
}

func (h *Handler) listClient(w http.ResponseWriter, r *http.Request) {
	campaigns, err := h.service.ListClientCampaigns(r.Context(), actor(r))
	if err != nil {
		h.writeDomainError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, dataResponse{Data: campaigns})
}

func (h *Handler) matches(w http.ResponseWriter, r *http.Request) {
	campaignID := chi.URLParam(r, "campaignID")
	creators, err := h.service.FindMatchedCreators(r.Context(), actor(r), campaignID)
	if err != nil {
		h.writeDomainError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, dataResponse{Data: creators})
}

func (h *Handler) invite(w http.ResponseWriter, r *http.Request) {
	campaignID := chi.URLParam(r, "campaignID")
	var req inviteCreatorRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "Malformed request body.")
		return
	}

	invitation, err := h.service.InviteCreator(r.Context(), actor(r), campaignID, domain.InviteCreatorInput{
		CreatorUserID:   req.CreatorUserID,
		OfferedFeeMinor: req.OfferedFeeMinor,
		Currency:        req.Currency,
	})
	if err != nil {
		h.writeDomainError(w, r, err)
		return
	}

	writeJSON(w, http.StatusCreated, dataResponse{Data: invitation})
}

func (h *Handler) selectParticipant(w http.ResponseWriter, r *http.Request) {
	campaignID := chi.URLParam(r, "campaignID")
	invitationID := chi.URLParam(r, "invitationID")

	var req noteActionRequest
	if r.Body != nil && r.ContentLength > 0 {
		_ = decodeJSON(w, r, &req)
	}

	invitation, err := h.service.SelectCreator(r.Context(), actor(r), campaignID, invitationID, req.Note)
	if err != nil {
		h.writeDomainError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, dataResponse{Data: invitation})
}

func (h *Handler) publish(w http.ResponseWriter, r *http.Request) {
	campaignID := chi.URLParam(r, "campaignID")
	var req noteActionRequest
	if r.Body != nil && r.ContentLength > 0 {
		_ = decodeJSON(w, r, &req)
	}

	camp, err := h.service.PublishCampaign(r.Context(), actor(r), campaignID, req.Note)
	if err != nil {
		h.writeDomainError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, dataResponse{Data: camp})
}

func (h *Handler) cancel(w http.ResponseWriter, r *http.Request) {
	campaignID := chi.URLParam(r, "campaignID")
	var req noteActionRequest
	if r.Body != nil && r.ContentLength > 0 {
		_ = decodeJSON(w, r, &req)
	}

	camp, err := h.service.CancelCampaign(r.Context(), actor(r), campaignID, req.Note)
	if err != nil {
		h.writeDomainError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, dataResponse{Data: camp})
}

func (h *Handler) complete(w http.ResponseWriter, r *http.Request) {
	campaignID := chi.URLParam(r, "campaignID")
	var req noteActionRequest
	if r.Body != nil && r.ContentLength > 0 {
		_ = decodeJSON(w, r, &req)
	}

	camp, err := h.service.CompleteCampaign(r.Context(), actor(r), campaignID, req.Note)
	if err != nil {
		h.writeDomainError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, dataResponse{Data: camp})
}

func (h *Handler) listCreatorInvitations(w http.ResponseWriter, r *http.Request) {
	invitations, err := h.service.ListCreatorInvitations(r.Context(), actor(r))
	if err != nil {
		h.writeDomainError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, dataResponse{Data: invitations})
}

func (h *Handler) respondInvitation(w http.ResponseWriter, r *http.Request) {
	invitationID := chi.URLParam(r, "invitationID")
	var req respondInvitationRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "Malformed request body.")
		return
	}

	invitation, err := h.service.RespondInvitation(r.Context(), actor(r), invitationID, domain.RespondInvitationInput{
		Status:    req.Status,
		PitchNote: req.PitchNote,
	})
	if err != nil {
		h.writeDomainError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, dataResponse{Data: invitation})
}

func (h *Handler) explore(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	var categoryID *string
	if cat := q.Get("category_id"); cat != "" {
		categoryID = &cat
	}
	search := q.Get("search")
	limit := 20
	if l := q.Get("limit"); l != "" {
		if val, err := strconv.Atoi(l); err == nil && val > 0 {
			limit = val
		}
	}
	offset := 0
	if o := q.Get("offset"); o != "" {
		if val, err := strconv.Atoi(o); err == nil && val >= 0 {
			offset = val
		}
	}

	campaigns, total, err := h.service.ListPublicCampaigns(r.Context(), categoryID, search, limit, offset)
	if err != nil {
		h.writeDomainError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"data": campaigns,
		"meta": map[string]any{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

type applyRequestPayload struct {
	PitchNote        string `json:"pitch_note"`
	ProposedFeeMinor int64  `json:"proposed_fee_minor"`
	Currency         string `json:"currency"`
}

func (h *Handler) apply(w http.ResponseWriter, r *http.Request) {
	campaignID := chi.URLParam(r, "campaignID")
	var req applyRequestPayload
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "Malformed request body.")
		return
	}

	inv, err := h.service.ApplyToCampaign(r.Context(), actor(r), campaignID, domain.ApplyCampaignInput{
		PitchNote:        req.PitchNote,
		ProposedFeeMinor: req.ProposedFeeMinor,
		Currency:         req.Currency,
	})
	if err != nil {
		h.writeDomainError(w, r, err)
		return
	}

	writeJSON(w, http.StatusCreated, dataResponse{Data: inv})
}

func (h *Handler) writeDomainError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, domain.ErrValidation):
		writeAPIError(w, http.StatusUnprocessableEntity, "validation_failed", err.Error())
	case errors.Is(err, domain.ErrForbidden):
		writeAPIError(w, http.StatusForbidden, "forbidden", "You do not have permission for this action.")
	case errors.Is(err, domain.ErrNotFound):
		writeAPIError(w, http.StatusNotFound, "not_found", "Campaign or invitation not found.")
	case errors.Is(err, domain.ErrInvalidTransition):
		writeAPIError(w, http.StatusConflict, "invalid_transition", err.Error())
	case errors.Is(err, domain.ErrSelfInviteForbidden):
		writeAPIError(w, http.StatusUnprocessableEntity, "self_invite_forbidden", "You cannot invite yourself to a campaign.")
	case errors.Is(err, domain.ErrDuplicateInvitation):
		writeAPIError(w, http.StatusConflict, "duplicate_invitation", "Creator has already been invited or applied to this campaign.")
	case errors.Is(err, domain.ErrCampaignNotActive):
		writeAPIError(w, http.StatusConflict, "campaign_not_active", "Campaign must be published and active to invite creators.")
	case errors.Is(err, domain.ErrCampaignNotPublic):
		writeAPIError(w, http.StatusBadRequest, "campaign_not_public", "Campaign is not open for public applications.")
	default:
		h.logger.Error("campaign request failed", "method", r.Method, "path", r.URL.Path, "error", err)
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "The request could not be completed.")
	}
}

func actor(r *http.Request) domain.Actor {
	session, _ := authhandler.SessionFromContext(r.Context())
	return domain.Actor{
		UserID:      session.User.ID,
		Roles:       session.User.Roles,
		Permissions: session.User.Permissions,
	}
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("request body must contain one JSON object")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeAPIError(w http.ResponseWriter, status int, code, message string) {
	payload := errorResponse{}
	payload.Error.Code, payload.Error.Message = code, message
	writeJSON(w, status, payload)
}
