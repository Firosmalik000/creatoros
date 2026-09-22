package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrThreadNotFound       = errors.New("conversation thread not found")
	ErrNotParticipant       = errors.New("user is not an authorized participant in this thread")
	ErrEmptyMessage         = errors.New("message content cannot be empty")
	ErrMessageTooLong       = errors.New("message content cannot exceed 5000 characters")
	ErrNotificationNotFound = errors.New("notification not found")
	ErrForbidden            = errors.New("forbidden")
	ErrInvalidRequest       = errors.New("invalid request")
)

type NotificationKind string

const (
	NotificationOrderUpdate        NotificationKind = "order_update"
	NotificationSubmissionReceived NotificationKind = "submission_received"
	NotificationRevisionRequested  NotificationKind = "revision_requested"
	NotificationSubmissionApproved NotificationKind = "submission_approved"
	NotificationPaymentReceived    NotificationKind = "payment_received"
	NotificationEscrowReleased     NotificationKind = "escrow_released"
	NotificationPayoutUpdate       NotificationKind = "payout_update"
	NotificationCampaignInvitation NotificationKind = "campaign_invitation"
	NotificationCampaignResponse   NotificationKind = "campaign_response"
	NotificationNewMessage         NotificationKind = "new_message"
	NotificationSystem             NotificationKind = "system"
)

type ConversationThread struct {
	ID           string                    `json:"id"`
	OrderID      *string                   `json:"order_id,omitempty"`
	CampaignID   *string                   `json:"campaign_id,omitempty"`
	CreatedAt    time.Time                 `json:"created_at"`
	UpdatedAt    time.Time                 `json:"updated_at"`
	Participants []ConversationParticipant `json:"participants,omitempty"`
	Messages     []Message                 `json:"messages,omitempty"`
}

type ConversationParticipant struct {
	ThreadID        string    `json:"thread_id"`
	UserID          string    `json:"user_id"`
	UserDisplayName string    `json:"user_display_name,omitempty"`
	LastReadAt      time.Time `json:"last_read_at"`
	JoinedAt        time.Time `json:"joined_at"`
}

type Message struct {
	ID             string    `json:"id"`
	ThreadID       string    `json:"thread_id"`
	SenderUserID   string    `json:"sender_user_id"`
	SenderName     string    `json:"sender_name,omitempty"`
	Body           string    `json:"body"`
	CreatedAt      time.Time `json:"created_at"`
}

type Notification struct {
	ID        string           `json:"id"`
	UserID    string           `json:"user_id"`
	Kind      NotificationKind `json:"kind"`
	Title     string           `json:"title"`
	Body      string           `json:"body"`
	ActionURL string           `json:"action_url"`
	IsRead    bool             `json:"is_read"`
	ReadAt    *time.Time       `json:"read_at,omitempty"`
	CreatedAt time.Time        `json:"created_at"`
}

type NotificationPreferences struct {
	UserID             string    `json:"user_id"`
	EmailNotifications bool      `json:"email_notifications"`
	OrderUpdates       bool      `json:"order_updates"`
	Messages           bool      `json:"messages"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type Actor struct {
	UserID      string
	Roles       []string
	Permissions []string
}

func (a Actor) HasRole(role string) bool {
	for _, r := range a.Roles {
		if r == role {
			return true
		}
	}
	return false
}

func (a Actor) HasPermission(perm string) bool {
	for _, p := range a.Permissions {
		if p == perm {
			return true
		}
	}
	return false
}

func (a Actor) IsAdmin() bool {
	return a.HasRole("agency_admin") || a.HasRole("admin")
}

// Service Inputs
type SendMessageInput struct {
	Body string `json:"body"`
}

type UpdatePreferencesInput struct {
	EmailNotifications *bool `json:"email_notifications,omitempty"`
	OrderUpdates       *bool `json:"order_updates,omitempty"`
	Messages           *bool `json:"messages,omitempty"`
}
type Repository interface {
	GetOrderClientAndCreator(ctx context.Context, orderID string) (clientUserID, creatorUserID string, err error)
	GetUserEmailAndLocale(ctx context.Context, userID string) (email, locale string, err error)
	GetOrCreateOrderThread(ctx context.Context, orderID, clientUserID, creatorUserID string) (ConversationThread, error)
	GetThread(ctx context.Context, threadID string) (ConversationThread, []ConversationParticipant, error)
	GetThreadByOrderID(ctx context.Context, orderID string) (ConversationThread, []ConversationParticipant, error)
	ListMessages(ctx context.Context, threadID string, since *time.Time, limit int) ([]Message, error)
	SendMessage(ctx context.Context, threadID, senderUserID, body string) (Message, error)
	UpdateParticipantRead(ctx context.Context, threadID, userID string) error
	CreateNotification(ctx context.Context, userID string, kind NotificationKind, title, body, actionURL string) (Notification, error)
	ListNotifications(ctx context.Context, userID string, unreadOnly bool, limit, offset int) ([]Notification, int64, error)
	GetUnreadNotificationCount(ctx context.Context, userID string) (int64, error)
	MarkNotificationRead(ctx context.Context, userID, notificationID string) error
	MarkAllNotificationsRead(ctx context.Context, userID string) error
	GetNotificationPreferences(ctx context.Context, userID string) (NotificationPreferences, error)
	UpdateNotificationPreferences(ctx context.Context, userID string, prefs NotificationPreferences) (NotificationPreferences, error)
	EnqueueEmailNotification(ctx context.Context, recipientEmail, locale, kind, subject, bodyCopy string) error
}

type Service interface {
	GetOrderThread(ctx context.Context, actor Actor, orderID string) (ConversationThread, error)
	ListThreadMessages(ctx context.Context, actor Actor, threadID string, since *time.Time, limit int) ([]Message, error)
	SendMessage(ctx context.Context, actor Actor, threadID string, input SendMessageInput) (Message, error)
	ListNotifications(ctx context.Context, actor Actor, unreadOnly bool, limit, offset int) ([]Notification, int64, error)
	GetUnreadCount(ctx context.Context, actor Actor) (int64, error)
	MarkNotificationRead(ctx context.Context, actor Actor, notificationID string) error
	MarkAllNotificationsRead(ctx context.Context, actor Actor) error
	GetNotificationPreferences(ctx context.Context, actor Actor) (NotificationPreferences, error)
	UpdateNotificationPreferences(ctx context.Context, actor Actor, input UpdatePreferencesInput) (NotificationPreferences, error)
}
