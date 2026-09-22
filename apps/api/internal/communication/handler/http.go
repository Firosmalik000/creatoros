package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	authhandler "github.com/creatoros/platform/apps/api/internal/auth/handler"
	"github.com/creatoros/platform/apps/api/internal/communication/domain"
	communicationservice "github.com/creatoros/platform/apps/api/internal/communication/service"
	"github.com/go-chi/chi/v5"
)

const maxRequestBytes = 1 << 20

type Middleware func(http.Handler) http.Handler

type Handler struct {
	service *communicationservice.Service
	logger  *slog.Logger
}

type dataResponse struct {
	Data any `json:"data"`
}

type paginatedResponse struct {
	Data  any   `json:"data"`
	Total int64 `json:"total"`
}

type unreadCountResponse struct {
	Count int64 `json:"count"`
}

type errorResponse struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

type sendMessageRequest struct {
	Body string `json:"body"`
}

type updatePreferencesRequest struct {
	EmailNotifications *bool `json:"email_notifications,omitempty"`
	OrderUpdates       *bool `json:"order_updates,omitempty"`
	Messages           *bool `json:"messages,omitempty"`
}

func New(service *communicationservice.Service, logger *slog.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

func (h *Handler) Mount(router chi.Router, authenticate, requireCSRF Middleware) {
	router.Group(func(protected chi.Router) {
		protected.Use(authenticate)

		// Messaging & Threads
		protected.Get("/orders/{orderID}/thread", h.getOrderThread)
		protected.Get("/threads/{threadID}/messages", h.listThreadMessages)
		protected.With(requireCSRF).Post("/threads/{threadID}/messages", h.sendMessage)

		// Notifications
		protected.Get("/notifications", h.listNotifications)
		protected.Get("/notifications/unread-count", h.getUnreadCount)
		protected.With(requireCSRF).Post("/notifications/{notificationID}/read", h.markNotificationRead)
		protected.With(requireCSRF).Post("/notifications/read-all", h.markAllNotificationsRead)

		// Preferences
		protected.Get("/user/notification-preferences", h.getPreferences)
		protected.With(requireCSRF).Put("/user/notification-preferences", h.updatePreferences)

		// Realtime SSE stream
		protected.Get("/communication/notifications/stream", h.streamNotifications)
	})
}

func (h *Handler) getOrderThread(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderID")
	thread, err := h.service.GetOrderThread(r.Context(), actor(r), orderID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: thread})
}

func (h *Handler) listThreadMessages(w http.ResponseWriter, r *http.Request) {
	threadID := chi.URLParam(r, "threadID")
	var since *time.Time
	if sinceStr := r.URL.Query().Get("since"); sinceStr != "" {
		if t, err := time.Parse(time.RFC3339, sinceStr); err == nil {
			since = &t
		}
	}
	limit := 50
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	messages, err := h.service.ListThreadMessages(r.Context(), actor(r), threadID, since, limit)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: messages})
}

func (h *Handler) sendMessage(w http.ResponseWriter, r *http.Request) {
	threadID := chi.URLParam(r, "threadID")
	var req sendMessageRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "The request body is invalid.")
		return
	}

	msg, err := h.service.SendMessage(r.Context(), actor(r), threadID, domain.SendMessageInput{
		Body: req.Body,
	})
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, dataResponse{Data: msg})
}

func (h *Handler) listNotifications(w http.ResponseWriter, r *http.Request) {
	unreadOnly := r.URL.Query().Get("unread_only") == "true"
	limit := 20
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}
	offset := 0
	if oStr := r.URL.Query().Get("offset"); oStr != "" {
		if o, err := strconv.Atoi(oStr); err == nil && o >= 0 {
			offset = o
		}
	}

	notifications, total, err := h.service.ListNotifications(r.Context(), actor(r), unreadOnly, limit, offset)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, paginatedResponse{Data: notifications, Total: total})
}

func (h *Handler) getUnreadCount(w http.ResponseWriter, r *http.Request) {
	count, err := h.service.GetUnreadCount(r.Context(), actor(r))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: unreadCountResponse{Count: count}})
}

func (h *Handler) markNotificationRead(w http.ResponseWriter, r *http.Request) {
	notificationID := chi.URLParam(r, "notificationID")
	err := h.service.MarkNotificationRead(r.Context(), actor(r), notificationID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) markAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	err := h.service.MarkAllNotificationsRead(r.Context(), actor(r))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) getPreferences(w http.ResponseWriter, r *http.Request) {
	prefs, err := h.service.GetNotificationPreferences(r.Context(), actor(r))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: prefs})
}

func (h *Handler) updatePreferences(w http.ResponseWriter, r *http.Request) {
	var req updatePreferencesRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "The request body is invalid.")
		return
	}

	prefs, err := h.service.UpdateNotificationPreferences(r.Context(), actor(r), domain.UpdatePreferencesInput{
		EmailNotifications: req.EmailNotifications,
		OrderUpdates:       req.OrderUpdates,
		Messages:           req.Messages,
	})
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: prefs})
}

func (h *Handler) streamNotifications(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "Streaming unsupported.")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ctx := r.Context()
	currentActor := actor(r)

	// Send initial count event
	count, _ := h.service.GetUnreadCount(ctx, currentActor)
	_, _ = fmt.Fprintf(w, "event: unread_count\ndata: {\"count\": %d}\n\n", count)
	flusher.Flush()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			currentCount, err := h.service.GetUnreadCount(ctx, currentActor)
			if err != nil {
				return
			}
			_, _ = fmt.Fprintf(w, "event: unread_count\ndata: {\"count\": %d}\n\n", currentCount)
			flusher.Flush()
		}
	}
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, domain.ErrThreadNotFound), errors.Is(err, domain.ErrNotificationNotFound):
		writeAPIError(w, http.StatusNotFound, "not_found", "The requested resource was not found.")
	case errors.Is(err, domain.ErrForbidden), errors.Is(err, domain.ErrNotParticipant):
		writeAPIError(w, http.StatusForbidden, "forbidden", "You do not have permission to access this resource.")
	case errors.Is(err, domain.ErrEmptyMessage):
		writeAPIError(w, http.StatusBadRequest, "empty_message", "Message content cannot be empty.")
	case errors.Is(err, domain.ErrMessageTooLong):
		writeAPIError(w, http.StatusBadRequest, "message_too_long", "Message content exceeds maximum allowed length.")
	case errors.Is(err, domain.ErrInvalidRequest):
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "Invalid request parameters.")
	default:
		h.logger.Error("communication request failed", "method", r.Method, "path", r.URL.Path, "error", err)
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
