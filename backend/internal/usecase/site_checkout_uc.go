package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"sunstore/internal/domain"
	"sunstore/internal/repository/postgres"
)

// SiteCheckoutUseCase validates a storefront cart, persists a site order, and starts payment init.
type SiteCheckoutUseCase struct {
	db      *postgres.DB
	gateway PaymentGateway
}

// NewSiteCheckoutUseCase constructs a SiteCheckoutUseCase.
func NewSiteCheckoutUseCase(db *postgres.DB, gateway PaymentGateway) *SiteCheckoutUseCase {
	return &SiteCheckoutUseCase{db: db, gateway: gateway}
}

// CheckoutInit validates the basket for a specific site and starts payment initialization.
func (uc *SiteCheckoutUseCase) CheckoutInit(ctx context.Context, siteSlug string, req domain.CheckoutRequest) (*domain.CheckoutResponse, error) {
	if err := validateCheckoutRequest(req); err != nil {
		return nil, err
	}

	site, err := uc.db.GetSiteBySlug(ctx, strings.ToLower(strings.TrimSpace(siteSlug)))
	if err != nil {
		return nil, err
	}
	if site.Status != domain.SiteStatusReady {
		return nil, fmt.Errorf("%w: site is not accepting orders", domain.ErrUnavailable)
	}

	mergedItems := mergeCheckoutItems(req.Items)
	orderItems := make([]domain.SiteOrderItemCreateInput, 0, len(mergedItems))
	paymentItems := make([]domain.OrderItem, 0, len(mergedItems))
	var total int64

	for _, item := range mergedItems {
		product, err := uc.db.GetSiteProductByID(ctx, site.ID, item.ProductID)
		if err != nil {
			return nil, fmt.Errorf("%w: product %d not found for site %s", domain.ErrValidation, item.ProductID, site.Slug)
		}
		if !product.IsActive {
			return nil, fmt.Errorf("%w: product %s is inactive", domain.ErrValidation, product.Slug)
		}
		if item.Quantity > product.StockQuantity {
			return nil, fmt.Errorf("%w: insufficient stock for product %s", domain.ErrValidation, product.Slug)
		}

		lineAmount := product.PriceKopecks * int64(item.Quantity)
		total += lineAmount
		orderItems = append(orderItems, domain.SiteOrderItemCreateInput{
			ProductID:              product.ID,
			Quantity:               item.Quantity,
			PriceAtPurchaseKopecks: product.PriceKopecks,
		})
		paymentItems = append(paymentItems, domain.OrderItem{
			ProductID:              &product.ID,
			ProductSlug:            product.Slug,
			ProductTitleRU:         product.Title,
			Quantity:               item.Quantity,
			PriceAtPurchaseKopecks: product.PriceKopecks,
		})
	}

	order, err := uc.db.CreateSiteOrder(ctx, domain.CreateSiteOrderInput{
		SiteID:             site.ID,
		TBankOrderID:       buildSiteTBankOrderID(site.Slug),
		CustomerName:       strings.TrimSpace(req.CustomerName),
		CustomerEmail:      strings.TrimSpace(strings.ToLower(req.Email)),
		CustomerPhone:      strings.TrimSpace(req.Phone),
		TotalAmountKopecks: total,
		Status:             domain.OrderStatusNew,
		Items:              orderItems,
	})
	if err != nil {
		return nil, err
	}

	if uc.gateway == nil {
		return nil, fmt.Errorf("%w: payment gateway is not configured yet", domain.ErrUnavailable)
	}

	gatewayRes, err := uc.gateway.InitPayment(ctx, PaymentInitRequest{
		TBankOrderID:  order.TBankOrderID,
		AmountKopecks: total,
		Description:   fmt.Sprintf("%s — заказ %s", site.Name, order.TBankOrderID),
		CustomerName:  order.CustomerName,
		CustomerEmail: order.CustomerEmail,
		CustomerPhone: order.CustomerPhone,
		Items:         paymentItems,
	})
	if err != nil {
		return nil, err
	}

	if err := uc.db.AttachSitePaymentInit(ctx, order.ID, gatewayRes.PaymentID, domain.OrderStatusPending, gatewayRes.Raw); err != nil {
		return nil, err
	}

	return &domain.CheckoutResponse{
		Success:    true,
		PaymentURL: gatewayRes.PaymentURL,
		OrderID:    order.TBankOrderID,
	}, nil
}

func buildSiteTBankOrderID(siteSlug string) string {
	now := time.Now().UTC().Format("20060102T150405")
	slug := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(siteSlug), "-", "_"))
	if slug == "" {
		slug = "SITE"
	}
	return fmt.Sprintf("SITE_%s_%s_%s", slug, now, strings.ToUpper(uuid.NewString()[:8]))
}
