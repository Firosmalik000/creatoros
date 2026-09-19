package service

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/creatoros/platform/apps/api/internal/creator/domain"
)

var (
	ErrValidation        = errors.New("validation failed")
	ErrForbidden         = errors.New("forbidden")
	ErrNotFound          = errors.New("not found")
	ErrConflict          = errors.New("conflict")
	ErrIncomplete        = errors.New("creator profile is incomplete")
	ErrInvalidTransition = errors.New("invalid verification transition")
)

var slugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
var countryCodePattern = regexp.MustCompile(`^[A-Z]{2}$`)

type Service struct {
	repository domain.Repository
	now        func() time.Time
}

func New(repository domain.Repository) *Service {
	return &Service{repository: repository, now: func() time.Time { return time.Now().UTC() }}
}

func (service *Service) Catalog(ctx context.Context, locale string) ([]domain.CatalogItem, []domain.CatalogItem, error) {
	locale = normalizeLocale(locale)
	platforms, err := service.repository.ListPlatforms(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("list platforms: %w", err)
	}
	categories, err := service.repository.ListCategories(ctx, locale)
	if err != nil {
		return nil, nil, fmt.Errorf("list categories: %w", err)
	}
	return platforms, categories, nil
}

func (service *Service) GetOnboarding(ctx context.Context, actor domain.Actor, locale string) (domain.Onboarding, error) {
	if !hasRole(actor, "creator") {
		return domain.Onboarding{}, ErrForbidden
	}
	profile, err := service.repository.GetProfile(ctx, actor.UserID, normalizeLocale(locale))
	if errors.Is(err, domain.ErrNotFound) {
		return domain.Onboarding{}, ErrNotFound
	}
	if err != nil {
		return domain.Onboarding{}, fmt.Errorf("get creator profile: %w", err)
	}
	return onboarding(profile), nil
}

func (service *Service) SaveOnboarding(ctx context.Context, actor domain.Actor, input domain.SaveInput, locale string) (domain.Onboarding, error) {
	if !hasRole(actor, "creator") {
		return domain.Onboarding{}, ErrForbidden
	}
	normalized, err := validateAndNormalize(input)
	if err != nil {
		return domain.Onboarding{}, err
	}
	profile, err := service.repository.SaveProfile(ctx, actor.UserID, normalized, service.now())
	if errors.Is(err, domain.ErrConflict) {
		return domain.Onboarding{}, ErrConflict
	}
	if errors.Is(err, domain.ErrInvalidReference) {
		return domain.Onboarding{}, fmt.Errorf("%w: catalog reference", ErrValidation)
	}
	if errors.Is(err, domain.ErrForbidden) {
		return domain.Onboarding{}, ErrForbidden
	}
	if err != nil {
		return domain.Onboarding{}, fmt.Errorf("save creator profile: %w", err)
	}
	profile, err = service.repository.GetProfile(ctx, actor.UserID, normalizeLocale(locale))
	if err != nil {
		return domain.Onboarding{}, fmt.Errorf("reload creator profile: %w", err)
	}
	return onboarding(profile), nil
}

func (service *Service) Submit(ctx context.Context, actor domain.Actor, locale string) (domain.Onboarding, error) {
	if !hasRole(actor, "creator") {
		return domain.Onboarding{}, ErrForbidden
	}
	profile, err := service.repository.GetProfile(ctx, actor.UserID, normalizeLocale(locale))
	if errors.Is(err, domain.ErrNotFound) {
		return domain.Onboarding{}, ErrNotFound
	}
	if err != nil {
		return domain.Onboarding{}, fmt.Errorf("get profile before submit: %w", err)
	}
	result := onboarding(profile)
	if !result.Complete {
		return result, ErrIncomplete
	}
	profile, err = service.repository.SubmitVerification(ctx, actor.UserID, service.now())
	if errors.Is(err, domain.ErrInvalidTransition) {
		return domain.Onboarding{}, ErrInvalidTransition
	}
	if err != nil {
		return domain.Onboarding{}, fmt.Errorf("submit creator verification: %w", err)
	}
	return onboarding(profile), nil
}

func (service *Service) VerificationQueue(ctx context.Context, actor domain.Actor, status string, page, perPage int) ([]domain.ReviewItem, int, error) {
	if !hasPermission(actor, "creator.verification.review") {
		return nil, 0, ErrForbidden
	}
	status = strings.ToLower(strings.TrimSpace(status))
	if status == "" {
		status = "submitted"
	}
	if !validStatus(status) {
		return nil, 0, fmt.Errorf("%w: status", ErrValidation)
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	items, total, err := service.repository.ListVerificationQueue(ctx, status, perPage, (page-1)*perPage)
	if err != nil {
		return nil, 0, fmt.Errorf("list verification queue: %w", err)
	}
	return items, total, nil
}

func (service *Service) ReviewProfile(ctx context.Context, actor domain.Actor, creatorUserID, locale string) (domain.Onboarding, error) {
	if !hasPermission(actor, "creator.verification.review") {
		return domain.Onboarding{}, ErrForbidden
	}
	profile, err := service.repository.GetProfile(ctx, creatorUserID, normalizeLocale(locale))
	if errors.Is(err, domain.ErrNotFound) {
		return domain.Onboarding{}, ErrNotFound
	}
	if err != nil {
		return domain.Onboarding{}, fmt.Errorf("get creator review profile: %w", err)
	}
	return onboarding(profile), nil
}

func (service *Service) Review(ctx context.Context, actor domain.Actor, creatorUserID, decision, note, locale string) (domain.Onboarding, error) {
	if !hasPermission(actor, "creator.verification.review") {
		return domain.Onboarding{}, ErrForbidden
	}
	decision = strings.ToLower(strings.TrimSpace(decision))
	note = strings.TrimSpace(note)
	if creatorUserID == "" || !contains([]string{"verified", "revision_required", "rejected", "suspended"}, decision) || utf8.RuneCountInString(note) > 1000 {
		return domain.Onboarding{}, fmt.Errorf("%w: decision", ErrValidation)
	}
	if decision != "verified" && note == "" {
		return domain.Onboarding{}, fmt.Errorf("%w: note", ErrValidation)
	}
	profile, err := service.repository.ReviewVerification(ctx, creatorUserID, actor.UserID, decision, note, service.now())
	if errors.Is(err, domain.ErrNotFound) {
		return domain.Onboarding{}, ErrNotFound
	}
	if errors.Is(err, domain.ErrInvalidTransition) {
		return domain.Onboarding{}, ErrInvalidTransition
	}
	if err != nil {
		return domain.Onboarding{}, fmt.Errorf("review creator verification: %w", err)
	}
	profile, err = service.repository.GetProfile(ctx, profile.UserID, normalizeLocale(locale))
	if err != nil {
		return domain.Onboarding{}, fmt.Errorf("reload reviewed profile: %w", err)
	}
	return onboarding(profile), nil
}

func (service *Service) PublicProfile(ctx context.Context, slug, locale string) (domain.PublicProfile, error) {
	slug = strings.ToLower(strings.TrimSpace(slug))
	if !slugPattern.MatchString(slug) {
		return domain.PublicProfile{}, ErrNotFound
	}
	profile, err := service.repository.FindPublicProfile(ctx, slug, normalizeLocale(locale))
	if errors.Is(err, domain.ErrNotFound) {
		return domain.PublicProfile{}, ErrNotFound
	}
	if err != nil {
		return domain.PublicProfile{}, fmt.Errorf("find public creator: %w", err)
	}
	return domain.PublicProfile{
		DisplayName: profile.DisplayName, Slug: profile.Slug, Headline: profile.Headline,
		Bio: profile.Bio, City: profile.City, CountryCode: profile.CountryCode,
		Categories: profile.Categories, Languages: profile.Languages,
		SocialAccounts: profile.SocialAccounts, Portfolio: profile.Portfolio,
	}, nil
}

func validateAndNormalize(input domain.SaveInput) (domain.SaveInput, error) {
	input.Slug = strings.ToLower(strings.Trim(strings.TrimSpace(input.Slug), "-"))
	input.Headline = strings.TrimSpace(input.Headline)
	input.Bio = strings.TrimSpace(input.Bio)
	input.City = strings.TrimSpace(input.City)
	input.CountryCode = strings.ToUpper(strings.TrimSpace(input.CountryCode))
	if !slugPattern.MatchString(input.Slug) || len(input.Slug) > 80 {
		return input, fmt.Errorf("%w: slug", ErrValidation)
	}
	if !runeLength(input.Headline, 3, 120) || !runeLength(input.Bio, 20, 2000) || !runeLength(input.City, 2, 100) || !countryCodePattern.MatchString(input.CountryCode) {
		return input, fmt.Errorf("%w: profile", ErrValidation)
	}
	input.CategoryCodes = uniqueLower(input.CategoryCodes)
	input.Languages = uniqueLower(input.Languages)
	if len(input.CategoryCodes) > 5 || len(input.Languages) > 3 || len(input.SocialAccounts) > 8 || len(input.Portfolio) > 12 {
		return input, fmt.Errorf("%w: collection limit", ErrValidation)
	}
	for _, language := range input.Languages {
		if !contains([]string{"id", "en", "ms"}, language) {
			return input, fmt.Errorf("%w: language", ErrValidation)
		}
	}
	seenPlatforms := map[string]bool{}
	for index := range input.SocialAccounts {
		account := &input.SocialAccounts[index]
		account.PlatformCode = strings.ToLower(strings.TrimSpace(account.PlatformCode))
		account.Handle = strings.TrimPrefix(strings.TrimSpace(account.Handle), "@")
		account.ProfileURL = strings.TrimSpace(account.ProfileURL)
		if account.PlatformCode == "" || !runeLength(account.Handle, 1, 100) || seenPlatforms[account.PlatformCode] || !validHTTPSURL(account.ProfileURL) || account.FollowerCount < 0 || account.AverageViews < 0 || account.EngagementBPS < 0 || account.EngagementBPS > 10000 {
			return input, fmt.Errorf("%w: social_accounts", ErrValidation)
		}
		seenPlatforms[account.PlatformCode] = true
	}
	for index := range input.Portfolio {
		item := &input.Portfolio[index]
		item.Title = strings.TrimSpace(item.Title)
		item.Description = strings.TrimSpace(item.Description)
		item.MediaURL = strings.TrimSpace(item.MediaURL)
		item.ThumbnailURL = strings.TrimSpace(item.ThumbnailURL)
		item.SortOrder = index
		if !runeLength(item.Title, 2, 120) || utf8.RuneCountInString(item.Description) > 1000 || !validHTTPSURL(item.MediaURL) || (item.ThumbnailURL != "" && !validHTTPSURL(item.ThumbnailURL)) {
			return input, fmt.Errorf("%w: portfolio", ErrValidation)
		}
	}
	return input, nil
}

func onboarding(profile domain.Profile) domain.Onboarding {
	missing := make([]string, 0, 6)
	if profile.Slug == "" || profile.Headline == "" || profile.Bio == "" || profile.City == "" || profile.CountryCode == "" {
		missing = append(missing, "profile")
	}
	if len(profile.Categories) == 0 {
		missing = append(missing, "categories")
	}
	if len(profile.Languages) == 0 {
		missing = append(missing, "languages")
	}
	if len(profile.SocialAccounts) == 0 {
		missing = append(missing, "social_accounts")
	}
	if len(profile.Portfolio) == 0 {
		missing = append(missing, "portfolio")
	}
	return domain.Onboarding{Profile: profile, Complete: len(missing) == 0, MissingFields: missing}
}

func hasRole(actor domain.Actor, role string) bool { return contains(actor.Roles, role) }
func hasPermission(actor domain.Actor, permission string) bool {
	return contains(actor.Permissions, permission)
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func uniqueLower(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.ToLower(strings.TrimSpace(value))
		if value != "" && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	sort.Strings(result)
	return result
}

func validHTTPSURL(value string) bool {
	parsed, err := url.ParseRequestURI(value)
	return err == nil && parsed.Scheme == "https" && parsed.Host != "" && parsed.User == nil
}

func runeLength(value string, minimum, maximum int) bool {
	length := utf8.RuneCountInString(value)
	return length >= minimum && length <= maximum
}

func normalizeLocale(locale string) string {
	locale = strings.ToLower(strings.TrimSpace(locale))
	if !contains([]string{"id", "en", "ms"}, locale) {
		return "id"
	}
	return locale
}

func validStatus(status string) bool {
	return contains([]string{"draft", "submitted", "under_review", "revision_required", "verified", "rejected", "suspended"}, status)
}
