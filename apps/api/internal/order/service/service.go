package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/creatoros/platform/apps/api/internal/order/domain"
)

var (
	ErrValidation        = errors.New("order validation failed")
	ErrForbidden         = errors.New("forbidden")
	ErrNotFound          = errors.New("not found")
	ErrConflict          = errors.New("conflict")
	ErrInvalidTransition = errors.New("invalid transition")
	ErrSelfOrder         = errors.New("cannot order own service")
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type Service struct {
	repository domain.Repository
	now        func() time.Time
}

func New(repository domain.Repository) *Service {
	return &Service{
		repository: repository,
		now:        func() time.Time { return time.Now().UTC() },
	}
}

func (s *Service) Create(ctx context.Context, actor domain.Actor, input domain.CreateInput) (domain.Order, error) {
	if !hasAnyPermission(actor, "orders.create", "marketplace.purchase") {
		return domain.Order{}, ErrForbidden
	}
	input.ServiceID = strings.TrimSpace(input.ServiceID)
	input.PackageID = strings.TrimSpace(input.PackageID)
	input.BriefContent = strings.TrimSpace(input.BriefContent)

	if !uuidPattern.MatchString(input.ServiceID) || !uuidPattern.MatchString(input.PackageID) {
		return domain.Order{}, fmt.Errorf("%w: invalid service or package reference", ErrValidation)
	}
	briefLen := utf8.RuneCountInString(input.BriefContent)
	if briefLen < 20 || briefLen > 5000 {
		return domain.Order{}, fmt.Errorf("%w: brief content must be between 20 and 5000 characters", ErrValidation)
	}

	order, err := s.repository.Create(ctx, actor.UserID, input, s.now())
	return mapResult(order, err, "create order")
}

func (s *Service) ListClient(ctx context.Context, actor domain.Actor) ([]domain.Order, error) {
	if !hasAnyPermission(actor, "orders.create", "marketplace.purchase") {
		return nil, ErrForbidden
	}
	items, err := s.repository.ListForClient(ctx, actor.UserID)
	if err != nil {
		return nil, fmt.Errorf("list client orders: %w", err)
	}
	return items, nil
}

func (s *Service) GetClient(ctx context.Context, actor domain.Actor, orderID string) (domain.OrderDetail, error) {
	if !hasAnyPermission(actor, "orders.create", "marketplace.purchase") {
		return domain.OrderDetail{}, ErrForbidden
	}
	orderID = strings.TrimSpace(orderID)
	if !uuidPattern.MatchString(orderID) {
		return domain.OrderDetail{}, ErrNotFound
	}
	detail, err := s.repository.GetForClient(ctx, actor.UserID, orderID)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.OrderDetail{}, ErrNotFound
	}
	if err != nil {
		return domain.OrderDetail{}, fmt.Errorf("get client order: %w", err)
	}
	return detail, nil
}

func (s *Service) ListCreator(ctx context.Context, actor domain.Actor) ([]domain.Order, error) {
	if !hasAnyPermission(actor, "orders.manage", "creator.services.manage") {
		return nil, ErrForbidden
	}
	items, err := s.repository.ListForCreator(ctx, actor.UserID)
	if err != nil {
		return nil, fmt.Errorf("list creator orders: %w", err)
	}
	return items, nil
}

func (s *Service) GetCreator(ctx context.Context, actor domain.Actor, orderID string) (domain.OrderDetail, error) {
	if !hasAnyPermission(actor, "orders.manage", "creator.services.manage") {
		return domain.OrderDetail{}, ErrForbidden
	}
	orderID = strings.TrimSpace(orderID)
	if !uuidPattern.MatchString(orderID) {
		return domain.OrderDetail{}, ErrNotFound
	}
	detail, err := s.repository.GetForCreator(ctx, actor.UserID, orderID)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.OrderDetail{}, ErrNotFound
	}
	if err != nil {
		return domain.OrderDetail{}, fmt.Errorf("get creator order: %w", err)
	}
	return detail, nil
}

func (s *Service) Accept(ctx context.Context, actor domain.Actor, orderID, note string) (domain.Order, error) {
	if !hasAnyPermission(actor, "orders.manage", "creator.services.manage") {
		return domain.Order{}, ErrForbidden
	}
	orderID = strings.TrimSpace(orderID)
	if !uuidPattern.MatchString(orderID) {
		return domain.Order{}, ErrNotFound
	}
	note = strings.TrimSpace(note)
	if utf8.RuneCountInString(note) > 1000 {
		return domain.Order{}, fmt.Errorf("%w: note cannot exceed 1000 characters", ErrValidation)
	}
	order, err := s.repository.Accept(ctx, actor.UserID, orderID, note, s.now())
	return mapResult(order, err, "accept order")
}

func (s *Service) Decline(ctx context.Context, actor domain.Actor, orderID, note string) (domain.Order, error) {
	if !hasAnyPermission(actor, "orders.manage", "creator.services.manage") {
		return domain.Order{}, ErrForbidden
	}
	orderID = strings.TrimSpace(orderID)
	if !uuidPattern.MatchString(orderID) {
		return domain.Order{}, ErrNotFound
	}
	note = strings.TrimSpace(note)
	if utf8.RuneCountInString(note) > 1000 {
		return domain.Order{}, fmt.Errorf("%w: note cannot exceed 1000 characters", ErrValidation)
	}
	order, err := s.repository.Decline(ctx, actor.UserID, orderID, note, s.now())
	return mapResult(order, err, "decline order")
}

func (s *Service) Cancel(ctx context.Context, actor domain.Actor, orderID, note string) (domain.Order, error) {
	isClient := hasAnyPermission(actor, "orders.create", "marketplace.purchase")
	isCreator := hasAnyPermission(actor, "orders.manage", "creator.services.manage")
	if !isClient && !isCreator {
		return domain.Order{}, ErrForbidden
	}
	orderID = strings.TrimSpace(orderID)
	if !uuidPattern.MatchString(orderID) {
		return domain.Order{}, ErrNotFound
	}
	note = strings.TrimSpace(note)
	if utf8.RuneCountInString(note) > 1000 {
		return domain.Order{}, fmt.Errorf("%w: note cannot exceed 1000 characters", ErrValidation)
	}
	order, err := s.repository.Cancel(ctx, actor.UserID, orderID, note, isClient, s.now())
	return mapResult(order, err, "cancel order")
}

func (s *Service) SubmitBrief(ctx context.Context, actor domain.Actor, orderID, content string) (domain.BriefVersion, error) {
	if !hasAnyPermission(actor, "orders.create", "marketplace.purchase") {
		return domain.BriefVersion{}, ErrForbidden
	}
	orderID = strings.TrimSpace(orderID)
	if !uuidPattern.MatchString(orderID) {
		return domain.BriefVersion{}, ErrNotFound
	}
	content = strings.TrimSpace(content)
	contentLen := utf8.RuneCountInString(content)
	if contentLen < 20 || contentLen > 5000 {
		return domain.BriefVersion{}, fmt.Errorf("%w: brief content must be between 20 and 5000 characters", ErrValidation)
	}
	brief, err := s.repository.SubmitBrief(ctx, actor.UserID, orderID, content, s.now())
	switch {
	case errors.Is(err, domain.ErrNotFound):
		return domain.BriefVersion{}, ErrNotFound
	case errors.Is(err, domain.ErrForbidden):
		return domain.BriefVersion{}, ErrForbidden
	case errors.Is(err, domain.ErrInvalidTransition):
		return domain.BriefVersion{}, ErrInvalidTransition
	case err != nil:
		return domain.BriefVersion{}, fmt.Errorf("submit brief: %w", err)
	default:
		return brief, nil
	}
}

func mapResult(item domain.Order, err error, operation string) (domain.Order, error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		return domain.Order{}, ErrNotFound
	case errors.Is(err, domain.ErrConflict):
		return domain.Order{}, ErrConflict
	case errors.Is(err, domain.ErrForbidden):
		return domain.Order{}, ErrForbidden
	case errors.Is(err, domain.ErrInvalidTransition):
		return domain.Order{}, ErrInvalidTransition
	case errors.Is(err, domain.ErrSelfOrder):
		return domain.Order{}, ErrSelfOrder
	case err != nil:
		return domain.Order{}, fmt.Errorf("%s: %w", operation, err)
	default:
		return item, nil
	}
}

func hasAnyPermission(actor domain.Actor, perms ...string) bool {
	for _, perm := range perms {
		for _, actorPerm := range actor.Permissions {
			if actorPerm == perm {
				return true
			}
		}
	}
	return false
}
