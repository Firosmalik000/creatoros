package service

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/creatoros/platform/apps/api/internal/auth/domain"
)

var (
	ErrValidation         = errors.New("validation failed")
	ErrEmailExists        = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrEmailNotVerified   = errors.New("email is not verified")
	ErrAccountDisabled    = errors.New("account is disabled")
	ErrUnauthenticated    = errors.New("unauthenticated")
	ErrInvalidCSRF        = errors.New("invalid csrf token")
	ErrInvalidToken       = errors.New("invalid or expired token")
)

type Config struct {
	SessionTTL       time.Duration
	VerificationTTL  time.Duration
	PasswordResetTTL time.Duration
	Notifications    NotificationFactory
}

type NotificationFactory interface {
	Verification(email, locale, token string, expiresAt time.Time) (*domain.EmailOutboxMessage, error)
	PasswordReset(email, locale, token string, expiresAt time.Time) (*domain.EmailOutboxMessage, error)
}

func DefaultConfig() Config {
	return Config{
		SessionTTL:       7 * 24 * time.Hour,
		VerificationTTL:  24 * time.Hour,
		PasswordResetTTL: 30 * time.Minute,
	}
}

type Service struct {
	repository domain.Repository
	config     Config
	now        func() time.Time
}

type RegisterInput struct {
	Email           string
	Password        string
	DisplayName     string
	PreferredLocale string
	Role            string
}

type RegisterResult struct {
	User              domain.User
	VerificationToken string
}

type LoginResult struct {
	User         domain.User
	SessionToken string
	CSRFToken    string
	ExpiresAt    time.Time
}

type ForgotPasswordResult struct {
	Issued bool
	Token  string
}

func New(repository domain.Repository, config Config) *Service {
	return &Service{repository: repository, config: config, now: func() time.Time { return time.Now().UTC() }}
}

func (service *Service) Register(ctx context.Context, input RegisterInput) (RegisterResult, error) {
	email := strings.ToLower(strings.TrimSpace(input.Email))
	displayName := strings.TrimSpace(input.DisplayName)
	locale := normalizeLocale(input.PreferredLocale)
	role := strings.ToLower(strings.TrimSpace(input.Role))
	if err := validateRegistration(email, input.Password, displayName, locale, role); err != nil {
		return RegisterResult{}, err
	}

	passwordHash, err := hashPassword(input.Password)
	if err != nil {
		return RegisterResult{}, err
	}
	verificationToken, verificationHash, err := newToken()
	if err != nil {
		return RegisterResult{}, err
	}
	verificationExpiresAt := service.now().Add(service.config.VerificationTTL)
	var notification *domain.EmailOutboxMessage
	if service.config.Notifications != nil {
		notification, err = service.config.Notifications.Verification(email, locale, verificationToken, verificationExpiresAt)
		if err != nil {
			return RegisterResult{}, fmt.Errorf("create verification notification: %w", err)
		}
	}

	user, err := service.repository.CreateUser(ctx, domain.CreateUserParams{
		Email:                 email,
		PasswordHash:          passwordHash,
		DisplayName:           displayName,
		PreferredLocale:       locale,
		Role:                  role,
		VerificationTokenHash: verificationHash,
		VerificationExpiresAt: verificationExpiresAt,
		Notification:          notification,
	})
	if errors.Is(err, domain.ErrConflict) {
		return RegisterResult{}, ErrEmailExists
	}
	if errors.Is(err, domain.ErrInvalidRole) {
		return RegisterResult{}, fmt.Errorf("%w: role", ErrValidation)
	}
	if err != nil {
		return RegisterResult{}, fmt.Errorf("create user: %w", err)
	}

	return RegisterResult{User: user, VerificationToken: verificationToken}, nil
}

func (service *Service) VerifyEmail(ctx context.Context, token string) (domain.User, error) {
	if strings.TrimSpace(token) == "" {
		return domain.User{}, fmt.Errorf("%w: token", ErrValidation)
	}
	user, err := service.repository.VerifyEmail(ctx, tokenHash(token), service.now())
	if errors.Is(err, domain.ErrInvalidToken) || errors.Is(err, domain.ErrNotFound) {
		return domain.User{}, ErrInvalidToken
	}
	if err != nil {
		return domain.User{}, fmt.Errorf("verify email: %w", err)
	}
	return user, nil
}

func (service *Service) Login(ctx context.Context, email, password string) (LoginResult, error) {
	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	if normalizedEmail == "" || password == "" {
		return LoginResult{}, ErrInvalidCredentials
	}

	account, err := service.repository.FindAccountByEmail(ctx, normalizedEmail)
	if errors.Is(err, domain.ErrNotFound) || (err == nil && !verifyPassword(password, account.PasswordHash)) {
		return LoginResult{}, ErrInvalidCredentials
	}
	if err != nil {
		return LoginResult{}, fmt.Errorf("find account: %w", err)
	}
	if account.Status == "disabled" {
		return LoginResult{}, ErrAccountDisabled
	}
	if account.EmailVerifiedAt == nil {
		return LoginResult{}, ErrEmailNotVerified
	}

	sessionToken, sessionHash, err := newToken()
	if err != nil {
		return LoginResult{}, err
	}
	csrfToken, csrfHash, err := newToken()
	if err != nil {
		return LoginResult{}, err
	}
	expiresAt := service.now().Add(service.config.SessionTTL)
	if _, err := service.repository.CreateSession(ctx, account.ID, sessionHash, csrfHash, expiresAt); err != nil {
		return LoginResult{}, fmt.Errorf("create session: %w", err)
	}

	return LoginResult{
		User:         account.User,
		SessionToken: sessionToken,
		CSRFToken:    csrfToken,
		ExpiresAt:    expiresAt,
	}, nil
}

func (service *Service) Authenticate(ctx context.Context, sessionToken string) (domain.Session, error) {
	if sessionToken == "" {
		return domain.Session{}, ErrUnauthenticated
	}
	session, err := service.repository.FindSession(ctx, tokenHash(sessionToken), service.now())
	if errors.Is(err, domain.ErrNotFound) {
		return domain.Session{}, ErrUnauthenticated
	}
	if err != nil {
		return domain.Session{}, fmt.Errorf("find session: %w", err)
	}
	if session.User.Status == "disabled" {
		return domain.Session{}, ErrAccountDisabled
	}
	return session, nil
}

func (service *Service) ValidateCSRF(session domain.Session, csrfToken string) error {
	if csrfToken == "" || !equalTokenHash(session.CSRFTokenHash, tokenHash(csrfToken)) {
		return ErrInvalidCSRF
	}
	return nil
}

func (service *Service) Logout(ctx context.Context, sessionToken string) error {
	if sessionToken == "" {
		return nil
	}
	if err := service.repository.RevokeSession(ctx, tokenHash(sessionToken), service.now()); err != nil {
		return fmt.Errorf("revoke session: %w", err)
	}
	return nil
}

func (service *Service) ForgotPassword(ctx context.Context, email string) (ForgotPasswordResult, error) {
	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	if _, err := mail.ParseAddress(normalizedEmail); err != nil {
		return ForgotPasswordResult{}, fmt.Errorf("%w: email", ErrValidation)
	}

	token, hash, err := newToken()
	if err != nil {
		return ForgotPasswordResult{}, err
	}
	locale := "id"
	account, lookupErr := service.repository.FindAccountByEmail(ctx, normalizedEmail)
	if lookupErr == nil && account.Status != "disabled" {
		locale = account.PreferredLocale
	} else if lookupErr != nil && !errors.Is(lookupErr, domain.ErrNotFound) {
		return ForgotPasswordResult{}, fmt.Errorf("find password reset account: %w", lookupErr)
	}
	var notification *domain.EmailOutboxMessage
	resetExpiresAt := service.now().Add(service.config.PasswordResetTTL)
	if service.config.Notifications != nil && lookupErr == nil && account.Status != "disabled" {
		notification, err = service.config.Notifications.PasswordReset(normalizedEmail, locale, token, resetExpiresAt)
		if err != nil {
			return ForgotPasswordResult{}, fmt.Errorf("create password reset notification: %w", err)
		}
	}
	issued, err := service.repository.CreatePasswordReset(ctx, domain.CreatePasswordResetParams{
		Email: normalizedEmail, TokenHash: hash,
		ExpiresAt: resetExpiresAt, Notification: notification,
	})
	if err != nil {
		return ForgotPasswordResult{}, fmt.Errorf("create password reset: %w", err)
	}
	return ForgotPasswordResult{Issued: issued, Token: token}, nil
}

func (service *Service) ResetPassword(ctx context.Context, token, password string) error {
	if strings.TrimSpace(token) == "" || !validPassword(password) {
		return fmt.Errorf("%w: token or password", ErrValidation)
	}
	passwordHash, err := hashPassword(password)
	if err != nil {
		return err
	}
	if err := service.repository.ResetPassword(ctx, tokenHash(token), passwordHash, service.now()); err != nil {
		if errors.Is(err, domain.ErrInvalidToken) || errors.Is(err, domain.ErrNotFound) {
			return ErrInvalidToken
		}
		return fmt.Errorf("reset password: %w", err)
	}
	return nil
}

func (service *Service) UpdateLocale(ctx context.Context, userID, locale string) (domain.User, error) {
	normalized := normalizeLocale(locale)
	if !validLocale(normalized) {
		return domain.User{}, fmt.Errorf("%w: preferred_locale", ErrValidation)
	}
	user, err := service.repository.UpdateSettings(ctx, userID, normalized, service.now())
	if errors.Is(err, domain.ErrNotFound) {
		return domain.User{}, ErrUnauthenticated
	}
	if err != nil {
		return domain.User{}, fmt.Errorf("update settings: %w", err)
	}
	return user, nil
}

func validateRegistration(email, password, displayName, locale, role string) error {
	address, err := mail.ParseAddress(email)
	if err != nil || address.Address != email || len(email) > 320 {
		return fmt.Errorf("%w: email", ErrValidation)
	}
	if !validPassword(password) {
		return fmt.Errorf("%w: password", ErrValidation)
	}
	nameLength := utf8.RuneCountInString(displayName)
	if nameLength < 2 || nameLength > 100 {
		return fmt.Errorf("%w: display_name", ErrValidation)
	}
	if !validLocale(locale) {
		return fmt.Errorf("%w: preferred_locale", ErrValidation)
	}
	if role != "client" && role != "creator" {
		return fmt.Errorf("%w: role", ErrValidation)
	}
	return nil
}

func validPassword(password string) bool {
	length := utf8.RuneCountInString(password)
	return length >= 12 && length <= 128
}

func normalizeLocale(locale string) string {
	locale = strings.ToLower(strings.TrimSpace(locale))
	if locale == "" {
		return "id"
	}
	return locale
}

func validLocale(locale string) bool {
	return locale == "id" || locale == "en" || locale == "ms"
}

func equalTokenHash(left, right []byte) bool {
	if len(left) != len(right) {
		return false
	}
	var difference byte
	for index := range left {
		difference |= left[index] ^ right[index]
	}
	return difference == 0
}
