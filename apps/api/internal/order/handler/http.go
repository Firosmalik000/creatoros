package handler

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	authhandler "github.com/creatoros/platform/apps/api/internal/auth/handler"
	"github.com/creatoros/platform/apps/api/internal/order/domain"
	orderservice "github.com/creatoros/platform/apps/api/internal/order/service"
	"github.com/go-chi/chi/v5"
)

const maxRequestBytes = 1 << 20

type Middleware func(http.Handler) http.Handler

type Handler struct {
	service *orderservice.Service
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

type createOrderRequest struct {
	ServiceID    string `json:"service_id"`
	PackageID    string `json:"package_id"`
	BriefContent string `json:"brief_content"`
}

type noteRequest struct {
	Note string `json:"note"`
}

type briefRequest struct {
	Content string `json:"content"`
}

func New(service *orderservice.Service, logger *slog.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

func (h *Handler) Mount(router chi.Router, authenticate, requireCSRF Middleware) {
	router.Group(func(protected chi.Router) {
		protected.Use(authenticate)

		// Client order routes
		protected.Get("/orders", h.listClient)
		protected.With(requireCSRF).Post("/orders", h.create)
		protected.Get("/orders/{orderID}", h.getClient)
		protected.With(requireCSRF).Post("/orders/{orderID}/cancel", h.cancel)
		protected.With(requireCSRF).Post("/orders/{orderID}/briefs", h.submitBrief)

		// Creator order routes
		protected.Get("/creator/orders", h.listCreator)
		protected.Get("/creator/orders/{orderID}", h.getCreator)
		protected.With(requireCSRF).Post("/creator/orders/{orderID}/accept", h.accept)
		protected.With(requireCSRF).Post("/creator/orders/{orderID}/decline", h.decline)
	})
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req createOrderRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "The request body is invalid.")
		return
	}

	order, err := h.service.Create(r.Context(), actor(r), domain.CreateInput{
		ServiceID:    req.ServiceID,
		PackageID:    req.PackageID,
		BriefContent: req.BriefContent,
	})
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	writeJSON(w, http.StatusCreated, dataResponse{Data: order})
}

func (h *Handler) listClient(w http.ResponseWriter, r *http.Request) {
	orders, err := h.service.ListClient(r.Context(), actor(r))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: orders})
}

func (h *Handler) getClient(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderID")
	detail, err := h.service.GetClient(r.Context(), actor(r), orderID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: detail})
}

func (h *Handler) listCreator(w http.ResponseWriter, r *http.Request) {
	orders, err := h.service.ListCreator(r.Context(), actor(r))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: orders})
}

func (h *Handler) getCreator(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderID")
	detail, err := h.service.GetCreator(r.Context(), actor(r), orderID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: detail})
}

func (h *Handler) accept(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderID")
	var req noteRequest
	if r.Body != nil && r.ContentLength > 0 {
		_ = decodeJSON(w, r, &req)
	}

	order, err := h.service.Accept(r.Context(), actor(r), orderID, req.Note)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: order})
}

func (h *Handler) decline(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderID")
	var req noteRequest
	if r.Body != nil && r.ContentLength > 0 {
		_ = decodeJSON(w, r, &req)
	}

	order, err := h.service.Decline(r.Context(), actor(r), orderID, req.Note)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: order})
}

func (h *Handler) cancel(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderID")
	var req noteRequest
	if r.Body != nil && r.ContentLength > 0 {
		_ = decodeJSON(w, r, &req)
	}

	order, err := h.service.Cancel(r.Context(), actor(r), orderID, req.Note)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: order})
}

func (h *Handler) submitBrief(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderID")
	var req briefRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "The request body is invalid.")
		return
	}

	brief, err := h.service.SubmitBrief(r.Context(), actor(r), orderID, req.Content)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, dataResponse{Data: brief})
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, orderservice.ErrValidation):
		writeAPIError(w, http.StatusUnprocessableEntity, "validation_failed", err.Error())
	case errors.Is(err, orderservice.ErrForbidden):
		writeAPIError(w, http.StatusForbidden, "forbidden", "You cannot perform this action.")
	case errors.Is(err, orderservice.ErrNotFound):
		writeAPIError(w, http.StatusNotFound, "not_found", "The order was not found.")
	case errors.Is(err, orderservice.ErrConflict):
		writeAPIError(w, http.StatusConflict, "conflict", "The order state conflicts with the requested action.")
	case errors.Is(err, orderservice.ErrInvalidTransition):
		writeAPIError(w, http.StatusConflict, "invalid_transition", "The order cannot transition from its current state.")
	case errors.Is(err, orderservice.ErrSelfOrder):
		writeAPIError(w, http.StatusUnprocessableEntity, "self_order_forbidden", "You cannot order your own service.")
	default:
		h.logger.Error("order request failed", "method", r.Method, "path", r.URL.Path, "error", err)
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
