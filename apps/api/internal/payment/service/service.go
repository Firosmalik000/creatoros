package service

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/creatoros/platform/apps/api/internal/payment/domain"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

const DefaultCommissionBps = 1500 // 15% platform commission

type Service struct {
	repository domain.Repository
	provider   domain.PaymentProvider
	now        func() time.Time
}

func New(repository domain.Repository, provider domain.PaymentProvider) *Service {
	return &Service{
		repository: repository,
		provider:   provider,
		now:        func() time.Time { return time.Now().UTC() },
	}
}

func (s *Service) PayOrder(ctx context.Context, actor domain.Actor, orderID string, input domain.PayOrderInput) (domain.Payment, error) {
	if !hasAnyPermission(actor, "payments.pay") {
		return domain.Payment{}, domain.ErrForbidden
	}

	orderID = strings.TrimSpace(orderID)
	if !uuidPattern.MatchString(orderID) {
		return domain.Payment{}, fmt.Errorf("%w: invalid order ID", domain.ErrValidation)
	}

	method := strings.TrimSpace(strings.ToLower(input.PaymentMethod))
	if method == "" {
		method = "simulated"
	}
	switch method {
	case "simulated", "bank_transfer", "credit_card", "e_wallet":
	default:
		return domain.Payment{}, fmt.Errorf("%w: unsupported payment method '%s'", domain.ErrValidation, method)
	}

	clientUserID, creatorUserID, priceMinor, currency, orderStatus, err := s.repository.GetOrderClientAndCreator(ctx, orderID)
	if err != nil {
		return domain.Payment{}, err
	}

	if actor.UserID != clientUserID && !hasRole(actor, "agency_admin") {
		return domain.Payment{}, domain.ErrForbidden
	}

	if orderStatus == "cancelled" || orderStatus == "refunded" {
		return domain.Payment{}, fmt.Errorf("%w: cannot pay for %s order", domain.ErrInvalidStatus, orderStatus)
	}

	// Create intent with payment provider
	providerTxID, err := s.provider.CreateIntent(ctx, orderID, priceMinor, currency)
	if err != nil {
		return domain.Payment{}, fmt.Errorf("create provider intent: %w", err)
	}

	payment, err := s.repository.CreateOrderPayment(ctx, orderID, clientUserID, creatorUserID, priceMinor, currency, method, s.provider.Name(), providerTxID)
	if err != nil {
		return domain.Payment{}, err
	}

	return payment, nil
}

func (s *Service) GetOrderPayment(ctx context.Context, actor domain.Actor, orderID string) (domain.Payment, error) {
	if !hasAnyPermission(actor, "payments.view") {
		return domain.Payment{}, domain.ErrForbidden
	}

	orderID = strings.TrimSpace(orderID)
	if !uuidPattern.MatchString(orderID) {
		return domain.Payment{}, fmt.Errorf("%w: invalid order ID", domain.ErrValidation)
	}

	payment, err := s.repository.GetPaymentByOrderID(ctx, orderID)
	if err != nil {
		return domain.Payment{}, err
	}

	if actor.UserID != payment.ClientUserID && actor.UserID != payment.CreatorUserID && !hasRole(actor, "agency_admin") {
		return domain.Payment{}, domain.ErrForbidden
	}

	return payment, nil
}

func (s *Service) ReleaseOrderEscrow(ctx context.Context, actor domain.Actor, orderID string) (domain.Payment, error) {
	orderID = strings.TrimSpace(orderID)
	if !uuidPattern.MatchString(orderID) {
		return domain.Payment{}, fmt.Errorf("%w: invalid order ID", domain.ErrValidation)
	}

	payment, err := s.repository.GetPaymentByOrderID(ctx, orderID)
	if err != nil {
		return domain.Payment{}, err
	}

	// Only order client or agency admin can release escrow
	if actor.UserID != payment.ClientUserID && !hasRole(actor, "agency_admin") {
		return domain.Payment{}, domain.ErrForbidden
	}

	if payment.Status != domain.PaymentEscrowHeld {
		return domain.Payment{}, fmt.Errorf("%w: payment is not in escrow_held status", domain.ErrInvalidStatus)
	}

	releasedPayment, err := s.repository.ReleaseOrderEscrow(ctx, orderID, DefaultCommissionBps)
	if err != nil {
		return domain.Payment{}, err
	}

	return releasedPayment, nil
}

func (s *Service) GetCreatorWallet(ctx context.Context, actor domain.Actor) (domain.CreatorWallet, []domain.LedgerEntry, error) {
	if !hasAnyPermission(actor, "payments.view") {
		return domain.CreatorWallet{}, nil, domain.ErrForbidden
	}

	wallet, err := s.repository.GetOrCreateCreatorWallet(ctx, actor.UserID, "IDR")
	if err != nil {
		return domain.CreatorWallet{}, nil, err
	}

	ledger, err := s.repository.GetCreatorLedger(ctx, actor.UserID, 25)
	if err != nil {
		return domain.CreatorWallet{}, nil, err
	}

	return wallet, ledger, nil
}

func (s *Service) SavePayoutMethod(ctx context.Context, actor domain.Actor, input domain.SavePayoutMethodInput) (domain.PayoutMethod, error) {
	if !hasAnyPermission(actor, "payouts.request") {
		return domain.PayoutMethod{}, domain.ErrForbidden
	}

	input.PayoutType = strings.TrimSpace(strings.ToLower(input.PayoutType))
	input.BankName = strings.TrimSpace(input.BankName)
	input.AccountNumber = strings.TrimSpace(input.AccountNumber)
	input.AccountHolderName = strings.TrimSpace(input.AccountHolderName)

	if input.PayoutType != "bank_transfer" && input.PayoutType != "e_wallet" {
		return domain.PayoutMethod{}, fmt.Errorf("%w: payout_type must be 'bank_transfer' or 'e_wallet'", domain.ErrValidation)
	}
	if utf8.RuneCountInString(input.BankName) < 2 || utf8.RuneCountInString(input.BankName) > 100 {
		return domain.PayoutMethod{}, fmt.Errorf("%w: bank/wallet name must be between 2 and 100 characters", domain.ErrValidation)
	}
	if utf8.RuneCountInString(input.AccountNumber) < 3 || utf8.RuneCountInString(input.AccountNumber) > 50 {
		return domain.PayoutMethod{}, fmt.Errorf("%w: account number must be between 3 and 50 characters", domain.ErrValidation)
	}
	if utf8.RuneCountInString(input.AccountHolderName) < 2 || utf8.RuneCountInString(input.AccountHolderName) > 100 {
		return domain.PayoutMethod{}, fmt.Errorf("%w: account holder name must be between 2 and 100 characters", domain.ErrValidation)
	}

	return s.repository.SavePayoutMethod(ctx, actor.UserID, input)
}

func (s *Service) GetPayoutMethods(ctx context.Context, actor domain.Actor) ([]domain.PayoutMethod, error) {
	if !hasAnyPermission(actor, "payouts.request", "payments.view") {
		return nil, domain.ErrForbidden
	}

	return s.repository.GetPayoutMethods(ctx, actor.UserID)
}

func (s *Service) RequestPayout(ctx context.Context, actor domain.Actor, input domain.RequestPayoutInput) (domain.PayoutRequest, error) {
	if !hasAnyPermission(actor, "payouts.request") {
		return domain.PayoutRequest{}, domain.ErrForbidden
	}

	input.Currency = strings.ToUpper(strings.TrimSpace(input.Currency))
	if input.Currency == "" {
		input.Currency = "IDR"
	}
	switch input.Currency {
	case "IDR":
		if input.AmountMinor < 100000 {
			return domain.PayoutRequest{}, fmt.Errorf("%w: minimum payout for IDR is 100,000", domain.ErrMinimumPayoutAmount)
		}
	case "MYR":
		if input.AmountMinor < 5000 { // 50.00 MYR
			return domain.PayoutRequest{}, fmt.Errorf("%w: minimum payout for MYR is 50.00", domain.ErrMinimumPayoutAmount)
		}
	case "USD":
		if input.AmountMinor < 1000 { // $10.00 USD
			return domain.PayoutRequest{}, fmt.Errorf("%w: minimum payout for USD is 10.00", domain.ErrMinimumPayoutAmount)
		}
	default:
		return domain.PayoutRequest{}, fmt.Errorf("%w: unsupported currency '%s'", domain.ErrValidation, input.Currency)
	}

	return s.repository.CreatePayoutRequest(ctx, actor.UserID, input)
}

func (s *Service) ListCreatorPayouts(ctx context.Context, actor domain.Actor) ([]domain.PayoutRequest, error) {
	if !hasAnyPermission(actor, "payouts.request") {
		return nil, domain.ErrForbidden
	}

	return s.repository.ListCreatorPayouts(ctx, actor.UserID)
}

func (s *Service) ProcessPayout(ctx context.Context, actor domain.Actor, payoutID string, input domain.ProcessPayoutInput) (domain.PayoutRequest, error) {
	if !hasAnyPermission(actor, "payouts.manage") {
		return domain.PayoutRequest{}, domain.ErrForbidden
	}

	payoutID = strings.TrimSpace(payoutID)
	if !uuidPattern.MatchString(payoutID) {
		return domain.PayoutRequest{}, fmt.Errorf("%w: invalid payout ID", domain.ErrValidation)
	}

	input.Action = strings.TrimSpace(strings.ToLower(input.Action))
	if input.Action != "approve" && input.Action != "reject" {
		return domain.PayoutRequest{}, fmt.Errorf("%w: action must be 'approve' or 'reject'", domain.ErrValidation)
	}

	return s.repository.ProcessPayoutRequest(ctx, payoutID, actor.UserID, input)
}

type WebhookPayload struct {
	EventID   string `json:"event_id"`
	EventType string `json:"event_type"`
	OrderID   string `json:"order_id,omitempty"`
	Status    string `json:"status,omitempty"`
}

func (s *Service) HandleWebhook(ctx context.Context, providerName string, signature string, rawPayload []byte) error {
	if providerName != s.provider.Name() {
		return fmt.Errorf("%w: unknown provider '%s'", domain.ErrValidation, providerName)
	}

	if !s.provider.VerifySignature(rawPayload, signature) {
		return domain.ErrInvalidSignature
	}

	var parsed WebhookPayload
	if err := json.Unmarshal(rawPayload, &parsed); err != nil {
		return fmt.Errorf("%w: invalid json webhook payload", domain.ErrValidation)
	}

	if parsed.EventID == "" {
		return fmt.Errorf("%w: event_id is required", domain.ErrValidation)
	}
	if parsed.EventType == "" {
		return fmt.Errorf("%w: event_type is required", domain.ErrValidation)
	}

	err := s.repository.RecordWebhookEvent(ctx, providerName, parsed.EventID, parsed.EventType, rawPayload, signature)
	if err != nil {
		return err
	}

	// Handle automated state actions based on event type
	if parsed.EventType == "payment.escrow_release" && parsed.OrderID != "" {
		_, _ = s.repository.ReleaseOrderEscrow(ctx, parsed.OrderID, DefaultCommissionBps)
	}

	return nil
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

func hasRole(actor domain.Actor, role string) bool {
	for _, r := range actor.Roles {
		if r == role {
			return true
		}
	}
	return false
}
