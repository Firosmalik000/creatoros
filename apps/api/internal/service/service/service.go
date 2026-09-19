package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/creatoros/platform/apps/api/internal/service/domain"
)

var (
	ErrValidation        = errors.New("validation failed")
	ErrForbidden         = errors.New("forbidden")
	ErrNotFound          = errors.New("not found")
	ErrConflict          = errors.New("conflict")
	ErrInvalidTransition = errors.New("invalid transition")
)

var slugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type Service struct {
	repository domain.Repository
	now        func() time.Time
}

func New(repository domain.Repository) *Service {
	return &Service{repository: repository, now: func() time.Time { return time.Now().UTC() }}
}

func (service *Service) ListOwn(ctx context.Context, actor domain.Actor) ([]domain.Service, error) {
	if !canManage(actor) {
		return nil, ErrForbidden
	}
	items, err := service.repository.ListOwn(ctx, actor.UserID)
	if err != nil {
		return nil, fmt.Errorf("list own services: %w", err)
	}
	return items, nil
}

func (service *Service) GetOwn(ctx context.Context, actor domain.Actor, serviceID string) (domain.Service, error) {
	if !canManage(actor) {
		return domain.Service{}, ErrForbidden
	}
	serviceID = strings.TrimSpace(serviceID)
	if !uuidPattern.MatchString(serviceID) {
		return domain.Service{}, ErrNotFound
	}
	item, err := service.repository.GetOwn(ctx, actor.UserID, serviceID)
	return mapResult(item, err, "get own service")
}

func (service *Service) Create(ctx context.Context, actor domain.Actor, input domain.SaveInput) (domain.Service, error) {
	return service.save(ctx, actor, "", input)
}

func (service *Service) Update(ctx context.Context, actor domain.Actor, serviceID string, input domain.SaveInput) (domain.Service, error) {
	serviceID = strings.TrimSpace(serviceID)
	if !uuidPattern.MatchString(serviceID) {
		return domain.Service{}, ErrNotFound
	}
	return service.save(ctx, actor, serviceID, input)
}

func (service *Service) save(ctx context.Context, actor domain.Actor, serviceID string, input domain.SaveInput) (domain.Service, error) {
	if !canManage(actor) {
		return domain.Service{}, ErrForbidden
	}
	normalized, err := validateAndNormalize(input)
	if err != nil {
		return domain.Service{}, err
	}
	item, err := service.repository.Save(ctx, actor.UserID, serviceID, normalized, service.now())
	return mapResult(item, err, "save service")
}

func (service *Service) Publish(ctx context.Context, actor domain.Actor, serviceID string) (domain.Service, error) {
	if !canManage(actor) {
		return domain.Service{}, ErrForbidden
	}
	serviceID = strings.TrimSpace(serviceID)
	if !uuidPattern.MatchString(serviceID) {
		return domain.Service{}, ErrNotFound
	}
	item, err := service.repository.Publish(ctx, actor.UserID, serviceID, service.now())
	return mapResult(item, err, "publish service")
}

func (service *Service) Unpublish(ctx context.Context, actor domain.Actor, serviceID string) (domain.Service, error) {
	if !canManage(actor) {
		return domain.Service{}, ErrForbidden
	}
	serviceID = strings.TrimSpace(serviceID)
	if !uuidPattern.MatchString(serviceID) {
		return domain.Service{}, ErrNotFound
	}
	item, err := service.repository.Unpublish(ctx, actor.UserID, serviceID, service.now())
	return mapResult(item, err, "unpublish service")
}

func (service *Service) ListPublic(ctx context.Context, creatorSlug string) ([]domain.Service, error) {
	creatorSlug = normalizeSlug(creatorSlug)
	if !slugPattern.MatchString(creatorSlug) {
		return nil, ErrNotFound
	}
	items, err := service.repository.ListPublic(ctx, creatorSlug)
	if errors.Is(err, domain.ErrNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("list public services: %w", err)
	}
	return items, nil
}

func (service *Service) PublicDetail(ctx context.Context, creatorSlug, serviceSlug string) (domain.Service, error) {
	creatorSlug, serviceSlug = normalizeSlug(creatorSlug), normalizeSlug(serviceSlug)
	if !slugPattern.MatchString(creatorSlug) || !slugPattern.MatchString(serviceSlug) {
		return domain.Service{}, ErrNotFound
	}
	item, err := service.repository.FindPublic(ctx, creatorSlug, serviceSlug)
	return mapResult(item, err, "find public service")
}

func validateAndNormalize(input domain.SaveInput) (domain.SaveInput, error) {
	input.Slug = normalizeSlug(input.Slug)
	input.Title = strings.TrimSpace(input.Title)
	input.Description = strings.TrimSpace(input.Description)
	if !slugPattern.MatchString(input.Slug) || len(input.Slug) > 80 || !runeLength(input.Title, 3, 120) || !runeLength(input.Description, 20, 3000) || len(input.Packages) < 1 || len(input.Packages) > 3 {
		return input, fmt.Errorf("%w: service", ErrValidation)
	}
	for index := range input.Packages {
		item := &input.Packages[index]
		item.Name = strings.TrimSpace(item.Name)
		item.Description = strings.TrimSpace(item.Description)
		item.Currency = strings.ToUpper(strings.TrimSpace(item.Currency))
		item.SortOrder = index
		if !runeLength(item.Name, 2, 80) || utf8.RuneCountInString(item.Description) > 1000 || item.PriceMinor < 1 || item.PriceMinor > 1_000_000_000_000 || !contains([]string{"IDR", "MYR", "USD"}, item.Currency) || item.DeliveryDays < 1 || item.DeliveryDays > 365 || item.RevisionLimit < 0 || item.RevisionLimit > 20 {
			return input, fmt.Errorf("%w: packages", ErrValidation)
		}
	}
	return input, nil
}

func mapResult(item domain.Service, err error, operation string) (domain.Service, error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		return domain.Service{}, ErrNotFound
	case errors.Is(err, domain.ErrConflict):
		return domain.Service{}, ErrConflict
	case errors.Is(err, domain.ErrForbidden):
		return domain.Service{}, ErrForbidden
	case errors.Is(err, domain.ErrInvalidTransition):
		return domain.Service{}, ErrInvalidTransition
	case err != nil:
		return domain.Service{}, fmt.Errorf("%s: %w", operation, err)
	default:
		return item, nil
	}
}

func canManage(actor domain.Actor) bool {
	for _, permission := range actor.Permissions {
		if permission == "creator.services.manage" {
			return true
		}
	}
	return false
}

func normalizeSlug(value string) string {
	return strings.ToLower(strings.Trim(strings.TrimSpace(value), "-"))
}

func runeLength(value string, minimum, maximum int) bool {
	length := utf8.RuneCountInString(value)
	return length >= minimum && length <= maximum
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
