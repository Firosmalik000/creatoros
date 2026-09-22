package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound              = errors.New("workflow resource not found")
	ErrForbidden             = errors.New("workflow action forbidden")
	ErrInvalidTransition     = errors.New("invalid workflow transition")
	ErrRevisionLimitExceeded = errors.New("revision limit exceeded")
	ErrValidation            = errors.New("workflow validation failed")
)

const (
	SubmissionStatusSubmitted         = "submitted"
	SubmissionStatusRevisionRequested = "revision_requested"
	SubmissionStatusApproved          = "approved"
)

type Actor struct {
	UserID      string
	Roles       []string
	Permissions []string
}

type SubmissionFile struct {
	ID           string    `json:"id"`
	SubmissionID string    `json:"submission_id"`
	FilePath     string    `json:"file_path"`
	FileName     string    `json:"file_name"`
	MimeType     string    `json:"mime_type"`
	SizeBytes    int64     `json:"size_bytes"`
	CreatedAt    time.Time `json:"created_at"`
}

type SubmissionRevision struct {
	ID             string    `json:"id"`
	SubmissionID   string    `json:"submission_id"`
	OrderID        string    `json:"order_id"`
	ClientUserID   string    `json:"client_user_id"`
	ClientName     string    `json:"client_name,omitempty"`
	RevisionNumber int       `json:"revision_number"`
	Feedback       string    `json:"feedback"`
	CreatedAt      time.Time `json:"created_at"`
}

type Submission struct {
	ID            string               `json:"id"`
	OrderID       string               `json:"order_id"`
	Version       int                  `json:"version"`
	CreatorUserID string               `json:"creator_user_id"`
	CreatorName   string               `json:"creator_name,omitempty"`
	Title         string               `json:"title"`
	Notes         string               `json:"notes"`
	Status        string               `json:"status"`
	Files         []SubmissionFile     `json:"files"`
	Revisions     []SubmissionRevision `json:"revisions,omitempty"`
	CreatedAt     time.Time            `json:"created_at"`
	UpdatedAt     time.Time            `json:"updated_at"`
}

type WorkflowSummary struct {
	OrderID            string       `json:"order_id"`
	OrderStatus        string       `json:"order_status"`
	RevisionLimit      int          `json:"revision_limit"`
	RevisionsUsed      int          `json:"revisions_used"`
	RevisionsRemaining int          `json:"revisions_remaining"`
	Submissions        []Submission `json:"submissions"`
}

type FileInput struct {
	FilePath  string `json:"file_path"`
	FileName  string `json:"file_name"`
	MimeType  string `json:"mime_type"`
	SizeBytes int64  `json:"size_bytes"`
}

type SubmitInput struct {
	Title string      `json:"title"`
	Notes string      `json:"notes"`
	Files []FileInput `json:"files"`
}

type Repository interface {
	CreateSubmission(ctx context.Context, creatorUserID, orderID string, input SubmitInput, now time.Time) (Submission, error)
	GetWorkflow(ctx context.Context, actorID, orderID string, isCreator bool) (WorkflowSummary, error)
	RequestRevision(ctx context.Context, clientUserID, orderID, submissionID, feedback string, now time.Time) (SubmissionRevision, error)
	Approve(ctx context.Context, clientUserID, orderID, submissionID, note string, now time.Time) (Submission, error)
	GetFile(ctx context.Context, actorID, fileID string, isCreator bool) (SubmissionFile, error)
}
