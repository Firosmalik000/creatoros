package handler

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	authhandler "github.com/creatoros/platform/apps/api/internal/auth/handler"
	"github.com/creatoros/platform/apps/api/internal/payment/domain"
	paymentservice "github.com/creatoros/platform/apps/api/internal/payment/service"
	"github.com/go-chi/chi/v5"
)

const maxRequestBytes = 1 << 20

type Middleware func(http.Handler) http.Handler

type Handler struct {
	service *paymentservice.Service
	logger  *slog.Logger
}

type dataResponse struct {
	Data any `json:"data"`
}

type walletDataResponse struct {
	Wallet domain.CreatorWallet `json:"wallet"`
	Ledger []domain.LedgerEntry `json:"ledger"`
}

type errorResponse struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

type payOrderRequest struct {
	PaymentMethod string `json:"payment_method"`
}

type savePayoutMethodRequest struct {
	PayoutType        string `json:"payout_type"`
	BankName          string `json:"bank_name"`
	AccountNumber     string `json:"account_number"`
	AccountHolderName string `json:"account_holder_name"`
}

type requestPayoutRequest struct {
	AmountMinor    int64   `json:"amount_minor"`
	Currency       string  `json:"currency"`
	PayoutMethodID *string `json:"payout_method_id,omitempty"`
}

type processPayoutRequest struct {
	Action string `json:"action"`
	Note   string `json:"note"`
}

func New(service *paymentservice.Service, logger *slog.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

func (h *Handler) Mount(router chi.Router, authenticate, requireCSRF Middleware) {
	// Public webhook endpoint (signature verified inside handler)
	router.Post("/payments/webhooks/{provider}", h.handleWebhook)

	router.Group(func(protected chi.Router) {
		protected.Use(authenticate)

		// Order Payments & Escrow
		protected.With(requireCSRF).Post("/orders/{orderID}/payments", h.payOrder)
		protected.Get("/orders/{orderID}/payments", h.getOrderPayment)
		protected.With(requireCSRF).Post("/orders/{orderID}/escrow/release", h.releaseOrderEscrow)

		// Creator Wallet & Payout Methods
		protected.Get("/creator/wallet", h.getCreatorWallet)
		protected.Get("/creator/payout-methods", h.getPayoutMethods)
		protected.With(requireCSRF).Post("/creator/payout-methods", h.savePayoutMethod)
		protected.Get("/creator/payouts", h.listCreatorPayouts)
		protected.With(requireCSRF).Post("/creator/payouts", h.requestPayout)

		// Admin Payout Management
		protected.With(requireCSRF).Post("/admin/payouts/{payoutID}/process", h.processPayout)
	})
}

func (h *Handler) payOrder(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderID")
	var req payOrderRequest
	if r.ContentLength > 0 {
		if err := decodeJSON(w, r, &req); err != nil {
			writeAPIError(w, http.StatusBadRequest, "invalid_request", "The request body is invalid.")
			return
		}
	}

	payment, err := h.service.PayOrder(r.Context(), actor(r), orderID, domain.PayOrderInput{
		PaymentMethod: req.PaymentMethod,
	})
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	writeJSON(w, http.StatusCreated, dataResponse{Data: payment})
}

func (h *Handler) getOrderPayment(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderID")
	payment, err := h.service.GetOrderPayment(r.Context(), actor(r), orderID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, dataResponse{Data: payment})
}

func (h *Handler) releaseOrderEscrow(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderID")
	payment, err := h.service.ReleaseOrderEscrow(r.Context(), actor(r), orderID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, dataResponse{Data: payment})
}

func (h *Handler) getCreatorWallet(w http.ResponseWriter, r *http.Request) {
	wallet, ledger, err := h.service.GetCreatorWallet(r.Context(), actor(r))
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, dataResponse{Data: walletDataResponse{
		Wallet: wallet,
		Ledger: ledger,
	}})
}

func (h *Handler) getPayoutMethods(w http.ResponseWriter, r *http.Request) {
	methods, err := h.service.GetPayoutMethods(r.Context(), actor(r))
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, dataResponse{Data: methods})
}

func (h *Handler) savePayoutMethod(w http.ResponseWriter, r *http.Request) {
	var req savePayoutMethodRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "The request body is invalid.")
		return
	}

	method, err := h.service.SavePayoutMethod(r.Context(), actor(r), domain.SavePayoutMethodInput{
		PayoutType:        req.PayoutType,
		BankName:          req.BankName,
		AccountNumber:     req.AccountNumber,
		AccountHolderName: req.AccountHolderName,
	})
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	writeJSON(w, http.StatusCreated, dataResponse{Data: method})
}

func (h *Handler) listCreatorPayouts(w http.ResponseWriter, r *http.Request) {
	payouts, err := h.service.ListCreatorPayouts(r.Context(), actor(r))
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, dataResponse{Data: payouts})
}

func (h *Handler) requestPayout(w http.ResponseWriter, r *http.Request) {
	var req requestPayoutRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "The request body is invalid.")
		return
	}

	payout, err := h.service.RequestPayout(r.Context(), actor(r), domain.RequestPayoutInput{
		AmountMinor:    req.AmountMinor,
		Currency:       req.Currency,
		PayoutMethodID: req.PayoutMethodID,
	})
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	writeJSON(w, http.StatusCreated, dataResponse{Data: payout})
}

func (h *Handler) processPayout(w http.ResponseWriter, r *http.Request) {
	payoutID := chi.URLParam(r, "payoutID")
	var req processPayoutRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "The request body is invalid.")
		return
	}

	payout, err := h.service.ProcessPayout(r.Context(), actor(r), payoutID, domain.ProcessPayoutInput{
		Action: req.Action,
		Note:   req.Note,
	})
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, dataResponse{Data: payout})
}

func (h *Handler) handleWebhook(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	signature := r.Header.Get("X-Signature")
	if signature == "" {
		signature = r.Header.Get("X-Webhook-Signature")
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBytes)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_body", "Unable to read webhook payload.")
		return
	}

	err = h.service.HandleWebhook(r.Context(), provider, signature, body)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "received"})
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, domain.ErrValidation):
		writeAPIError(w, http.StatusUnprocessableEntity, "validation_failed", err.Error())
	case errors.Is(err, domain.ErrForbidden):
		writeAPIError(w, http.StatusForbidden, "forbidden", "You cannot perform this payment action.")
	case errors.Is(err, domain.ErrNotFound):
		writeAPIError(w, http.StatusNotFound, "not_found", "The payment entity was not found.")
	case errors.Is(err, domain.ErrConflict):
		writeAPIError(w, http.StatusConflict, "conflict", "Payment state conflict.")
	case errors.Is(err, domain.ErrAlreadyPaid):
		writeAPIError(w, http.StatusConflict, "already_paid", "Order has already been paid and escrow held.")
	case errors.Is(err, domain.ErrInvalidStatus):
		writeAPIError(w, http.StatusConflict, "invalid_status", err.Error())
	case errors.Is(err, domain.ErrInsufficientBalance):
		writeAPIError(w, http.StatusUnprocessableEntity, "insufficient_balance", "Wallet available balance is insufficient.")
	case errors.Is(err, domain.ErrMinimumPayoutAmount):
		writeAPIError(w, http.StatusUnprocessableEntity, "minimum_payout_amount", err.Error())
	case errors.Is(err, domain.ErrInvalidSignature):
		writeAPIError(w, http.StatusUnauthorized, "invalid_signature", "Webhook signature verification failed.")
	case errors.Is(err, domain.ErrDuplicateWebhook):
		writeAPIError(w, http.StatusConflict, "duplicate_webhook", "Webhook event has already been processed.")
	default:
		h.logger.Error("payment request failed", "method", r.Method, "path", r.URL.Path, "error", err)
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "The payment request could not be completed.")
	}
}

func actor(r *http.Request) domain.Actor {
	session, _ := authhandler.SessionFromContext(r.Context())
	return domain.Actor{
		UserID:      session.User.ID,
		Roles:       session.User.Roles,
		Permissions: session.User.Permissions,
	}
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("request body must contain one JSON object")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeAPIError(w http.ResponseWriter, status int, code, message string) {
	payload := errorResponse{}
	payload.Error.Code, payload.Error.Message = code, message
	writeJSON(w, status, payload)
}
