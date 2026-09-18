package handler

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/creatoros/platform/apps/api/internal/auth/domain"
	"github.com/creatoros/platform/apps/api/internal/auth/service"
	"github.com/go-chi/chi/v5"
)

const (
	sessionCookieName = "creatoros_session"
	csrfCookieName    = "creatoros_csrf"
	csrfHeaderName    = "X-CSRF-Token"
	maxRequestBytes   = 1 << 20
)

type contextKey string

const authContextKey contextKey = "creatoros-auth"

type authContext struct {
	Session      domain.Session
	SessionToken string
}

type Handler struct {
	service      *service.Service
	logger       *slog.Logger
	environment  string
	cookieSecure bool
	limiter      RateLimiter
}

type RateLimiter interface {
	Allow(context.Context, string, int64, time.Duration) (bool, time.Duration, error)
}

type Options struct {
	Environment  string
	CookieSecure bool
	RateLimiter  RateLimiter
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

func New(service *service.Service, logger *slog.Logger, options Options) *Handler {
	return &Handler{
		service: service, logger: logger, environment: options.Environment,
		cookieSecure: options.CookieSecure, limiter: options.RateLimiter,
	}
}

func (handler *Handler) Mount(router chi.Router) {
	router.Route("/auth", func(auth chi.Router) {
		auth.Post("/register", handler.register)
		auth.Post("/verify-email", handler.verifyEmail)
		auth.Post("/login", handler.login)
		auth.Post("/forgot-password", handler.forgotPassword)
		auth.Post("/reset-password", handler.resetPassword)
	})

	router.Group(func(protected chi.Router) {
		protected.Use(handler.authenticate)
		protected.Get("/auth/me", handler.me)
		protected.With(handler.requireCSRF).Post("/auth/logout", handler.logout)
		protected.With(handler.requireCSRF).Patch("/users/me/settings", handler.updateSettings)
	})
}

func (handler *Handler) register(response http.ResponseWriter, request *http.Request) {
	if !handler.checkRateLimit(response, request, "register:network", requestIP(request), 100, time.Hour) {
		return
	}
	var input struct {
		Email           string `json:"email"`
		Password        string `json:"password"`
		DisplayName     string `json:"display_name"`
		PreferredLocale string `json:"preferred_locale"`
		Role            string `json:"role"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		writeError(response, http.StatusBadRequest, "invalid_request", "The request body is invalid.", nil)
		return
	}
	if !handler.checkRateLimit(response, request, "register:account", strings.ToLower(strings.TrimSpace(input.Email)), 5, time.Hour) {
		return
	}

	result, err := handler.service.Register(request.Context(), service.RegisterInput{
		Email:           input.Email,
		Password:        input.Password,
		DisplayName:     input.DisplayName,
		PreferredLocale: input.PreferredLocale,
		Role:            input.Role,
	})
	if err != nil {
		handler.writeServiceError(response, request, err)
		return
	}

	var meta any
	if handler.exposesDevelopmentTokens() {
		meta = map[string]string{"verification_token": result.VerificationToken}
	}
	writeJSON(response, http.StatusCreated, dataResponse{Data: result.User, Meta: meta})
}

func (handler *Handler) verifyEmail(response http.ResponseWriter, request *http.Request) {
	if !handler.checkRateLimit(response, request, "verify:network", requestIP(request), 500, 10*time.Minute) {
		return
	}
	var input struct {
		Token string `json:"token"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		writeError(response, http.StatusBadRequest, "invalid_request", "The request body is invalid.", nil)
		return
	}
	if !handler.checkRateLimit(response, request, "verify:token", input.Token, 5, 10*time.Minute) {
		return
	}
	user, err := handler.service.VerifyEmail(request.Context(), input.Token)
	if err != nil {
		handler.writeServiceError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, dataResponse{Data: user})
}

func (handler *Handler) login(response http.ResponseWriter, request *http.Request) {
	if !handler.checkRateLimit(response, request, "login:network", requestIP(request), 500, 10*time.Minute) {
		return
	}
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		writeError(response, http.StatusBadRequest, "invalid_request", "The request body is invalid.", nil)
		return
	}
	if !handler.checkRateLimit(response, request, "login:account", strings.ToLower(strings.TrimSpace(input.Email)), 10, 10*time.Minute) {
		return
	}
	result, err := handler.service.Login(request.Context(), input.Email, input.Password)
	if err != nil {
		handler.writeServiceError(response, request, err)
		return
	}

	handler.setAuthCookies(response, result.SessionToken, result.CSRFToken, result.ExpiresAt)
	writeJSON(response, http.StatusOK, dataResponse{
		Data: result.User,
		Meta: map[string]string{"csrf_token": result.CSRFToken},
	})
}

func (handler *Handler) forgotPassword(response http.ResponseWriter, request *http.Request) {
	if !handler.checkRateLimit(response, request, "forgot:network", requestIP(request), 100, time.Hour) {
		return
	}
	var input struct {
		Email string `json:"email"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		writeError(response, http.StatusBadRequest, "invalid_request", "The request body is invalid.", nil)
		return
	}
	if !handler.checkRateLimit(response, request, "forgot:account", strings.ToLower(strings.TrimSpace(input.Email)), 5, time.Hour) {
		return
	}
	result, err := handler.service.ForgotPassword(request.Context(), input.Email)
	if err != nil {
		handler.writeServiceError(response, request, err)
		return
	}

	var meta any
	if handler.exposesDevelopmentTokens() && result.Issued {
		meta = map[string]string{"reset_token": result.Token}
	}
	writeJSON(response, http.StatusAccepted, dataResponse{
		Data: map[string]bool{"accepted": true},
		Meta: meta,
	})
}

func (handler *Handler) resetPassword(response http.ResponseWriter, request *http.Request) {
	if !handler.checkRateLimit(response, request, "reset:network", requestIP(request), 200, time.Hour) {
		return
	}
	var input struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		writeError(response, http.StatusBadRequest, "invalid_request", "The request body is invalid.", nil)
		return
	}
	if !handler.checkRateLimit(response, request, "reset:token", input.Token, 5, time.Hour) {
		return
	}
	if err := handler.service.ResetPassword(request.Context(), input.Token, input.Password); err != nil {
		handler.writeServiceError(response, request, err)
		return
	}
	response.WriteHeader(http.StatusNoContent)
}

func (handler *Handler) me(response http.ResponseWriter, request *http.Request) {
	authentication := request.Context().Value(authContextKey).(authContext)
	writeJSON(response, http.StatusOK, dataResponse{Data: authentication.Session.User})
}

func (handler *Handler) logout(response http.ResponseWriter, request *http.Request) {
	authentication := request.Context().Value(authContextKey).(authContext)
	if err := handler.service.Logout(request.Context(), authentication.SessionToken); err != nil {
		handler.writeServiceError(response, request, err)
		return
	}
	handler.clearAuthCookies(response)
	response.WriteHeader(http.StatusNoContent)
}

func (handler *Handler) updateSettings(response http.ResponseWriter, request *http.Request) {
	var input struct {
		PreferredLocale string `json:"preferred_locale"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		writeError(response, http.StatusBadRequest, "invalid_request", "The request body is invalid.", nil)
		return
	}
	authentication := request.Context().Value(authContextKey).(authContext)
	user, err := handler.service.UpdateLocale(request.Context(), authentication.Session.User.ID, input.PreferredLocale)
	if err != nil {
		handler.writeServiceError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, dataResponse{Data: user})
}

func (handler *Handler) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		cookie, err := request.Cookie(sessionCookieName)
		if err != nil || cookie.Value == "" {
			writeError(response, http.StatusUnauthorized, "unauthenticated", "Authentication is required.", nil)
			return
		}
		session, err := handler.service.Authenticate(request.Context(), cookie.Value)
		if err != nil {
			if errors.Is(err, service.ErrUnauthenticated) || errors.Is(err, service.ErrAccountDisabled) {
				handler.clearAuthCookies(response)
				writeError(response, http.StatusUnauthorized, "unauthenticated", "Authentication is required.", nil)
				return
			}
			handler.logInternal(request, err)
			writeError(response, http.StatusInternalServerError, "internal_error", "The request could not be completed.", nil)
			return
		}
		ctx := context.WithValue(request.Context(), authContextKey, authContext{
			Session: session, SessionToken: cookie.Value,
		})
		next.ServeHTTP(response, request.WithContext(ctx))
	})
}

func (handler *Handler) requireCSRF(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		authentication := request.Context().Value(authContextKey).(authContext)
		cookie, err := request.Cookie(csrfCookieName)
		headerToken := request.Header.Get(csrfHeaderName)
		if err != nil || cookie.Value == "" || headerToken == "" || cookie.Value != headerToken || handler.service.ValidateCSRF(authentication.Session, headerToken) != nil {
			writeError(response, http.StatusForbidden, "invalid_csrf", "The CSRF token is invalid.", nil)
			return
		}
		next.ServeHTTP(response, request)
	})
}

func (handler *Handler) writeServiceError(response http.ResponseWriter, request *http.Request, err error) {
	switch {
	case errors.Is(err, service.ErrValidation):
		writeError(response, http.StatusUnprocessableEntity, "validation_failed", "One or more fields are invalid.", nil)
	case errors.Is(err, service.ErrEmailExists):
		writeError(response, http.StatusConflict, "email_exists", "An account with this email already exists.", nil)
	case errors.Is(err, service.ErrInvalidCredentials):
		writeError(response, http.StatusUnauthorized, "invalid_credentials", "The email or password is incorrect.", nil)
	case errors.Is(err, service.ErrEmailNotVerified):
		writeError(response, http.StatusForbidden, "email_not_verified", "Email verification is required.", nil)
	case errors.Is(err, service.ErrAccountDisabled):
		writeError(response, http.StatusForbidden, "account_disabled", "This account is disabled.", nil)
	case errors.Is(err, service.ErrInvalidToken):
		writeError(response, http.StatusUnprocessableEntity, "invalid_token", "The token is invalid or expired.", nil)
	case errors.Is(err, service.ErrUnauthenticated):
		writeError(response, http.StatusUnauthorized, "unauthenticated", "Authentication is required.", nil)
	default:
		handler.logInternal(request, err)
		writeError(response, http.StatusInternalServerError, "internal_error", "The request could not be completed.", nil)
	}
}

func (handler *Handler) setAuthCookies(response http.ResponseWriter, sessionToken, csrfToken string, expiresAt time.Time) {
	maxAge := int(time.Until(expiresAt).Seconds())
	http.SetCookie(response, &http.Cookie{
		Name: sessionCookieName, Value: sessionToken, Path: "/", Expires: expiresAt,
		MaxAge: maxAge, HttpOnly: true, Secure: handler.cookieSecure, SameSite: http.SameSiteLaxMode,
	})
	http.SetCookie(response, &http.Cookie{
		Name: csrfCookieName, Value: csrfToken, Path: "/", Expires: expiresAt,
		MaxAge: maxAge, HttpOnly: false, Secure: handler.cookieSecure, SameSite: http.SameSiteLaxMode,
	})
}

func (handler *Handler) clearAuthCookies(response http.ResponseWriter) {
	expired := time.Unix(1, 0).UTC()
	for _, cookie := range []*http.Cookie{
		{Name: sessionCookieName, Path: "/", Expires: expired, MaxAge: -1, HttpOnly: true, Secure: handler.cookieSecure, SameSite: http.SameSiteLaxMode},
		{Name: csrfCookieName, Path: "/", Expires: expired, MaxAge: -1, HttpOnly: false, Secure: handler.cookieSecure, SameSite: http.SameSiteLaxMode},
	} {
		http.SetCookie(response, cookie)
	}
}

func (handler *Handler) exposesDevelopmentTokens() bool {
	return handler.environment == "local" || handler.environment == "test"
}

func (handler *Handler) logInternal(request *http.Request, err error) {
	handler.logger.Error("auth request failed", "method", request.Method, "path", request.URL.Path, "error", err)
}

func (handler *Handler) checkRateLimit(response http.ResponseWriter, request *http.Request, scope, identifier string, limit int64, window time.Duration) bool {
	if handler.limiter == nil {
		return true
	}
	digest := sha256.Sum256([]byte(identifier))
	allowed, retryAfter, err := handler.limiter.Allow(request.Context(), fmt.Sprintf("%s:%x", scope, digest), limit, window)
	if err != nil {
		handler.logInternal(request, err)
		writeError(response, http.StatusServiceUnavailable, "service_unavailable", "The authentication service is temporarily unavailable.", nil)
		return false
	}
	if allowed {
		return true
	}
	response.Header().Set("Retry-After", strconv.FormatInt(int64(retryAfter.Round(time.Second)/time.Second), 10))
	writeError(response, http.StatusTooManyRequests, "rate_limited", "Too many requests. Try again later.", nil)
	return false
}

func requestIP(request *http.Request) string {
	host, _, err := net.SplitHostPort(request.RemoteAddr)
	if err == nil {
		return host
	}
	return request.RemoteAddr
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
