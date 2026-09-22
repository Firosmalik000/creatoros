package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound          = errors.New("order not found")
	ErrForbidden         = errors.New("order action forbidden")
	ErrConflict          = errors.New("order conflict")
	ErrInvalidTransition = errors.New("invalid order transition")
	ErrSelfOrder         = errors.New("cannot order own service")
	ErrValidation        = errors.New("order validation failed")
)

const (
	StatusPendingAcceptance = "pending_acceptance"
	StatusAccepted          = "accepted"
	StatusDeclined          = "declined"
	StatusInProgress        = "in_progress"
	StatusCompleted         = "completed"
	StatusCancelled         = "cancelled"
	StatusDisputed          = "disputed"
)

type Actor struct {
	UserID      string
	Roles       []string
	Permissions []string
}

type Order struct {
	ID                 string     `json:"id"`
	ClientUserID       string     `json:"client_user_id"`
	ClientDisplayName  string     `json:"client_display_name,omitempty"`
	CreatorUserID      string     `json:"creator_user_id"`
	CreatorDisplayName string     `json:"creator_display_name,omitempty"`
	CreatorSlug        string     `json:"creator_slug,omitempty"`
	ServiceID          string     `json:"service_id"`
	ServiceTitle       string     `json:"service_title,omitempty"`
	PackageID          string     `json:"package_id"`
	PackageName        string     `json:"package_name"`
	PackageDescription string     `json:"package_description"`
	PriceMinor         int64      `json:"price_minor"`
	Currency           string     `json:"currency"`
	DeliveryDays       int        `json:"delivery_days"`
	RevisionLimit      int        `json:"revision_limit"`
	BriefContent       string     `json:"brief_content"`
	Status             string     `json:"status"`
	AcceptedAt         *time.Time `json:"accepted_at,omitempty"`
	DeadlineAt         *time.Time `json:"deadline_at,omitempty"`
	CancelledAt        *time.Time `json:"cancelled_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type BriefVersion struct {
	ID              string    `json:"id"`
	OrderID         string    `json:"order_id"`
	Version         int       `json:"version"`
	Content         string    `json:"content"`
	SubmittedBy     string    `json:"submitted_by"`
	SubmittedByName string    `json:"submitted_by_name,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

type OrderEvent struct {
	ID          string    `json:"id"`
	OrderID     string    `json:"order_id"`
	ActorUserID string    `json:"actor_user_id"`
	ActorName   string    `json:"actor_name,omitempty"`
	FromStatus  string    `json:"from_status"`
	ToStatus    string    `json:"to_status"`
	Note        string    `json:"note,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type OrderDetail struct {
	Order
	Briefs []BriefVersion `json:"briefs"`
	Events []OrderEvent   `json:"events"`
}

type CreateInput struct {
	ServiceID    string
	PackageID    string
	BriefContent string
}

type Repository interface {
	Create(ctx context.Context, clientUserID string, input CreateInput, now time.Time) (Order, error)
	ListForClient(ctx context.Context, clientUserID string) ([]Order, error)
	GetForClient(ctx context.Context, clientUserID, orderID string) (OrderDetail, error)
	ListForCreator(ctx context.Context, creatorUserID string) ([]Order, error)
	GetForCreator(ctx context.Context, creatorUserID, orderID string) (OrderDetail, error)
	Accept(ctx context.Context, creatorUserID, orderID, note string, now time.Time) (Order, error)
	Decline(ctx context.Context, creatorUserID, orderID, note string, now time.Time) (Order, error)
	Cancel(ctx context.Context, actorID, orderID, note string, isClient bool, now time.Time) (Order, error)
	SubmitBrief(ctx context.Context, clientUserID, orderID, content string, now time.Time) (BriefVersion, error)
}
