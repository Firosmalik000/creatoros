package ratelimit

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"
)

func TestRedisFixedWindow(t *testing.T) {
	rawURL := os.Getenv("TEST_REDIS_URL")
	if rawURL == "" {
		t.Skip("TEST_REDIS_URL is not configured")
	}
	limiter, err := New(rawURL)
	if err != nil {
		t.Fatalf("create limiter: %v", err)
	}
	defer limiter.Close()
	key := fmt.Sprintf("test:%d", time.Now().UnixNano())
	for attempt := 1; attempt <= 3; attempt++ {
		allowed, retryAfter, err := limiter.Allow(context.Background(), key, 2, time.Minute)
		if err != nil {
			t.Fatalf("attempt %d: %v", attempt, err)
		}
		if allowed != (attempt <= 2) {
			t.Fatalf("attempt %d allowed=%v", attempt, allowed)
		}
		if retryAfter <= 0 || retryAfter > time.Minute {
			t.Fatalf("attempt %d invalid retry duration %s", attempt, retryAfter)
		}
	}
}
