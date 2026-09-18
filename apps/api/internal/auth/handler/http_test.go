package handler

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
)

type fakeLimiter struct {
	allowed    bool
	retryAfter time.Duration
	err        error
}

func (limiter fakeLimiter) Allow(context.Context, string, int64, time.Duration) (bool, time.Duration, error) {
	return limiter.allowed, limiter.retryAfter, limiter.err
}

func TestPublicAuthRateLimit(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := New(nil, logger, Options{RateLimiter: fakeLimiter{retryAfter: 42 * time.Second}})
	router := chi.NewRouter()
	handler.Mount(router)
	request := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d: %s", response.Code, response.Body.String())
	}
	if retryAfter := response.Header().Get("Retry-After"); retryAfter != "42" {
		t.Fatalf("expected Retry-After 42, got %q", retryAfter)
	}
}

func TestPublicAuthRateLimiterFailsClosed(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := New(nil, logger, Options{RateLimiter: fakeLimiter{err: errors.New("redis unavailable")}})
	router := chi.NewRouter()
	handler.Mount(router)
	request := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", response.Code, response.Body.String())
	}
}
