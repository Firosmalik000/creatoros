package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound          = errors.New("service not found")
	ErrConflict          = errors.New("service conflict")
	ErrForbidden         = errors.New("service action forbidden")
	ErrInvalidTransition = errors.New("invalid service transition")
)

type Actor struct {
	UserID      string
	Roles       []string
	Permissions []string
}

type Package struct {
	ID            string `json:"id,omitempty"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	PriceMinor    int64  `json:"price_minor"`
	Currency      string `json:"currency"`
	DeliveryDays  int    `json:"delivery_days"`
	RevisionLimit int    `json:"revision_limit"`
	SortOrder     int    `json:"sort_order"`
}

type Service struct {
	ID                 string     `json:"id"`
	CreatorSlug        string     `json:"creator_slug"`
	CreatorDisplayName string     `json:"creator_display_name"`
	Slug               string     `json:"slug"`
	Title              string     `json:"title"`
	Description        string     `json:"description"`
	Status             string     `json:"status"`
	Packages           []Package  `json:"packages"`
	PublishedAt        *time.Time `json:"published_at"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type SaveInput struct {
	Slug        string
	Title       string
	Description string
	Packages    []Package
}

type Repository interface {
	ListOwn(context.Context, string) ([]Service, error)
	GetOwn(context.Context, string, string) (Service, error)
	Save(context.Context, string, string, SaveInput, time.Time) (Service, error)
	Publish(context.Context, string, string, time.Time) (Service, error)
	Unpublish(context.Context, string, string, time.Time) (Service, error)
	ListPublic(context.Context, string) ([]Service, error)
	FindPublic(context.Context, string, string) (Service, error)
}
