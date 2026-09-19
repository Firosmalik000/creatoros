package handler

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"

	authhandler "github.com/creatoros/platform/apps/api/internal/auth/handler"
	"github.com/creatoros/platform/apps/api/internal/creator/domain"
	"github.com/creatoros/platform/apps/api/internal/creator/service"
	"github.com/go-chi/chi/v5"
)

const maxRequestBytes = 1 << 20

type Middleware func(http.Handler) http.Handler

type Handler struct {
	service *service.Service
	logger  *slog.Logger
}

type dataResponse struct {
	Data any `json:"data"`
	Meta any `json:"meta,omitempty"`
}

type errorBody struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

type errorResponse struct {
	Error errorBody `json:"error"`
}

type onboardingRequest struct {
	Slug           string                 `json:"slug"`
	Headline       string                 `json:"headline"`
	Bio            string                 `json:"bio"`
	City           string                 `json:"city"`
	CountryCode    string                 `json:"country_code"`
	CategoryCodes  []string               `json:"category_codes"`
	Languages      []string               `json:"languages"`
	SocialAccounts []domain.SocialAccount `json:"social_accounts"`
	Portfolio      []domain.PortfolioItem `json:"portfolio"`
}

func New(service *service.Service, logger *slog.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

func (handler *Handler) Mount(router chi.Router, authenticate, optionalAuthenticate, requireCSRF Middleware) {
	router.Get("/catalog/creator-options", handler.catalog)
	router.With(optionalAuthenticate).Get("/creators", handler.directory)
	router.Get("/creators/{slug}", handler.publicProfile)
	router.Group(func(protected chi.Router) {
		protected.Use(authenticate)
		protected.Get("/creators/me/onboarding", handler.getOnboarding)
		protected.With(requireCSRF).Put("/creators/me/onboarding", handler.saveOnboarding)
		protected.With(requireCSRF).Post("/creators/me/verification-submissions", handler.submitVerification)
		protected.Get("/me/favorites", handler.favorites)
		protected.With(requireCSRF).Post("/me/favorites/{slug}", handler.addFavorite)
		protected.With(requireCSRF).Delete("/me/favorites/{slug}", handler.removeFavorite)
		protected.Get("/admin/creator-verifications", handler.verificationQueue)
		protected.Get("/admin/creator-verifications/{userID}", handler.reviewProfile)
		protected.With(requireCSRF).Post("/admin/creator-verifications/{userID}/decisions", handler.reviewVerification)
	})
}

func (handler *Handler) directory(response http.ResponseWriter, request *http.Request) {
	response.Header().Set("Cache-Control", "private, no-store")
	page, _ := strconv.Atoi(request.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(request.URL.Query().Get("per_page"))
	filters := domain.DirectoryFilters{
		Query: request.URL.Query().Get("q"), Category: request.URL.Query().Get("category"),
		Language: request.URL.Query().Get("language"), CountryCode: request.URL.Query().Get("country"),
		Sort: request.URL.Query().Get("sort"), Page: page, PerPage: perPage,
	}
	viewerID := ""
	if session, ok := authhandler.SessionFromContext(request.Context()); ok {
		viewerID = session.User.ID
	}
	result, err := handler.service.Directory(request.Context(), filters, request.URL.Query().Get("locale"), viewerID)
	if err != nil {
		handler.writeServiceError(response, request, err)
		return
	}
	if filters.Page < 1 {
		filters.Page = 1
	}
	if filters.PerPage < 1 || filters.PerPage > 48 {
		filters.PerPage = 24
	}
	writeJSON(response, http.StatusOK, dataResponse{Data: result.Items, Meta: map[string]int{
		"page": filters.Page, "per_page": filters.PerPage, "total": result.Total,
	}})
}

func (handler *Handler) favorites(response http.ResponseWriter, request *http.Request) {
	page, _ := strconv.Atoi(request.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(request.URL.Query().Get("per_page"))
	result, err := handler.service.Favorites(request.Context(), actor(request), domain.DirectoryFilters{
		Query: request.URL.Query().Get("q"), Category: request.URL.Query().Get("category"),
		Language: request.URL.Query().Get("language"), CountryCode: request.URL.Query().Get("country"),
		Sort: request.URL.Query().Get("sort"), Page: page, PerPage: perPage,
	}, request.URL.Query().Get("locale"))
	if err != nil {
		handler.writeServiceError(response, request, err)
		return
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 48 {
		perPage = 24
	}
	writeJSON(response, http.StatusOK, dataResponse{Data: result.Items, Meta: map[string]int{"page": page, "per_page": perPage, "total": result.Total}})
}

func (handler *Handler) addFavorite(response http.ResponseWriter, request *http.Request) {
	if err := handler.service.AddFavorite(request.Context(), actor(request), chi.URLParam(request, "slug")); err != nil {
		handler.writeServiceError(response, request, err)
		return
	}
	response.WriteHeader(http.StatusNoContent)
}

func (handler *Handler) removeFavorite(response http.ResponseWriter, request *http.Request) {
	if err := handler.service.RemoveFavorite(request.Context(), actor(request), chi.URLParam(request, "slug")); err != nil {
		handler.writeServiceError(response, request, err)
		return
	}
	response.WriteHeader(http.StatusNoContent)
}

func (handler *Handler) catalog(response http.ResponseWriter, request *http.Request) {
	locale := request.URL.Query().Get("locale")
	if locale != "" && locale != "id" && locale != "en" && locale != "ms" {
		writeError(response, http.StatusUnprocessableEntity, "validation_failed", "The locale is invalid.", nil)
		return
	}
	platforms, categories, err := handler.service.Catalog(request.Context(), locale)
	if err != nil {
		handler.internal(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, dataResponse{Data: map[string]any{"platforms": platforms, "categories": categories}})
}

func (handler *Handler) publicProfile(response http.ResponseWriter, request *http.Request) {
	profile, err := handler.service.PublicProfile(request.Context(), chi.URLParam(request, "slug"), request.URL.Query().Get("locale"))
	if err != nil {
		handler.writeServiceError(response, request, err)
		return
	}
	response.Header().Set("Cache-Control", "no-store")
	writeJSON(response, http.StatusOK, dataResponse{Data: profile})
}

func (handler *Handler) getOnboarding(response http.ResponseWriter, request *http.Request) {
	result, err := handler.service.GetOnboarding(request.Context(), actor(request), request.URL.Query().Get("locale"))
	if err != nil {
		handler.writeServiceError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, dataResponse{Data: result})
}

func (handler *Handler) saveOnboarding(response http.ResponseWriter, request *http.Request) {
	var input onboardingRequest
	if err := decodeJSON(response, request, &input); err != nil {
		writeError(response, http.StatusBadRequest, "invalid_request", "The request body is invalid.", nil)
		return
	}
	result, err := handler.service.SaveOnboarding(request.Context(), actor(request), domain.SaveInput{
		Slug: input.Slug, Headline: input.Headline, Bio: input.Bio, City: input.City,
		CountryCode: input.CountryCode, CategoryCodes: input.CategoryCodes, Languages: input.Languages,
		SocialAccounts: input.SocialAccounts, Portfolio: input.Portfolio,
	}, request.URL.Query().Get("locale"))
	if err != nil {
		handler.writeServiceError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, dataResponse{Data: result})
}

func (handler *Handler) submitVerification(response http.ResponseWriter, request *http.Request) {
	result, err := handler.service.Submit(request.Context(), actor(request), request.URL.Query().Get("locale"))
	if err != nil {
		if errors.Is(err, service.ErrIncomplete) {
			writeError(response, http.StatusUnprocessableEntity, "profile_incomplete", "The creator profile is incomplete.", map[string]any{"missing_fields": result.MissingFields})
			return
		}
		handler.writeServiceError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, dataResponse{Data: result})
}

func (handler *Handler) verificationQueue(response http.ResponseWriter, request *http.Request) {
	page, _ := strconv.Atoi(request.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(request.URL.Query().Get("per_page"))
	items, total, err := handler.service.VerificationQueue(request.Context(), actor(request), request.URL.Query().Get("status"), page, perPage)
	if err != nil {
		handler.writeServiceError(response, request, err)
		return
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	writeJSON(response, http.StatusOK, dataResponse{Data: items, Meta: map[string]int{"page": page, "per_page": perPage, "total": total}})
}

func (handler *Handler) reviewProfile(response http.ResponseWriter, request *http.Request) {
	result, err := handler.service.ReviewProfile(request.Context(), actor(request), chi.URLParam(request, "userID"), request.URL.Query().Get("locale"))
	if err != nil {
		handler.writeServiceError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, dataResponse{Data: result})
}

func (handler *Handler) reviewVerification(response http.ResponseWriter, request *http.Request) {
	var input struct {
		Decision string `json:"decision"`
		Note     string `json:"note"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		writeError(response, http.StatusBadRequest, "invalid_request", "The request body is invalid.", nil)
		return
	}
	result, err := handler.service.Review(request.Context(), actor(request), chi.URLParam(request, "userID"), input.Decision, input.Note, request.URL.Query().Get("locale"))
	if err != nil {
		handler.writeServiceError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, dataResponse{Data: result})
}

func actor(request *http.Request) domain.Actor {
	session, _ := authhandler.SessionFromContext(request.Context())
	return domain.Actor{UserID: session.User.ID, Roles: session.User.Roles, Permissions: session.User.Permissions}
}

func (handler *Handler) writeServiceError(response http.ResponseWriter, request *http.Request, err error) {
	switch {
	case errors.Is(err, service.ErrValidation):
		writeError(response, http.StatusUnprocessableEntity, "validation_failed", "One or more fields are invalid.", nil)
	case errors.Is(err, service.ErrForbidden):
		writeError(response, http.StatusForbidden, "forbidden", "You cannot perform this action.", nil)
	case errors.Is(err, service.ErrNotFound):
		writeError(response, http.StatusNotFound, "not_found", "The creator profile was not found.", nil)
	case errors.Is(err, service.ErrConflict):
		writeError(response, http.StatusConflict, "slug_exists", "This creator URL is already in use.", nil)
	case errors.Is(err, service.ErrInvalidTransition):
		writeError(response, http.StatusConflict, "invalid_transition", "The verification status cannot be changed this way.", nil)
	default:
		handler.internal(response, request, err)
	}
}

func (handler *Handler) internal(response http.ResponseWriter, request *http.Request, err error) {
	handler.logger.Error("creator request failed", "method", request.Method, "path", request.URL.Path, "error", err)
	writeError(response, http.StatusInternalServerError, "internal_error", "The request could not be completed.", nil)
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

func writeError(response http.ResponseWriter, status int, code, message string, details map[string]any) {
	writeJSON(response, status, errorResponse{Error: errorBody{Code: code, Message: message, Details: details}})
}
