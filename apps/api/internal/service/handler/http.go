package handler

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	authhandler "github.com/creatoros/platform/apps/api/internal/auth/handler"
	"github.com/creatoros/platform/apps/api/internal/service/domain"
	serviceservice "github.com/creatoros/platform/apps/api/internal/service/service"
	"github.com/go-chi/chi/v5"
)

const maxRequestBytes = 1 << 20

type Middleware func(http.Handler) http.Handler

type Handler struct {
	service *serviceservice.Service
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

type saveRequest struct {
	Slug        string           `json:"slug"`
	Title       string           `json:"title"`
	Description string           `json:"description"`
	Packages    []domain.Package `json:"packages"`
}

func New(service *serviceservice.Service, logger *slog.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

func (handler *Handler) Mount(router chi.Router, authenticate, requireCSRF Middleware) {
	router.Get("/creators/{creatorSlug}/services", handler.listPublic)
	router.Get("/creators/{creatorSlug}/services/{serviceSlug}", handler.publicDetail)
	router.Group(func(protected chi.Router) {
		protected.Use(authenticate)
		protected.Get("/creators/me/services", handler.listOwn)
		protected.Get("/creators/me/services/{serviceID}", handler.getOwn)
		protected.With(requireCSRF).Post("/creators/me/services", handler.create)
		protected.With(requireCSRF).Put("/creators/me/services/{serviceID}", handler.update)
		protected.With(requireCSRF).Post("/creators/me/services/{serviceID}/publish", handler.publish)
		protected.With(requireCSRF).Post("/creators/me/services/{serviceID}/unpublish", handler.unpublish)
	})
}

func (handler *Handler) listPublic(response http.ResponseWriter, request *http.Request) {
	items, err := handler.service.ListPublic(request.Context(), chi.URLParam(request, "creatorSlug"))
	if err != nil {
		handler.writeError(response, request, err)
		return
	}
	response.Header().Set("Cache-Control", "no-store")
	writeJSON(response, http.StatusOK, dataResponse{Data: items})
}

func (handler *Handler) publicDetail(response http.ResponseWriter, request *http.Request) {
	item, err := handler.service.PublicDetail(request.Context(), chi.URLParam(request, "creatorSlug"), chi.URLParam(request, "serviceSlug"))
	if err != nil {
		handler.writeError(response, request, err)
		return
	}
	response.Header().Set("Cache-Control", "no-store")
	writeJSON(response, http.StatusOK, dataResponse{Data: item})
}

func (handler *Handler) listOwn(response http.ResponseWriter, request *http.Request) {
	items, err := handler.service.ListOwn(request.Context(), actor(request))
	if err != nil {
		handler.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, dataResponse{Data: items})
}

func (handler *Handler) getOwn(response http.ResponseWriter, request *http.Request) {
	item, err := handler.service.GetOwn(request.Context(), actor(request), chi.URLParam(request, "serviceID"))
	if err != nil {
		handler.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, dataResponse{Data: item})
}

func (handler *Handler) create(response http.ResponseWriter, request *http.Request) {
	input, ok := decodeSave(response, request)
	if !ok {
		return
	}
	item, err := handler.service.Create(request.Context(), actor(request), input)
	if err != nil {
		handler.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusCreated, dataResponse{Data: item})
}

func (handler *Handler) update(response http.ResponseWriter, request *http.Request) {
	input, ok := decodeSave(response, request)
	if !ok {
		return
	}
	item, err := handler.service.Update(request.Context(), actor(request), chi.URLParam(request, "serviceID"), input)
	if err != nil {
		handler.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, dataResponse{Data: item})
}

func (handler *Handler) publish(response http.ResponseWriter, request *http.Request) {
	item, err := handler.service.Publish(request.Context(), actor(request), chi.URLParam(request, "serviceID"))
	if err != nil {
		handler.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, dataResponse{Data: item})
}

func (handler *Handler) unpublish(response http.ResponseWriter, request *http.Request) {
	item, err := handler.service.Unpublish(request.Context(), actor(request), chi.URLParam(request, "serviceID"))
	if err != nil {
		handler.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, dataResponse{Data: item})
}

func decodeSave(response http.ResponseWriter, request *http.Request) (domain.SaveInput, bool) {
	var input saveRequest
	if err := decodeJSON(response, request, &input); err != nil {
		writeAPIError(response, http.StatusBadRequest, "invalid_request", "The request body is invalid.")
		return domain.SaveInput{}, false
	}
	return domain.SaveInput{Slug: input.Slug, Title: input.Title, Description: input.Description, Packages: input.Packages}, true
}

func actor(request *http.Request) domain.Actor {
	session, _ := authhandler.SessionFromContext(request.Context())
	return domain.Actor{UserID: session.User.ID, Roles: session.User.Roles, Permissions: session.User.Permissions}
}

func (handler *Handler) writeError(response http.ResponseWriter, request *http.Request, err error) {
	switch {
	case errors.Is(err, serviceservice.ErrValidation):
		writeAPIError(response, http.StatusUnprocessableEntity, "validation_failed", "One or more service fields are invalid.")
	case errors.Is(err, serviceservice.ErrForbidden):
		writeAPIError(response, http.StatusForbidden, "forbidden", "You cannot manage this service.")
	case errors.Is(err, serviceservice.ErrNotFound):
		writeAPIError(response, http.StatusNotFound, "not_found", "The service was not found.")
	case errors.Is(err, serviceservice.ErrConflict):
		writeAPIError(response, http.StatusConflict, "slug_exists", "This service URL is already in use.")
	case errors.Is(err, serviceservice.ErrInvalidTransition):
		writeAPIError(response, http.StatusConflict, "invalid_transition", "Only verified creators with a complete service can publish.")
	default:
		handler.logger.Error("service request failed", "method", request.Method, "path", request.URL.Path, "error", err)
		writeAPIError(response, http.StatusInternalServerError, "internal_error", "The request could not be completed.")
	}
}

func decodeJSON(response http.ResponseWriter, request *http.Request, target any) error {
	request.Body = http.MaxBytesReader(response, request.Body, maxRequestBytes)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("request body must contain one JSON object")
	}
	return nil
}

func writeJSON(response http.ResponseWriter, status int, payload any) {
	response.Header().Set("Content-Type", "application/json")
	response.WriteHeader(status)
	_ = json.NewEncoder(response).Encode(payload)
}

func writeAPIError(response http.ResponseWriter, status int, code, message string) {
	payload := errorResponse{}
	payload.Error.Code, payload.Error.Message = code, message
	writeJSON(response, status, payload)
}
