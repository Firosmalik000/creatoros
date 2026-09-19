package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound          = errors.New("creator not found")
	ErrConflict          = errors.New("creator conflict")
	ErrForbidden         = errors.New("creator action forbidden")
	ErrInvalidReference  = errors.New("invalid creator reference")
	ErrInvalidTransition = errors.New("invalid creator verification transition")
)

type Actor struct {
	UserID      string
	Roles       []string
	Permissions []string
}

type CatalogItem struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type SocialAccount struct {
	PlatformCode  string `json:"platform_code"`
	PlatformName  string `json:"platform_name,omitempty"`
	Handle        string `json:"handle"`
	ProfileURL    string `json:"profile_url"`
	FollowerCount int64  `json:"follower_count"`
	AverageViews  int64  `json:"average_views"`
	EngagementBPS int    `json:"engagement_bps"`
}

type PortfolioItem struct {
	ID           string `json:"id,omitempty"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	MediaURL     string `json:"media_url"`
	ThumbnailURL string `json:"thumbnail_url,omitempty"`
	SortOrder    int    `json:"sort_order"`
}

type Profile struct {
	UserID             string          `json:"user_id"`
	DisplayName        string          `json:"display_name"`
	Slug               string          `json:"slug"`
	Headline           string          `json:"headline"`
	Bio                string          `json:"bio"`
	City               string          `json:"city"`
	CountryCode        string          `json:"country_code"`
	VerificationStatus string          `json:"verification_status"`
	SubmittedAt        *time.Time      `json:"submitted_at"`
	ReviewedAt         *time.Time      `json:"reviewed_at"`
	ReviewNote         string          `json:"review_note,omitempty"`
	Categories         []CatalogItem   `json:"categories"`
	Languages          []string        `json:"languages"`
	SocialAccounts     []SocialAccount `json:"social_accounts"`
	Portfolio          []PortfolioItem `json:"portfolio"`
	CreatedAt          *time.Time      `json:"created_at"`
	UpdatedAt          *time.Time      `json:"updated_at"`
}

type Onboarding struct {
	Profile
	Complete      bool     `json:"complete"`
	MissingFields []string `json:"missing_fields"`
}

type PublicProfile struct {
	DisplayName    string          `json:"display_name"`
	Slug           string          `json:"slug"`
	Headline       string          `json:"headline"`
	Bio            string          `json:"bio"`
	City           string          `json:"city"`
	CountryCode    string          `json:"country_code"`
	Categories     []CatalogItem   `json:"categories"`
	Languages      []string        `json:"languages"`
	SocialAccounts []SocialAccount `json:"social_accounts"`
	Portfolio      []PortfolioItem `json:"portfolio"`
}

type DirectoryFilters struct {
	Query         string
	Category      string
	Language      string
	CountryCode   string
	Sort          string
	Page          int
	PerPage       int
	FavoritesOnly bool
}

type DirectoryCard struct {
	DisplayName   string        `json:"display_name"`
	Slug          string        `json:"slug"`
	Headline      string        `json:"headline"`
	City          string        `json:"city"`
	CountryCode   string        `json:"country_code"`
	Categories    []CatalogItem `json:"categories"`
	Languages     []string      `json:"languages"`
	Followers     int64         `json:"followers"`
	EngagementBPS int           `json:"engagement_bps"`
	CoverURL      string        `json:"cover_url,omitempty"`
	IsFavorite    bool          `json:"is_favorite"`
}

type DirectoryResult struct {
	Items []DirectoryCard `json:"items"`
	Total int             `json:"total"`
}

type SaveInput struct {
	Slug           string
	Headline       string
	Bio            string
	City           string
	CountryCode    string
	CategoryCodes  []string
	Languages      []string
	SocialAccounts []SocialAccount
	Portfolio      []PortfolioItem
}

type ReviewItem struct {
	UserID      string     `json:"user_id"`
	DisplayName string     `json:"display_name"`
	Slug        string     `json:"slug"`
	Headline    string     `json:"headline"`
	City        string     `json:"city"`
	CountryCode string     `json:"country_code"`
	Status      string     `json:"status"`
	SubmittedAt *time.Time `json:"submitted_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type Repository interface {
	ListPlatforms(context.Context) ([]CatalogItem, error)
	ListCategories(context.Context, string) ([]CatalogItem, error)
	GetProfile(context.Context, string, string) (Profile, error)
	SaveProfile(context.Context, string, SaveInput, time.Time) (Profile, error)
	SubmitVerification(context.Context, string, time.Time) (Profile, error)
	ListVerificationQueue(context.Context, string, int, int) ([]ReviewItem, int, error)
	ReviewVerification(context.Context, string, string, string, string, time.Time) (Profile, error)
	FindPublicProfile(context.Context, string, string) (Profile, error)
	ListDirectory(context.Context, DirectoryFilters, string, string) (DirectoryResult, error)
	AddFavorite(context.Context, string, string, time.Time) error
	RemoveFavorite(context.Context, string, string) error
}
