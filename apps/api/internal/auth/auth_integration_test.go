package auth_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	authhandler "github.com/creatoros/platform/apps/api/internal/auth/handler"
	authrepository "github.com/creatoros/platform/apps/api/internal/auth/repository"
	authservice "github.com/creatoros/platform/apps/api/internal/auth/service"
	"github.com/creatoros/platform/apps/api/internal/platform/database"
	platformhttp "github.com/creatoros/platform/apps/api/internal/platform/http"
	"github.com/creatoros/platform/apps/api/internal/platform/notification"
)

type envelope struct {
	Data json.RawMessage   `json:"data"`
	Meta map[string]string `json:"meta"`
}

type testUser struct {
	ID              string   `json:"id"`
	Email           string   `json:"email"`
	PreferredLocale string   `json:"preferred_locale"`
	Roles           []string `json:"roles"`
	Permissions     []string `json:"permissions"`
}

func TestAuthenticationLifecycle(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not configured")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	pool, err := database.Open(ctx, databaseURL)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer pool.Close()
	lockConnection, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("acquire integration lock connection: %v", err)
	}
	if _, err := lockConnection.Exec(ctx, "SELECT pg_advisory_lock($1)", int64(772001)); err != nil {
		lockConnection.Release()
		t.Fatalf("acquire integration lock: %v", err)
	}
	defer func() {
		_, _ = lockConnection.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", int64(772001))
		lockConnection.Release()
	}()
	if _, err := pool.Exec(ctx, "TRUNCATE users, email_outbox CASCADE"); err != nil {
		t.Fatalf("truncate auth tables: %v", err)
	}
	defer func() {
		cleanupContext, cleanupCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cleanupCancel()
		_, _ = pool.Exec(cleanupContext, "TRUNCATE users, email_outbox CASCADE")
	}()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	repository := authrepository.NewPostgres(pool)
	notificationFactory, err := notification.NewFactory(
		"https://creator.example",
		base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{9}, 32)),
	)
	if err != nil {
		t.Fatalf("create notification factory: %v", err)
	}
	serviceConfig := authservice.DefaultConfig()
	serviceConfig.Notifications = notificationFactory
	service := authservice.New(repository, serviceConfig)
	handler := authhandler.New(service, logger, authhandler.Options{Environment: "test", CookieSecure: false})
	router := platformhttp.NewRouter(logger, platformhttp.Options{Auth: handler})

	unauthorized := perform(t, router, http.MethodGet, "/api/v1/auth/me", nil, nil, nil)
	assertStatus(t, unauthorized, http.StatusUnauthorized)

	clientToken := register(t, router, "client@example.test", "client")
	var verificationCiphertext []byte
	if err := pool.QueryRow(ctx, `
		SELECT payload_ciphertext FROM email_outbox
		WHERE recipient = $1 AND kind = 'email_verification'
	`, "client@example.test").Scan(&verificationCiphertext); err != nil {
		t.Fatalf("query verification outbox: %v", err)
	}
	if bytes.Contains(verificationCiphertext, []byte(clientToken)) {
		t.Fatal("verification outbox persisted the raw token")
	}
	unverifiedLogin := perform(t, router, http.MethodPost, "/api/v1/auth/login", map[string]any{
		"email": "client@example.test", "password": "correct horse battery staple",
	}, nil, nil)
	assertStatus(t, unverifiedLogin, http.StatusForbidden)
	verify(t, router, clientToken)

	clientLogin := login(t, router, "client@example.test", "correct horse battery staple")
	cookies := clientLogin.Result().Cookies()
	csrfToken := cookieValue(t, cookies, "creatoros_csrf")

	me := perform(t, router, http.MethodGet, "/api/v1/auth/me", nil, cookies, nil)
	assertStatus(t, me, http.StatusOK)
	client := decodeUser(t, me)
	if len(client.Roles) != 1 || client.Roles[0] != "client" {
		t.Fatalf("expected client role, got %#v", client.Roles)
	}
	if len(client.Permissions) == 0 {
		t.Fatal("expected role permissions")
	}

	withoutCSRF := perform(t, router, http.MethodPatch, "/api/v1/users/me/settings", map[string]any{
		"preferred_locale": "ms",
	}, cookies, nil)
	assertStatus(t, withoutCSRF, http.StatusForbidden)

	settings := perform(t, router, http.MethodPatch, "/api/v1/users/me/settings", map[string]any{
		"preferred_locale": "ms",
	}, cookies, map[string]string{"X-CSRF-Token": csrfToken})
	assertStatus(t, settings, http.StatusOK)
	if user := decodeUser(t, settings); user.PreferredLocale != "ms" {
		t.Fatalf("expected locale ms, got %q", user.PreferredLocale)
	}

	unknownReset := perform(t, router, http.MethodPost, "/api/v1/auth/forgot-password", map[string]any{
		"email": "unknown@example.test",
	}, nil, nil)
	assertStatus(t, unknownReset, http.StatusAccepted)
	if token := decodeEnvelope(t, unknownReset).Meta["reset_token"]; token != "" {
		t.Fatal("unknown account must not receive a reset token")
	}

	forgot := perform(t, router, http.MethodPost, "/api/v1/auth/forgot-password", map[string]any{
		"email": "client@example.test",
	}, nil, nil)
	assertStatus(t, forgot, http.StatusAccepted)
	resetToken := decodeEnvelope(t, forgot).Meta["reset_token"]
	if resetToken == "" {
		t.Fatal("expected development reset token")
	}
	reset := perform(t, router, http.MethodPost, "/api/v1/auth/reset-password", map[string]any{
		"token": resetToken, "password": "new correct horse battery staple",
	}, nil, nil)
	assertStatus(t, reset, http.StatusNoContent)

	oldLogin := perform(t, router, http.MethodPost, "/api/v1/auth/login", map[string]any{
		"email": "client@example.test", "password": "correct horse battery staple",
	}, nil, nil)
	assertStatus(t, oldLogin, http.StatusUnauthorized)
	refreshedLogin := login(t, router, "client@example.test", "new correct horse battery staple")
	cookies = refreshedLogin.Result().Cookies()
	csrfToken = cookieValue(t, cookies, "creatoros_csrf")

	creatorToken := register(t, router, "creator@example.test", "creator")
	verify(t, router, creatorToken)
	creatorLogin := login(t, router, "creator@example.test", "correct horse battery staple")
	creator := decodeUser(t, creatorLogin)
	if len(creator.Roles) != 1 || creator.Roles[0] != "creator" {
		t.Fatalf("expected creator role, got %#v", creator.Roles)
	}

	disabledToken := register(t, router, "disabled@example.test", "client")
	if _, err := pool.Exec(ctx, "UPDATE users SET status = 'disabled' WHERE email = $1", "disabled@example.test"); err != nil {
		t.Fatalf("disable pending account: %v", err)
	}
	disabledVerification := perform(t, router, http.MethodPost, "/api/v1/auth/verify-email", map[string]any{
		"token": disabledToken,
	}, nil, nil)
	assertStatus(t, disabledVerification, http.StatusUnprocessableEntity)
	var disabledStatus string
	var disabledVerifiedAt *time.Time
	if err := pool.QueryRow(ctx, "SELECT status, email_verified_at FROM users WHERE email = $1", "disabled@example.test").Scan(&disabledStatus, &disabledVerifiedAt); err != nil {
		t.Fatalf("query disabled account: %v", err)
	}
	if disabledStatus != "disabled" || disabledVerifiedAt != nil {
		t.Fatalf("verification changed disabled account: status=%q verified_at=%v", disabledStatus, disabledVerifiedAt)
	}

	logout := perform(t, router, http.MethodPost, "/api/v1/auth/logout", nil, cookies, map[string]string{
		"X-CSRF-Token": csrfToken,
	})
	assertStatus(t, logout, http.StatusNoContent)
	revoked := perform(t, router, http.MethodGet, "/api/v1/auth/me", nil, cookies, nil)
	assertStatus(t, revoked, http.StatusUnauthorized)
}

func register(t *testing.T, router http.Handler, email, role string) string {
	t.Helper()
	response := perform(t, router, http.MethodPost, "/api/v1/auth/register", map[string]any{
		"email": email, "password": "correct horse battery staple", "display_name": "Test User",
		"preferred_locale": "id", "role": role,
	}, nil, nil)
	assertStatus(t, response, http.StatusCreated)
	token := decodeEnvelope(t, response).Meta["verification_token"]
	if token == "" {
		t.Fatal("expected development verification token")
	}
	return token
}

func verify(t *testing.T, router http.Handler, token string) {
	t.Helper()
	response := perform(t, router, http.MethodPost, "/api/v1/auth/verify-email", map[string]any{"token": token}, nil, nil)
	assertStatus(t, response, http.StatusOK)
	reuse := perform(t, router, http.MethodPost, "/api/v1/auth/verify-email", map[string]any{"token": token}, nil, nil)
	assertStatus(t, reuse, http.StatusUnprocessableEntity)
}

func login(t *testing.T, router http.Handler, email, password string) *httptest.ResponseRecorder {
	t.Helper()
	response := perform(t, router, http.MethodPost, "/api/v1/auth/login", map[string]any{
		"email": email, "password": password,
	}, nil, nil)
	assertStatus(t, response, http.StatusOK)
	if cookieValue(t, response.Result().Cookies(), "creatoros_session") == "" {
		t.Fatal("expected session cookie")
	}
	return response
}

func perform(t *testing.T, router http.Handler, method, path string, body any, cookies []*http.Cookie, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	var requestBody io.Reader
	if body != nil {
		contents, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal request: %v", err)
		}
		requestBody = bytes.NewReader(contents)
	}
	request := httptest.NewRequest(method, path, requestBody)
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func decodeEnvelope(t *testing.T, response *httptest.ResponseRecorder) envelope {
	t.Helper()
	var result envelope
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v; body=%s", err, response.Body.String())
	}
	return result
}

func decodeUser(t *testing.T, response *httptest.ResponseRecorder) testUser {
	t.Helper()
	payload := decodeEnvelope(t, response)
	var user testUser
	if err := json.Unmarshal(payload.Data, &user); err != nil {
		t.Fatalf("decode user: %v", err)
	}
	return user
}

func cookieValue(t *testing.T, cookies []*http.Cookie, name string) string {
	t.Helper()
	for _, cookie := range cookies {
		if cookie.Name == name {
			return cookie.Value
		}
	}
	t.Fatalf("cookie %s not found", name)
	return ""
}

func assertStatus(t *testing.T, response *httptest.ResponseRecorder, expected int) {
	t.Helper()
	if response.Code != expected {
		t.Fatalf("expected status %d, got %d: %s", expected, response.Code, response.Body.String())
	}
}
