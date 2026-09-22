package handler

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/creatoros/platform/apps/api/internal/admin/domain"
	adminservice "github.com/creatoros/platform/apps/api/internal/admin/service"
	authhandler "github.com/creatoros/platform/apps/api/internal/auth/handler"
	"github.com/go-chi/chi/v5"
)

const maxRequestBytes = 1 << 20

type Middleware func(http.Handler) http.Handler

type Handler struct {
	service *adminservice.AdminService
	logger  *slog.Logger
}

type dataResponse struct {
	Data any `json:"data"`
}

type paginatedResponse struct {
	Data  any `json:"data"`
	Total int `json:"total"`
}

type errorResponse struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

type updateUserStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason"`
}

type updateUserRolesRequest struct {
	Roles []string `json:"roles"`
}

type resolveDisputeRequest struct {
	Resolution string `json:"resolution"`
	Notes      string `json:"notes"`
}

type createCategoryRequest struct {
	Slug      string `json:"slug"`
	NameID    string `json:"name_id"`
	NameEN    string `json:"name_en"`
	NameMS    string `json:"name_ms"`
	SortOrder int    `json:"sort_order"`
	IsActive  bool   `json:"is_active"`
}

type updateCategoryRequest struct {
	NameID    string `json:"name_id"`
	NameEN    string `json:"name_en"`
	NameMS    string `json:"name_ms"`
	SortOrder int    `json:"sort_order"`
	IsActive  bool   `json:"is_active"`
}

type createAnnouncementRequest struct {
	Title      string `json:"title"`
	Body       string `json:"body"`
	TargetRole string `json:"target_role"`
}

func New(service *adminservice.AdminService, logger *slog.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

func (h *Handler) Mount(router chi.Router, authenticate, requireCSRF Middleware) {
	router.Group(func(protected chi.Router) {
		protected.Use(authenticate)

		// Overview
		protected.Get("/admin/overview", h.getOverview)

		// Users
		protected.Get("/admin/users", h.listUsers)
		protected.Get("/admin/users/{userID}", h.getUser)
		protected.With(requireCSRF).Patch("/admin/users/{userID}/status", h.updateUserStatus)
		protected.With(requireCSRF).Put("/admin/users/{userID}/roles", h.updateUserRoles)

		// Orders & Campaigns Oversight
		protected.Get("/admin/orders", h.listOrders)
		protected.Get("/admin/campaigns", h.listCampaigns)

		// Disputes
		protected.Get("/admin/disputes", h.listDisputes)
		protected.With(requireCSRF).Post("/admin/disputes/{orderID}/resolve", h.resolveDispute)

		// Finance
		protected.Get("/admin/finance/overview", h.getFinanceOverview)

		// Categories
		protected.Get("/admin/categories", h.listCategories)
		protected.With(requireCSRF).Post("/admin/categories", h.createCategory)
		protected.With(requireCSRF).Put("/admin/categories/{categoryID}", h.updateCategory)

		// Audit Logs
		protected.Get("/admin/audit-logs", h.listAuditLogs)

		// Announcements
		protected.Get("/admin/announcements", h.listAnnouncements)
		protected.With(requireCSRF).Post("/admin/announcements", h.createAnnouncement)
	})
}

func (h *Handler) getOverview(w http.ResponseWriter, r *http.Request) {
	overview, err := h.service.GetOverview(r.Context(), actor(r))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: overview})
}

func (h *Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	role := r.URL.Query().Get("role")
	status := r.URL.Query().Get("status")
	search := r.URL.Query().Get("search")
	limit, offset := parseLimitOffset(r, 20, 100)

	users, total, err := h.service.ListUsers(r.Context(), actor(r), role, status, search, limit, offset)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, paginatedResponse{Data: users, Total: total})
}

func (h *Handler) getUser(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userID")
	user, err := h.service.GetUser(r.Context(), actor(r), userID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: user})
}

func (h *Handler) updateUserStatus(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userID")
	var req updateUserStatusRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	if err := h.service.SetUserStatus(r.Context(), actor(r), userID, req.Status, req.Reason); err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) updateUserRoles(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userID")
	var req updateUserRolesRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	if err := h.service.SetUserRoles(r.Context(), actor(r), userID, req.Roles); err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) listOrders(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	search := r.URL.Query().Get("search")
	limit, offset := parseLimitOffset(r, 20, 100)

	orders, total, err := h.service.ListOrders(r.Context(), actor(r), status, search, limit, offset)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, paginatedResponse{Data: orders, Total: total})
}

func (h *Handler) listCampaigns(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	search := r.URL.Query().Get("search")
	limit, offset := parseLimitOffset(r, 20, 100)

	campaigns, total, err := h.service.ListCampaigns(r.Context(), actor(r), status, search, limit, offset)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, paginatedResponse{Data: campaigns, Total: total})
}

func (h *Handler) listDisputes(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	limit, offset := parseLimitOffset(r, 20, 100)

	disputes, total, err := h.service.ListDisputes(r.Context(), actor(r), status, limit, offset)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, paginatedResponse{Data: disputes, Total: total})
}

func (h *Handler) resolveDispute(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderID")
	var req resolveDisputeRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	err := h.service.ResolveDispute(r.Context(), actor(r), orderID, domain.DisputeStatus(req.Resolution), req.Notes)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "resolved"})
}

func (h *Handler) getFinanceOverview(w http.ResponseWriter, r *http.Request) {
	summary, err := h.service.GetFinanceOverview(r.Context(), actor(r))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: summary})
}

func (h *Handler) listCategories(w http.ResponseWriter, r *http.Request) {
	cats, err := h.service.ListCategories(r.Context(), actor(r))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: cats})
}

func (h *Handler) createCategory(w http.ResponseWriter, r *http.Request) {
	var req createCategoryRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	cat := &domain.AdminCategory{
		Slug:      req.Slug,
		NameID:    req.NameID,
		NameEN:    req.NameEN,
		NameMS:    req.NameMS,
		SortOrder: req.SortOrder,
		IsActive:  req.IsActive,
	}

	if err := h.service.CreateCategory(r.Context(), actor(r), cat); err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, dataResponse{Data: cat})
}

func (h *Handler) updateCategory(w http.ResponseWriter, r *http.Request) {
	catID := chi.URLParam(r, "categoryID")
	var req updateCategoryRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	cat := &domain.AdminCategory{
		ID:        catID,
		NameID:    req.NameID,
		NameEN:    req.NameEN,
		NameMS:    req.NameMS,
		SortOrder: req.SortOrder,
		IsActive:  req.IsActive,
	}

	if err := h.service.UpdateCategory(r.Context(), actor(r), cat); err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: cat})
}

func (h *Handler) listAuditLogs(w http.ResponseWriter, r *http.Request) {
	action := r.URL.Query().Get("action")
	resType := r.URL.Query().Get("resource_type")
	limit, offset := parseLimitOffset(r, 20, 100)

	logs, total, err := h.service.ListAuditLogs(r.Context(), actor(r), action, resType, limit, offset)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, paginatedResponse{Data: logs, Total: total})
}

func (h *Handler) createAnnouncement(w http.ResponseWriter, r *http.Request) {
	var req createAnnouncementRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	ann := &domain.Announcement{
		Title:      req.Title,
		Body:       req.Body,
		TargetRole: req.TargetRole,
		IsActive:   true,
	}

	if err := h.service.CreateAnnouncement(r.Context(), actor(r), ann); err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, dataResponse{Data: ann})
}

func (h *Handler) listAnnouncements(w http.ResponseWriter, r *http.Request) {
	targetRole := r.URL.Query().Get("role")
	if targetRole == "" {
		targetRole = "all"
	}
	announcements, err := h.service.ListAnnouncements(r.Context(), actor(r), targetRole)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: announcements})
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, domain.ErrUnauthorized):
		writeAPIError(w, http.StatusForbidden, "forbidden", "admin authorization required")
	case errors.Is(err, domain.ErrUserNotFound):
		writeAPIError(w, http.StatusNotFound, "user_not_found", "user not found")
	case errors.Is(err, domain.ErrCannotModifySelf):
		writeAPIError(w, http.StatusBadRequest, "cannot_modify_self", "cannot perform this operation on your own account")
	case errors.Is(err, domain.ErrDisputeNotFound):
		writeAPIError(w, http.StatusNotFound, "dispute_not_found", "dispute not found")
	case errors.Is(err, domain.ErrDisputeAlreadyResolved):
		writeAPIError(w, http.StatusBadRequest, "dispute_already_resolved", "dispute has already been resolved")
	case errors.Is(err, domain.ErrCategoryNotFound):
		writeAPIError(w, http.StatusNotFound, "category_not_found", "category not found")
	case errors.Is(err, domain.ErrCategorySlugExists):
		writeAPIError(w, http.StatusConflict, "category_slug_exists", "category slug already exists")
	case errors.Is(err, domain.ErrInvalidStatus):
		writeAPIError(w, http.StatusBadRequest, "invalid_status", err.Error())
	default:
		h.logger.Error("admin internal error", "error", err, "path", r.URL.Path)
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "an internal error occurred")
	}
}

func actor(r *http.Request) domain.Actor {
	session, _ := authhandler.SessionFromContext(r.Context())
	ip := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		ip = forwarded
	}
	return domain.Actor{
		ID:          session.User.ID,
		Email:       session.User.Email,
		Roles:       session.User.Roles,
		Permissions: session.User.Permissions,
		IPAddress:   ip,
	}
}

func parseLimitOffset(r *http.Request, defaultLimit, maxLimit int) (int, int) {
	limit := defaultLimit
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
			if limit > maxLimit {
				limit = maxLimit
			}
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}
	return limit, offset
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
