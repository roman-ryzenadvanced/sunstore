package httpdelivery

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"sunstore/internal/domain"
	"sunstore/internal/usecase"
)

// OrderHandler serves checkout and admin order routes.
type OrderHandler struct {
	orders   *usecase.OrderUseCase
	payments *usecase.PaymentUseCase
	site     *usecase.SiteCheckoutUseCase
}

// NewOrderHandler constructs an OrderHandler.
func NewOrderHandler(orders *usecase.OrderUseCase, payments *usecase.PaymentUseCase, site *usecase.SiteCheckoutUseCase) *OrderHandler {
	return &OrderHandler{
		orders:   orders,
		payments: payments,
		site:     site,
	}
}

// CheckoutInit handles POST /api/v1/checkout/init.
func (h *OrderHandler) CheckoutInit(c *gin.Context) {
	var payload domain.CheckoutRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		writeError(c, http.StatusBadRequest, "invalid JSON payload")
		return
	}
	var (
		response *domain.CheckoutResponse
		err      error
	)
	if strings.TrimSpace(payload.SiteSlug) != "" {
		if h.site == nil {
			writeError(c, http.StatusServiceUnavailable, "site checkout is not configured")
			return
		}
		response, err = h.site.CheckoutInit(c.Request.Context(), payload.SiteSlug, payload)
	} else {
		response, err = h.payments.CheckoutInit(c.Request.Context(), payload)
	}
	if err != nil {
		writeDomainError(c, err)
		return
	}
	c.JSON(http.StatusOK, response)
}

// ListAdmin handles GET /api/v1/admin/orders.
func (h *OrderHandler) ListAdmin(c *gin.Context) {
	orders, total, err := h.orders.ListAdmin(c.Request.Context(), domain.OrderListFilter{
		Limit:  parseIntQuery(c, "limit", defaultListLimit),
		Offset: parseIntQuery(c, "offset", 0),
		Status: domain.OrderStatus(strings.TrimSpace(c.Query("status"))),
	})
	if err != nil {
		writeDomainError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    orders,
		"meta": gin.H{
			"total":  total,
			"limit":  parseIntQuery(c, "limit", defaultListLimit),
			"offset": parseIntQuery(c, "offset", 0),
		},
	})
}
