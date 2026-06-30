package tbank

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/url"
	"strings"

	"sunstore/internal/config"
	"sunstore/internal/usecase"
)

// DemoClient emulates a successful T-Bank init call for local/demo workflows.
type DemoClient struct {
	logger    *slog.Logger
	returnURL string
}

// NewDemoClient constructs a gateway that redirects to the local status page.
func NewDemoClient(cfg config.TBankConfig, logger *slog.Logger) *DemoClient {
	return &DemoClient{
		logger:    logger,
		returnURL: strings.TrimSpace(cfg.ReturnURL),
	}
}

// InitPayment returns a deterministic local/demo redirect instead of a live T-Bank session.
func (c *DemoClient) InitPayment(_ context.Context, input usecase.PaymentInitRequest) (*usecase.PaymentInitResult, error) {
	redirectURL := "/checkout/status"
	if c.returnURL != "" {
		redirectURL = c.returnURL
	}
	if parsed, err := url.Parse(redirectURL); err == nil {
		q := parsed.Query()
		q.Set("status", "mock")
		q.Set("order", input.TBankOrderID)
		parsed.RawQuery = q.Encode()
		redirectURL = parsed.String()
	}

	raw, _ := json.Marshal(map[string]any{
		"mode":        "demo",
		"order_id":    input.TBankOrderID,
		"amount":      input.AmountKopecks,
		"payment_id":  "demo-" + strings.ToLower(input.TBankOrderID),
		"payment_url": redirectURL,
	})

	c.logger.Info("demo tbank payment initialized",
		slog.String("order_id", input.TBankOrderID),
		slog.String("payment_url", redirectURL),
	)

	return &usecase.PaymentInitResult{
		PaymentURL: redirectURL,
		PaymentID:  "demo-" + strings.ToLower(input.TBankOrderID),
		Raw:        raw,
	}, nil
}
