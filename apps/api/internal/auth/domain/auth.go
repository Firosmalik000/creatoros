package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound        = errors.New("not found")
	ErrConflict        = errors.New("conflict")
	ErrInvalidToken    = errors.New("invalid or expired token")
	ErrInvalidRole     = errors.New("invalid role")
	ErrUnauthenticated = errors.New("unauthenticated")
)

type User struct {
	ID              string     `json:"id"`
	Email           string     `json:"email"`
	DisplayName     string     `json:"display_name"`
	PreferredLocale string     `json:"preferred_locale"`
	Status          string     `json:"status"`
	EmailVerifiedAt *time.Time `json:"email_verified_at"`
	Roles           []string   `json:"roles"`
	Permissions     []string   `json:"permissions"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type Account struct {
	User
	PasswordHash string
}

type Session struct {
	ID            string
	User          User
	CSRFTokenHash []byte
	ExpiresAt     time.Time
}

type CreateUserParams struct {
	Email                 string
	PasswordHash          string
	DisplayName           string
	PreferredLocale       string
	Role                  string
	VerificationTokenHash []byte
	VerificationExpiresAt time.Time
	Notification          *EmailOutboxMessage
}

type EmailOutboxMessage struct {
	Recipient  string
	Kind       string
	Locale     string
	Ciphertext []byte
	Nonce      []byte
	ExpiresAt  time.Time
}

type CreatePasswordResetParams struct {
	Email        string
	TokenHash    []byte
	ExpiresAt    time.Time
	Notification *EmailOutboxMessage
}

type Repository interface {
	CreateUser(context.Context, CreateUserParams) (User, error)
	FindAccountByEmail(context.Context, string) (Account, error)
	VerifyEmail(context.Context, []byte, time.Time) (User, error)
	CreateSession(context.Context, string, []byte, []byte, time.Time) (Session, error)
	FindSession(context.Context, []byte, time.Time) (Session, error)
	RevokeSession(context.Context, []byte, time.Time) error
	CreatePasswordReset(context.Context, CreatePasswordResetParams) (bool, error)
	ResetPassword(context.Context, []byte, string, time.Time) error
	UpdateSettings(context.Context, string, string, time.Time) (User, error)
}
