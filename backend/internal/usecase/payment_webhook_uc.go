package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"sunstore/internal/domain"
)

// PaymentNotificationVerifier verifies incoming provider callbacks.
type PaymentNotificationVerifier interface {
	VerifyNotificationToken(payload map[string]any) error
}

// PaymentNotificationUseCase validates and applies asynchronous payment updates.
type PaymentNotificationUseCase struct {
	orders     domain.OrderRepository
	siteOrders interface {
		UpdateSiteOrderStatusByTBankOrderID(ctx context.Context, tbankOrderID string, paymentID *string, status domain.OrderStatus, raw json.RawMessage) error
	}
	verifier PaymentNotificationVerifier
}

// NewPaymentNotificationUseCase constructs a PaymentNotificationUseCase.
func NewPaymentNotificationUseCase(
	orders domain.OrderRepository,
	siteOrders interface {
		UpdateSiteOrderStatusByTBankOrderID(ctx context.Context, tbankOrderID string, paymentID *string, status domain.OrderStatus, raw json.RawMessage) error
	},
	verifier PaymentNotificationVerifier,
) *PaymentNotificationUseCase {
	return &PaymentNotificationUseCase{
		orders:     orders,
		siteOrders: siteOrders,
		verifier:   verifier,
	}
}

// HandleTBankNotification verifies a callback token and updates the order state.
func (uc *PaymentNotificationUseCase) HandleTBankNotification(ctx context.Context, payload map[string]any, raw json.RawMessage) error {
	if err := uc.verifier.VerifyNotificationToken(payload); err != nil {
		return err
	}

	orderID, err := getPayloadString(payload, "OrderId")
	if err != nil {
		return fmt.Errorf("%w: %v", domain.ErrValidation, err)
	}
	statusValue, err := getPayloadString(payload, "Status")
	if err != nil {
		return fmt.Errorf("%w: %v", domain.ErrValidation, err)
	}
	success, err := getPayloadBool(payload, "Success")
	if err != nil {
		return fmt.Errorf("%w: %v", domain.ErrValidation, err)
	}

	var paymentID *string
	if value, err := getPayloadOptionalString(payload, "PaymentId"); err == nil && value != "" {
		paymentID = &value
	}
	finalStatus := mapNotificationStatus(statusValue, success)
	if err := uc.orders.UpdateStatusByTBankOrderID(ctx, orderID, paymentID, finalStatus, raw); err != nil {
		if err == domain.ErrNotFound && uc.siteOrders != nil {
			return uc.siteOrders.UpdateSiteOrderStatusByTBankOrderID(ctx, orderID, paymentID, finalStatus, raw)
		}
		return err
	}
	return nil
}

func mapNotificationStatus(status string, success bool) domain.OrderStatus {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case string(domain.OrderStatusAuthorized):
		return domain.OrderStatusAuthorized
	case string(domain.OrderStatusConfirmed):
		return domain.OrderStatusConfirmed
	case string(domain.OrderStatusRefunded):
		return domain.OrderStatusRefunded
	case "REJECTED", "CANCELED", "CANCELLED", "DEADLINE_EXPIRED", "EXPIRED":
		return domain.OrderStatusRejected
	case string(domain.OrderStatusNew), "FORM_SHOWED", "3DS_CHECKING", "WAITING":
		return domain.OrderStatusPending
	default:
		if success {
			return domain.OrderStatusPending
		}
		return domain.OrderStatusRejected
	}
}

func getPayloadString(payload map[string]any, key string) (string, error) {
	raw, ok := payload[key]
	if !ok {
		return "", fmt.Errorf("%s is required", key)
	}
	switch v := raw.(type) {
	case string:
		if strings.TrimSpace(v) == "" {
			return "", fmt.Errorf("%s is required", key)
		}
		return v, nil
	case float64:
		return fmt.Sprintf("%.0f", v), nil
	default:
		return "", fmt.Errorf("%s has invalid type", key)
	}
}

func getPayloadOptionalString(payload map[string]any, key string) (string, error) {
	raw, ok := payload[key]
	if !ok || raw == nil {
		return "", nil
	}
	switch v := raw.(type) {
	case string:
		return v, nil
	case float64:
		return fmt.Sprintf("%.0f", v), nil
	default:
		return "", fmt.Errorf("%s has invalid type", key)
	}
}

func getPayloadBool(payload map[string]any, key string) (bool, error) {
	raw, ok := payload[key]
	if !ok {
		return false, fmt.Errorf("%s is required", key)
	}
	switch v := raw.(type) {
	case bool:
		return v, nil
	case string:
		if strings.EqualFold(v, "true") {
			return true, nil
		}
		if strings.EqualFold(v, "false") {
			return false, nil
		}
		return false, fmt.Errorf("%s has invalid bool value", key)
	default:
		return false, fmt.Errorf("%s has invalid type", key)
	}
}
