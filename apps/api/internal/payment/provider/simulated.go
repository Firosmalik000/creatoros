package provider

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/creatoros/platform/apps/api/internal/payment/domain"
)

type SimulatedPaymentProvider struct {
	webhookSecret string
}

func NewSimulatedProvider(webhookSecret string) *SimulatedPaymentProvider {
	if webhookSecret == "" {
		webhookSecret = "simulated_whsec_creatoros_2026"
	}
	return &SimulatedPaymentProvider{webhookSecret: webhookSecret}
}

func (p *SimulatedPaymentProvider) Name() string {
	return "simulated"
}

func (p *SimulatedPaymentProvider) CreateIntent(ctx context.Context, orderID string, amountMinor int64, currency string) (string, error) {
	txID := fmt.Sprintf("sim_tx_%s_%d", orderID[:8], time.Now().UnixNano())
	return txID, nil
}

func (p *SimulatedPaymentProvider) VerifySignature(payload []byte, signature string) bool {
	if signature == "" {
		return false
	}
	expected := p.GenerateSignature(payload)
	return hmac.Equal([]byte(expected), []byte(signature))
}

func (p *SimulatedPaymentProvider) GenerateSignature(payload []byte) string {
	mac := hmac.New(sha256.New, []byte(p.webhookSecret))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}

var _ domain.PaymentProvider = (*SimulatedPaymentProvider)(nil)
