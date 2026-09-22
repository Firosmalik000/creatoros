package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrDisputeNotFound        = errors.New("dispute not found")
	ErrDisputeAlreadyResolved = errors.New("dispute is already resolved")
	ErrUserNotFound           = errors.New("user not found")
	ErrCannotModifySelf       = errors.New("cannot perform this action on yourself")
	ErrUnauthorized           = errors.New("unauthorized admin operation")
	ErrInvalidStatus          = errors.New("invalid status transition")
	ErrCategoryNotFound       = errors.New("category not found")
	ErrCategorySlugExists     = errors.New("category slug already exists")
)

type DisputeStatus string

const (
	DisputeOpened                DisputeStatus = "opened"
	DisputeUnderReview           DisputeStatus = "under_review"
	DisputeResolvedClientRefund  DisputeStatus = "resolved_client_refund"
	DisputeResolvedCreatorPayout DisputeStatus = "resolved_creator_payout"
	DisputeDismissed             DisputeStatus = "dismissed"
)

type AuditLog struct {
	ID           string         `json:"id"`
	ActorUserID  *string        `json:"actor_user_id,omitempty"`
	ActorEmail   string         `json:"actor_email"`
	Action       string         `json:"action"`
	ResourceType string         `json:"resource_type"`
	ResourceID   string         `json:"resource_id"`
	Details      map[string]any `json:"details"`
	IPAddress    *string        `json:"ip_address,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
}

type OrderDispute struct {
	ID              string        `json:"id"`
	OrderID         string        `json:"order_id"`
	InitiatorUserID string        `json:"initiator_user_id"`
	Reason          string        `json:"reason"`
	Status          DisputeStatus `json:"status"`
	ResolutionNotes *string       `json:"resolution_notes,omitempty"`
	ResolvedBy      *string       `json:"resolved_by,omitempty"`
	ResolvedAt      *time.Time    `json:"resolved_at,omitempty"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}

type PlatformOverview struct {
	TotalUsers            int       `json:"total_users"`
	TotalCreators         int       `json:"total_creators"`
	TotalClients          int       `json:"total_clients"`
	TotalOrders           int       `json:"total_orders"`
	TotalCampaigns        int       `json:"total_campaigns"`
	TotalGMVMinor         int64     `json:"total_gmv_minor"`
	EscrowHeldMinor       int64     `json:"escrow_held_minor"`
	CommissionEarnedMinor int64     `json:"commission_earned_minor"`
	Currency              string    `json:"currency"`
	PendingVerifications  int       `json:"pending_verifications"`
	ActiveDisputes        int       `json:"active_disputes"`
	PendingPayouts        int       `json:"pending_payouts"`
	Timestamp             time.Time `json:"timestamp"`
}

type AdminUser struct {
	ID              string    `json:"id"`
	Email           string    `json:"email"`
	DisplayName     string    `json:"display_name"`
	Status          string    `json:"status"`
	PreferredLocale string    `json:"preferred_locale"`
	CreatedAt       time.Time `json:"created_at"`
	Roles           []string  `json:"roles"`
}

type AdminOrder struct {
	ID            string    `json:"id"`
	ClientID      string    `json:"client_id"`
	ClientEmail   string    `json:"client_email"`
	ClientName    string    `json:"client_name"`
	CreatorID     string    `json:"creator_id"`
	CreatorName   string    `json:"creator_name"`
	ServiceName   string    `json:"service_name"`
	PackageName   string    `json:"package_name"`
	PriceMinor    int64     `json:"price_minor"`
	Currency      string    `json:"currency"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
	HasDispute    bool      `json:"has_dispute"`
	DisputeStatus *string   `json:"dispute_status,omitempty"`
	DisputeReason *string   `json:"dispute_reason,omitempty"`
}

type AdminCampaign struct {
	ID             string    `json:"id"`
	Title          string    `json:"title"`
	ClientID       string    `json:"client_id"`
	ClientEmail    string    `json:"client_email"`
	ClientName     string    `json:"client_name"`
	BudgetMinor    int64     `json:"budget_minor"`
	Currency       string    `json:"currency"`
	TargetCreators int       `json:"target_creators"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
}

type AdminFinanceSummary struct {
	TotalGMVMinor            int64  `json:"total_gmv_minor"`
	TotalEscrowMinor         int64  `json:"total_escrow_minor"`
	TotalCommissionsMinor    int64  `json:"total_commissions_minor"`
	TotalPayoutsSettledMinor int64  `json:"total_payouts_settled_minor"`
	PendingPayoutsCount      int    `json:"pending_payouts_count"`
	PendingPayoutsSumMinor   int64  `json:"pending_payouts_sum_minor"`
	Currency                 string `json:"currency"`
}

type AdminCategory struct {
	ID        string    `json:"id"`
	Slug      string    `json:"slug"`
	NameID    string    `json:"name_id"`
	NameEN    string    `json:"name_en"`
	NameMS    string    `json:"name_ms"`
	SortOrder int       `json:"sort_order"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type Announcement struct {
	ID         string     `json:"id"`
	Title      string     `json:"title"`
	Body       string     `json:"body"`
	TargetRole string     `json:"target_role"`
	IsActive   bool       `json:"is_active"`
	StartsAt   time.Time  `json:"starts_at"`
	EndsAt     *time.Time `json:"ends_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

type Actor struct {
	ID          string
	Email       string
	Roles       []string
	Permissions []string
	IPAddress   string
}

func (a Actor) IsAdmin() bool {
	for _, r := range a.Roles {
		if r == "admin" || r == "agency_admin" {
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

type Repository interface {
	GetOverviewMetrics(ctx context.Context) (*PlatformOverview, error)
	ListUsers(ctx context.Context, roleFilter, statusFilter, search string, limit, offset int) ([]AdminUser, int, error)
	GetUser(ctx context.Context, userID string) (*AdminUser, error)
	UpdateUserStatus(ctx context.Context, userID, status string) error
	UpdateUserRoles(ctx context.Context, userID string, roles []string) error
	ListOrders(ctx context.Context, statusFilter, search string, limit, offset int) ([]AdminOrder, int, error)
	ListCampaigns(ctx context.Context, statusFilter, search string, limit, offset int) ([]AdminCampaign, int, error)
	ListDisputes(ctx context.Context, statusFilter string, limit, offset int) ([]OrderDispute, int, error)
	OpenDispute(ctx context.Context, orderID, initiatorID, reason string) (*OrderDispute, error)
	GetDisputeByOrderID(ctx context.Context, orderID string) (*OrderDispute, error)
	ResolveDispute(ctx context.Context, orderID, resolverID string, status DisputeStatus, notes string) error
	GetFinanceSummary(ctx context.Context) (*AdminFinanceSummary, error)
	ListCategories(ctx context.Context) ([]AdminCategory, error)
	CreateCategory(ctx context.Context, cat *AdminCategory) error
	UpdateCategory(ctx context.Context, cat *AdminCategory) error
	RecordAuditLog(ctx context.Context, log *AuditLog) error
	ListAuditLogs(ctx context.Context, actionFilter, resourceType string, limit, offset int) ([]AuditLog, int, error)
	CreateAnnouncement(ctx context.Context, ann *Announcement) error
	ListAnnouncements(ctx context.Context, targetRole string) ([]Announcement, error)
}

type Service interface {
	GetOverview(ctx context.Context, actor Actor) (*PlatformOverview, error)
	ListUsers(ctx context.Context, actor Actor, role, status, search string, limit, offset int) ([]AdminUser, int, error)
	GetUser(ctx context.Context, actor Actor, userID string) (*AdminUser, error)
	SetUserStatus(ctx context.Context, actor Actor, userID, status, reason string) error
	SetUserRoles(ctx context.Context, actor Actor, userID string, roles []string) error
	ListOrders(ctx context.Context, actor Actor, status, search string, limit, offset int) ([]AdminOrder, int, error)
	ListCampaigns(ctx context.Context, actor Actor, status, search string, limit, offset int) ([]AdminCampaign, int, error)
	ListDisputes(ctx context.Context, actor Actor, status string, limit, offset int) ([]OrderDispute, int, error)
	OpenDispute(ctx context.Context, actor Actor, orderID, reason string) (*OrderDispute, error)
	ResolveDispute(ctx context.Context, actor Actor, orderID string, resolution DisputeStatus, notes string) error
	GetFinanceOverview(ctx context.Context, actor Actor) (*AdminFinanceSummary, error)
	ListCategories(ctx context.Context, actor Actor) ([]AdminCategory, error)
	CreateCategory(ctx context.Context, actor Actor, cat *AdminCategory) error
	UpdateCategory(ctx context.Context, actor Actor, cat *AdminCategory) error
	ListAuditLogs(ctx context.Context, actor Actor, action, resourceType string, limit, offset int) ([]AuditLog, int, error)
	CreateAnnouncement(ctx context.Context, actor Actor, ann *Announcement) error
	ListAnnouncements(ctx context.Context, actor Actor, targetRole string) ([]Announcement, error)
}
