package http

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type healthResponse struct {
	Data healthData `json:"data"`
}

type healthData struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
}

func NewRouter(logger *slog.Logger) http.Handler {
	router := chi.NewRouter()
	router.Use(middleware.RequestID)
	router.Use(middleware.RealIP)
	router.Use(middleware.Recoverer)
	router.Use(requestLogger(logger))

	router.Get("/health/live", health("live"))
	router.Get("/health/ready", health("ready"))

	return router
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
