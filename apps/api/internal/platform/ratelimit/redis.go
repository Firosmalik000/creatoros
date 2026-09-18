package ratelimit

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

var fixedWindowScript = redis.NewScript(`
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {current, ttl}
`)

type Redis struct {
	client *redis.Client
}

func New(rawURL string) (*Redis, error) {
	options, err := redis.ParseURL(rawURL)
	if err != nil {
		return nil, fmt.Errorf("parse REDIS_URL: %w", err)
	}
	return &Redis{client: redis.NewClient(options)}, nil
}

func (limiter *Redis) Allow(ctx context.Context, key string, limit int64, window time.Duration) (bool, time.Duration, error) {
	result, err := fixedWindowScript.Run(ctx, limiter.client, []string{"creatoros:auth-limit:" + key}, window.Milliseconds()).Slice()
	if err != nil {
		return false, 0, fmt.Errorf("apply rate limit: %w", err)
	}
	current, ok := result[0].(int64)
	if !ok {
		return false, 0, fmt.Errorf("invalid rate limit count")
	}
	ttlMilliseconds, ok := result[1].(int64)
	if !ok {
		return false, 0, fmt.Errorf("invalid rate limit TTL")
	}
	retryAfter := time.Duration(ttlMilliseconds) * time.Millisecond
	if retryAfter < time.Second {
		retryAfter = time.Second
	}
	return current <= limit, retryAfter, nil
}

func (limiter *Redis) Ping(ctx context.Context) error {
	return limiter.client.Ping(ctx).Err()
}

func (limiter *Redis) Close() error {
	return limiter.client.Close()
}
