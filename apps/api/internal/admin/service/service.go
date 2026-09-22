package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/creatoros/platform/apps/api/internal/admin/domain"
)

type AdminService struct {
	repo domain.Repository
}

func NewAdminService(repo domain.Repository) *AdminService {
	return &AdminService{repo: repo}
}

func (s *AdminService) requireAdmin(actor domain.Actor, permission string) error {
	if !actor.IsAdmin() && !actor.HasPermission(permission) {
		return domain.ErrUnauthorized
	}
	return nil
}

func (s *AdminService) GetOverview(ctx context.Context, actor domain.Actor) (*domain.PlatformOverview, error) {
	if err := s.requireAdmin(actor, "admin.access"); err != nil {
		return nil, err
	}
	return s.repo.GetOverviewMetrics(ctx)
}

func (s *AdminService) ListUsers(ctx context.Context, actor domain.Actor, role, status, search string, limit, offset int) ([]domain.AdminUser, int, error) {
	if err := s.requireAdmin(actor, "users.manage"); err != nil {
		return nil, 0, err
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	return s.repo.ListUsers(ctx, role, status, search, limit, offset)
}

func (s *AdminService) GetUser(ctx context.Context, actor domain.Actor, userID string) (*domain.AdminUser, error) {
	if err := s.requireAdmin(actor, "users.manage"); err != nil {
		return nil, err
	}
	return s.repo.GetUser(ctx, userID)
}

func (s *AdminService) SetUserStatus(ctx context.Context, actor domain.Actor, userID, status, reason string) error {
	if err := s.requireAdmin(actor, "users.manage"); err != nil {
		return err
	}
	if actor.ID == userID {
		return domain.ErrCannotModifySelf
	}
	if status != "active" && status != "disabled" && status != "pending_verification" {
		return domain.ErrInvalidStatus
	}

	if err := s.repo.UpdateUserStatus(ctx, userID, status); err != nil {
		return err
	}

	// Record audit log
	actorID := actor.ID
	ip := actor.IPAddress
	_ = s.repo.RecordAuditLog(ctx, &domain.AuditLog{
		ActorUserID:  &actorID,
		ActorEmail:   actor.Email,
		Action:       "user.status_update",
		ResourceType: "user",
		ResourceID:   userID,
		Details: map[string]any{
			"new_status": status,
			"reason":     reason,
		},
		IPAddress: &ip,
	})

	return nil
}

func (s *AdminService) SetUserRoles(ctx context.Context, actor domain.Actor, userID string, roles []string) error {
	if err := s.requireAdmin(actor, "users.manage"); err != nil {
		return err
	}
	if actor.ID == userID {
		return domain.ErrCannotModifySelf
	}

	if err := s.repo.UpdateUserRoles(ctx, userID, roles); err != nil {
		return err
	}

	// Record audit log
	actorID := actor.ID
	ip := actor.IPAddress
	_ = s.repo.RecordAuditLog(ctx, &domain.AuditLog{
		ActorUserID:  &actorID,
		ActorEmail:   actor.Email,
		Action:       "user.roles_update",
		ResourceType: "user",
		ResourceID:   userID,
		Details: map[string]any{
			"roles": roles,
		},
		IPAddress: &ip,
	})

	return nil
}

func (s *AdminService) ListOrders(ctx context.Context, actor domain.Actor, status, search string, limit, offset int) ([]domain.AdminOrder, int, error) {
	if err := s.requireAdmin(actor, "admin.access"); err != nil {
		return nil, 0, err
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	return s.repo.ListOrders(ctx, status, search, limit, offset)
}

func (s *AdminService) ListCampaigns(ctx context.Context, actor domain.Actor, status, search string, limit, offset int) ([]domain.AdminCampaign, int, error) {
	if err := s.requireAdmin(actor, "admin.access"); err != nil {
		return nil, 0, err
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	return s.repo.ListCampaigns(ctx, status, search, limit, offset)
}

func (s *AdminService) ListDisputes(ctx context.Context, actor domain.Actor, status string, limit, offset int) ([]domain.OrderDispute, int, error) {
	if err := s.requireAdmin(actor, "disputes.manage"); err != nil {
		return nil, 0, err
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	return s.repo.ListDisputes(ctx, status, limit, offset)
}

func (s *AdminService) OpenDispute(ctx context.Context, actor domain.Actor, orderID, reason string) (*domain.OrderDispute, error) {
	if strings.TrimSpace(reason) == "" {
		return nil, fmt.Errorf("reason cannot be empty")
	}

	dispute, err := s.repo.OpenDispute(ctx, orderID, actor.ID, reason)
	if err != nil {
		return nil, err
	}

	actorID := actor.ID
	ip := actor.IPAddress
	_ = s.repo.RecordAuditLog(ctx, &domain.AuditLog{
		ActorUserID:  &actorID,
		ActorEmail:   actor.Email,
		Action:       "dispute.opened",
		ResourceType: "order",
		ResourceID:   orderID,
		Details: map[string]any{
			"reason": reason,
		},
		IPAddress: &ip,
	})

	return dispute, nil
}

func (s *AdminService) ResolveDispute(ctx context.Context, actor domain.Actor, orderID string, resolution domain.DisputeStatus, notes string) error {
	if err := s.requireAdmin(actor, "disputes.manage"); err != nil {
		return err
	}

	if resolution != domain.DisputeResolvedClientRefund &&
		resolution != domain.DisputeResolvedCreatorPayout &&
		resolution != domain.DisputeDismissed {
		return domain.ErrInvalidStatus
	}

	if err := s.repo.ResolveDispute(ctx, orderID, actor.ID, resolution, notes); err != nil {
		return err
	}

	actorID := actor.ID
	ip := actor.IPAddress
	_ = s.repo.RecordAuditLog(ctx, &domain.AuditLog{
		ActorUserID:  &actorID,
		ActorEmail:   actor.Email,
		Action:       "dispute.resolved",
		ResourceType: "order",
		ResourceID:   orderID,
		Details: map[string]any{
			"resolution": resolution,
			"notes":      notes,
		},
		IPAddress: &ip,
	})

	return nil
}

func (s *AdminService) GetFinanceOverview(ctx context.Context, actor domain.Actor) (*domain.AdminFinanceSummary, error) {
	if err := s.requireAdmin(actor, "finance.manage"); err != nil {
		return nil, err
	}
	return s.repo.GetFinanceSummary(ctx)
}

func (s *AdminService) ListCategories(ctx context.Context, actor domain.Actor) ([]domain.AdminCategory, error) {
	// Categories list can be read by any admin
	if err := s.requireAdmin(actor, "admin.access"); err != nil {
		return nil, err
	}
	return s.repo.ListCategories(ctx)
}

func (s *AdminService) CreateCategory(ctx context.Context, actor domain.Actor, cat *domain.AdminCategory) error {
	if err := s.requireAdmin(actor, "categories.manage"); err != nil {
		return err
	}
	if strings.TrimSpace(cat.Slug) == "" || strings.TrimSpace(cat.NameEN) == "" {
		return fmt.Errorf("slug and name are required")
	}
	if cat.NameID == "" {
		cat.NameID = cat.NameEN
	}
	if cat.NameMS == "" {
		cat.NameMS = cat.NameEN
	}

	if err := s.repo.CreateCategory(ctx, cat); err != nil {
		return err
	}

	actorID := actor.ID
	ip := actor.IPAddress
	_ = s.repo.RecordAuditLog(ctx, &domain.AuditLog{
		ActorUserID:  &actorID,
		ActorEmail:   actor.Email,
		Action:       "category.created",
		ResourceType: "category",
		ResourceID:   cat.ID,
		Details: map[string]any{
			"slug":    cat.Slug,
			"name_en": cat.NameEN,
		},
		IPAddress: &ip,
	})

	return nil
}

func (s *AdminService) UpdateCategory(ctx context.Context, actor domain.Actor, cat *domain.AdminCategory) error {
	if err := s.requireAdmin(actor, "categories.manage"); err != nil {
		return err
	}
	if strings.TrimSpace(cat.NameEN) == "" {
		return fmt.Errorf("name is required")
	}
	if cat.NameID == "" {
		cat.NameID = cat.NameEN
	}
	if cat.NameMS == "" {
		cat.NameMS = cat.NameEN
	}

	if err := s.repo.UpdateCategory(ctx, cat); err != nil {
		return err
	}

	actorID := actor.ID
	ip := actor.IPAddress
	_ = s.repo.RecordAuditLog(ctx, &domain.AuditLog{
		ActorUserID:  &actorID,
		ActorEmail:   actor.Email,
		Action:       "category.updated",
		ResourceType: "category",
		ResourceID:   cat.ID,
		Details: map[string]any{
			"name_en":   cat.NameEN,
			"is_active": cat.IsActive,
		},
		IPAddress: &ip,
	})

	return nil
}

func (s *AdminService) ListAuditLogs(ctx context.Context, actor domain.Actor, action, resourceType string, limit, offset int) ([]domain.AuditLog, int, error) {
	if err := s.requireAdmin(actor, "audit.view"); err != nil {
		return nil, 0, err
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	return s.repo.ListAuditLogs(ctx, action, resourceType, limit, offset)
}

func (s *AdminService) CreateAnnouncement(ctx context.Context, actor domain.Actor, ann *domain.Announcement) error {
	if err := s.requireAdmin(actor, "admin.access"); err != nil {
		return err
	}
	if strings.TrimSpace(ann.Title) == "" || strings.TrimSpace(ann.Body) == "" {
		return fmt.Errorf("title and body are required")
	}
	if ann.StartsAt.IsZero() {
		ann.StartsAt = time.Now().UTC()
	}
	return s.repo.CreateAnnouncement(ctx, ann)
}

func (s *AdminService) ListAnnouncements(ctx context.Context, actor domain.Actor, targetRole string) ([]domain.Announcement, error) {
	return s.repo.ListAnnouncements(ctx, targetRole)
}
