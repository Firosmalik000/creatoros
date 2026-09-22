package http

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	authhandler "github.com/creatoros/platform/apps/api/internal/auth/handler"
	creatorhandler "github.com/creatoros/platform/apps/api/internal/creator/handler"
	orderhandler "github.com/creatoros/platform/apps/api/internal/order/handler"
	servicehandler "github.com/creatoros/platform/apps/api/internal/service/handler"
	workflowhandler "github.com/creatoros/platform/apps/api/internal/workflow/handler"
	campaignhandler "github.com/creatoros/platform/apps/api/internal/campaign/handler"
	communicationhandler "github.com/creatoros/platform/apps/api/internal/communication/handler"
	paymenthandler "github.com/creatoros/platform/apps/api/internal/payment/handler"
	adminhandler "github.com/creatoros/platform/apps/api/internal/admin/handler"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type Options struct {
	Auth           *authhandler.Handler
	Creator        *creatorhandler.Handler
	Service        *servicehandler.Handler
	Order          *orderhandler.Handler
	Workflow       *workflowhandler.Handler
	Campaign       *campaignhandler.Handler
	Payment        *paymenthandler.Handler
	Communication  *communicationhandler.Handler
	Admin          *adminhandler.Handler
	AllowedOrigins []string
	Readiness      func(context.Context) error
}

type healthResponse struct {
	Data healthData `json:"data"`
}

type healthData struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
}

func NewRouter(logger *slog.Logger, optionValues ...Options) http.Handler {
	var options Options
	if len(optionValues) > 0 {
		options = optionValues[0]
	}
	router := chi.NewRouter()
	router.Use(middleware.RequestID)
	router.Use(middleware.Recoverer)
	router.Use(requestLogger(logger))
	if len(options.AllowedOrigins) > 0 {
		router.Use(cors(options.AllowedOrigins))
	}

	router.Get("/health/live", health("live"))
	router.Get("/health/ready", readiness(options.Readiness))
	if options.Auth != nil {
		router.Route("/api/v1", func(api chi.Router) {
			options.Auth.Mount(api)
			if options.Creator != nil {
				options.Creator.Mount(api, options.Auth.Authenticate, options.Auth.OptionalAuthenticate, options.Auth.RequireCSRF)
			}
			if options.Service != nil {
				options.Service.Mount(api, options.Auth.Authenticate, options.Auth.RequireCSRF)
			}
			if options.Order != nil {
				options.Order.Mount(api, options.Auth.Authenticate, options.Auth.RequireCSRF)
			}
			if options.Workflow != nil {
				options.Workflow.Mount(api, options.Auth.Authenticate, options.Auth.RequireCSRF)
			}
			if options.Campaign != nil {
				options.Campaign.Mount(api, options.Auth.Authenticate, options.Auth.RequireCSRF)
			}
			if options.Payment != nil {
				options.Payment.Mount(api, options.Auth.Authenticate, options.Auth.RequireCSRF)
			}
			if options.Communication != nil {
				options.Communication.Mount(api, options.Auth.Authenticate, options.Auth.RequireCSRF)
			}
			if options.Admin != nil {
				options.Admin.Mount(api, options.Auth.Authenticate, options.Auth.RequireCSRF)
			}
		})
	}

	return router
}

func readiness(check func(context.Context) error) http.HandlerFunc {
	return func(response http.ResponseWriter, request *http.Request) {
		statusCode := http.StatusOK
		status := "ready"
		if check != nil {
			ctx, cancel := context.WithTimeout(request.Context(), 2*time.Second)
			defer cancel()
			if err := check(ctx); err != nil {
				statusCode = http.StatusServiceUnavailable
				status = "not_ready"
			}
		}
		response.Header().Set("Content-Type", "application/json")
		response.WriteHeader(statusCode)
		_ = json.NewEncoder(response).Encode(healthResponse{Data: healthData{
			Status: status, Timestamp: time.Now().UTC(),
		}})
	}
}

func cors(origins []string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(origins))
	for _, origin := range origins {
		allowed[origin] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
			origin := request.Header.Get("Origin")
			if _, ok := allowed[origin]; ok {
				response.Header().Set("Access-Control-Allow-Origin", origin)
				response.Header().Set("Access-Control-Allow-Credentials", "true")
				response.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token, X-Request-ID")
				response.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS")
				response.Header().Add("Vary", "Origin")
			}
			if request.Method == http.MethodOptions {
				response.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(response, request)
		})
	}
}

func health(status string) http.HandlerFunc {
	return func(response http.ResponseWriter, _ *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		response.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(response).Encode(healthResponse{Data: healthData{
			Status:    status,
			Timestamp: time.Now().UTC(),
		}})
	}
}

func requestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
			started := time.Now()
			next.ServeHTTP(response, request)
			logger.Info("request completed",
				"request_id", middleware.GetReqID(request.Context()),
				"method", request.Method,
				"path", request.URL.Path,
				"duration_ms", time.Since(started).Milliseconds(),
			)
		})
	}
}
