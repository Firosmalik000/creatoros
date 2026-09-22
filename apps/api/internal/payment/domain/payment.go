package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound            = errors.New("payment entity not found")
	ErrForbidden           = errors.New("payment action forbidden")
	ErrConflict            = errors.New("payment conflict")
	ErrValidation          = errors.New("payment validation failed")
	ErrInsufficientBalance = errors.New("insufficient wallet balance")
	ErrMinimumPayoutAmount = errors.New("payout amount is below minimum threshold")
	ErrInvalidSignature    = errors.New("invalid webhook signature")
	ErrDuplicateWebhook    = errors.New("duplicate webhook event")
	ErrAlreadyPaid         = errors.New("order is already paid")
	ErrInvalidStatus       = errors.New("invalid payment or payout status transition")
)

type PaymentStatus string

const (
	PaymentPending    PaymentStatus = "pending"
	PaymentEscrowHeld PaymentStatus = "escrow_held"
	PaymentReleased   PaymentStatus = "released"
	PaymentRefunded   PaymentStatus = "refunded"
	PaymentFailed     PaymentStatus = "failed"
)

type PayoutStatus string

const (
	PayoutPending    PayoutStatus = "pending"
	PayoutProcessing PayoutStatus = "processing"
	PayoutCompleted  PayoutStatus = "completed"
	PayoutRejected   PayoutStatus = "rejected"
)

type Actor struct {
	UserID      string
	Roles       []string
	Permissions []string
}

type Payment struct {
	ID                    string        `json:"id"`
	OrderID               *string       `json:"order_id,omitempty"`
	CampaignID            *string       `json:"campaign_id,omitempty"`
	ClientUserID          string        `json:"client_user_id"`
	CreatorUserID         string        `json:"creator_user_id"`
	AmountMinor           int64         `json:"amount_minor"`
	Currency              string        `json:"currency"`
	Status                PaymentStatus `json:"status"`
	PaymentMethod         string        `json:"payment_method"`
	Provider              string        `json:"provider"`
	ProviderTransactionID string        `json:"provider_transaction_id"`
	CreatedAt             time.Time     `json:"created_at"`
	UpdatedAt             time.Time     `json:"updated_at"`
}

type LedgerEntry struct {
	ID            string    `json:"id"`
	TransactionID string    `json:"transaction_id"`
	ReferenceType string    `json:"reference_type"`
	ReferenceID   string    `json:"reference_id"`
	AccountType   string    `json:"account_type"`
	UserID        *string   `json:"user_id,omitempty"`
	EntryType     string    `json:"entry_type"` // "debit" or "credit"
	AmountMinor   int64     `json:"amount_minor"`
	Currency      string    `json:"currency"`
	Description   string    `json:"description"`
	CreatedAt     time.Time `json:"created_at"`
}

type CreatorWallet struct {
	CreatorUserID         string    `json:"creator_user_id"`
	AvailableBalanceMinor int64     `json:"available_balance_minor"`
	EscrowBalanceMinor    int64     `json:"escrow_balance_minor"`
	TotalWithdrawnMinor   int64     `json:"total_withdrawn_minor"`
	Currency              string    `json:"currency"`
	UpdatedAt             time.Time `json:"updated_at"`
}

type PayoutMethod struct {
	ID                string    `json:"id"`
	CreatorUserID     string    `json:"creator_user_id"`
	PayoutType        string    `json:"payout_type"` // "bank_transfer" or "e_wallet"
	BankName          string    `json:"bank_name"`
	AccountNumber     string    `json:"account_number"`
	AccountHolderName string    `json:"account_holder_name"`
	IsDefault         bool      `json:"is_default"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type PayoutRequest struct {
	ID                string       `json:"id"`
	CreatorUserID     string       `json:"creator_user_id"`
	PayoutMethodID    *string      `json:"payout_method_id,omitempty"`
	AmountMinor       int64        `json:"amount_minor"`
	Currency          string       `json:"currency"`
	Status            PayoutStatus `json:"status"`
	ReferenceNote     string       `json:"reference_note,omitempty"`
	ProcessedAt       *time.Time   `json:"processed_at,omitempty"`
	CreatedAt         time.Time    `json:"created_at"`
	UpdatedAt         time.Time    `json:"updated_at"`
	BankName          string       `json:"bank_name,omitempty"`
	AccountNumber     string       `json:"account_number,omitempty"`
	AccountHolderName string       `json:"account_holder_name,omitempty"`
}

type WebhookEvent struct {
	ID          string    `json:"id"`
	Provider    string    `json:"provider"`
	EventID     string    `json:"event_id"`
	EventType   string    `json:"event_type"`
	Payload     []byte    `json:"payload"`
	Signature   string    `json:"signature"`
	ProcessedAt time.Time `json:"processed_at"`
}

type PayOrderInput struct {
	PaymentMethod string `json:"payment_method"`
}

type SavePayoutMethodInput struct {
	PayoutType        string `json:"payout_type"`
	BankName          string `json:"bank_name"`
	AccountNumber     string `json:"account_number"`
	AccountHolderName string `json:"account_holder_name"`
}

type RequestPayoutInput struct {
	AmountMinor    int64   `json:"amount_minor"`
	Currency       string  `json:"currency"`
	PayoutMethodID *string `json:"payout_method_id,omitempty"`
}

type ProcessPayoutInput struct {
	Action string `json:"action"` // "approve" or "reject"
	Note   string `json:"note"`
}

type PaymentProvider interface {
	Name() string
	CreateIntent(ctx context.Context, orderID string, amountMinor int64, currency string) (providerTxID string, err error)
	VerifySignature(payload []byte, signature string) bool
}

type Repository interface {
	CreateOrderPayment(ctx context.Context, orderID string, clientUserID, creatorUserID string, amountMinor int64, currency, method, provider, providerTxID string) (Payment, error)
	GetPaymentByOrderID(ctx context.Context, orderID string) (Payment, error)
	GetPaymentByID(ctx context.Context, paymentID string) (Payment, error)
	ReleaseOrderEscrow(ctx context.Context, orderID string, commissionBps int) (Payment, error)
	GetOrCreateCreatorWallet(ctx context.Context, creatorUserID string, defaultCurrency string) (CreatorWallet, error)
	GetCreatorLedger(ctx context.Context, creatorUserID string, limit int) ([]LedgerEntry, error)
	SavePayoutMethod(ctx context.Context, creatorUserID string, input SavePayoutMethodInput) (PayoutMethod, error)
	GetPayoutMethods(ctx context.Context, creatorUserID string) ([]PayoutMethod, error)
	CreatePayoutRequest(ctx context.Context, creatorUserID string, input RequestPayoutInput) (PayoutRequest, error)
	ListCreatorPayouts(ctx context.Context, creatorUserID string) ([]PayoutRequest, error)
	ProcessPayoutRequest(ctx context.Context, payoutID string, adminUserID string, input ProcessPayoutInput) (PayoutRequest, error)
	RecordWebhookEvent(ctx context.Context, provider, eventID, eventType string, payload []byte, signature string) error
	GetOrderClientAndCreator(ctx context.Context, orderID string) (clientUserID, creatorUserID string, priceMinor int64, currency string, orderStatus string, err error)
}
