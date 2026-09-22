package service

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/creatoros/platform/apps/api/internal/communication/domain"
)

type Service struct {
	repo domain.Repository
}

func New(repo domain.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetOrderThread(ctx context.Context, actor domain.Actor, orderID string) (domain.ConversationThread, error) {
	if !actor.HasPermission("messages.view") {
		return domain.ConversationThread{}, domain.ErrForbidden
	}

	clientUserID, creatorUserID, err := s.repo.GetOrderClientAndCreator(ctx, orderID)
	if err != nil {
		return domain.ConversationThread{}, err
	}

	if !actor.IsAdmin() && actor.UserID != clientUserID && actor.UserID != creatorUserID {
		return domain.ConversationThread{}, domain.ErrForbidden
	}

	thread, err := s.repo.GetOrCreateOrderThread(ctx, orderID, clientUserID, creatorUserID)
	if err != nil {
		return domain.ConversationThread{}, err
	}

	// Fetch recent messages (up to 50)
	messages, err := s.repo.ListMessages(ctx, thread.ID, nil, 50)
	if err != nil {
		return domain.ConversationThread{}, err
	}
	thread.Messages = messages

	// Mark participant as read
	_ = s.repo.UpdateParticipantRead(ctx, thread.ID, actor.UserID)

	return thread, nil
}

func (s *Service) ListThreadMessages(ctx context.Context, actor domain.Actor, threadID string, since *time.Time, limit int) ([]domain.Message, error) {
	if !actor.HasPermission("messages.view") {
		return nil, domain.ErrForbidden
	}

	_, participants, err := s.repo.GetThread(ctx, threadID)
	if err != nil {
		return nil, err
	}

	if !isParticipantOrAdmin(actor, participants) {
		return nil, domain.ErrForbidden
	}

	messages, err := s.repo.ListMessages(ctx, threadID, since, limit)
	if err != nil {
		return nil, err
	}

	_ = s.repo.UpdateParticipantRead(ctx, threadID, actor.UserID)

	return messages, nil
}

func (s *Service) SendMessage(ctx context.Context, actor domain.Actor, threadID string, input domain.SendMessageInput) (domain.Message, error) {
	if !actor.HasPermission("messages.send") {
		return domain.Message{}, domain.ErrForbidden
	}

	body := strings.TrimSpace(input.Body)
	if body == "" {
		return domain.Message{}, domain.ErrEmptyMessage
	}
	if utf8.RuneCountInString(body) > 5000 {
		return domain.Message{}, domain.ErrMessageTooLong
	}

	thread, participants, err := s.repo.GetThread(ctx, threadID)
	if err != nil {
		return domain.Message{}, err
	}

	if !isParticipantOrAdmin(actor, participants) {
		return domain.Message{}, domain.ErrForbidden
	}

	msg, err := s.repo.SendMessage(ctx, threadID, actor.UserID, body)
	if err != nil {
		return domain.Message{}, err
	}

	// Notify other participants
	snippet := body
	if utf8.RuneCountInString(snippet) > 100 {
		runes := []rune(snippet)
		snippet = string(runes[:97]) + "..."
	}

	senderName := msg.SenderName
	if senderName == "" {
		senderName = "A collaborator"
	}

	actionURL := ""
	if thread.OrderID != nil {
		actionURL = fmt.Sprintf("/orders/%s", *thread.OrderID)
	}

	for _, p := range participants {
		if p.UserID == actor.UserID {
			continue
		}

		// In-app notification
		_, _ = s.repo.CreateNotification(
			ctx,
			p.UserID,
			domain.NotificationNewMessage,
			fmt.Sprintf("New message from %s", senderName),
			snippet,
			actionURL,
		)

		// Check notification preferences for transactional email
		prefs, err := s.repo.GetNotificationPreferences(ctx, p.UserID)
		if err == nil && prefs.EmailNotifications && prefs.Messages {
			email, locale, err := s.repo.GetUserEmailAndLocale(ctx, p.UserID)
			if err == nil && email != "" {
				subject := fmt.Sprintf("New message from %s", senderName)
				_ = s.repo.EnqueueEmailNotification(ctx, email, locale, "new_message", subject, snippet)
			}
		}
	}

	return msg, nil
}

func (s *Service) ListNotifications(ctx context.Context, actor domain.Actor, unreadOnly bool, limit, offset int) ([]domain.Notification, int64, error) {
	if !actor.HasPermission("notifications.view") {
		return nil, 0, domain.ErrForbidden
	}
	return s.repo.ListNotifications(ctx, actor.UserID, unreadOnly, limit, offset)
}

func (s *Service) GetUnreadCount(ctx context.Context, actor domain.Actor) (int64, error) {
	if !actor.HasPermission("notifications.view") {
		return 0, domain.ErrForbidden
	}
	return s.repo.GetUnreadNotificationCount(ctx, actor.UserID)
}

func (s *Service) MarkNotificationRead(ctx context.Context, actor domain.Actor, notificationID string) error {
	if !actor.HasPermission("notifications.manage") {
		return domain.ErrForbidden
	}
	return s.repo.MarkNotificationRead(ctx, actor.UserID, notificationID)
}

func (s *Service) MarkAllNotificationsRead(ctx context.Context, actor domain.Actor) error {
	if !actor.HasPermission("notifications.manage") {
		return domain.ErrForbidden
	}
	return s.repo.MarkAllNotificationsRead(ctx, actor.UserID)
}

func (s *Service) GetNotificationPreferences(ctx context.Context, actor domain.Actor) (domain.NotificationPreferences, error) {
	return s.repo.GetNotificationPreferences(ctx, actor.UserID)
}

func (s *Service) UpdateNotificationPreferences(ctx context.Context, actor domain.Actor, input domain.UpdatePreferencesInput) (domain.NotificationPreferences, error) {
	if !actor.HasPermission("notifications.manage") {
		return domain.NotificationPreferences{}, domain.ErrForbidden
	}

	current, err := s.repo.GetNotificationPreferences(ctx, actor.UserID)
	if err != nil {
		return domain.NotificationPreferences{}, err
	}

	if input.EmailNotifications != nil {
		current.EmailNotifications = *input.EmailNotifications
	}
	if input.OrderUpdates != nil {
		current.OrderUpdates = *input.OrderUpdates
	}
	if input.Messages != nil {
		current.Messages = *input.Messages
	}

	return s.repo.UpdateNotificationPreferences(ctx, actor.UserID, current)
}

func isParticipantOrAdmin(actor domain.Actor, participants []domain.ConversationParticipant) bool {
	if actor.IsAdmin() {
		return true
	}
	for _, p := range participants {
		if p.UserID == actor.UserID {
			return true
		}
	}
	return false
}
