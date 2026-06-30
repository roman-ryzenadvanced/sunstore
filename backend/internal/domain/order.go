package domain

import (
	"context"
	"encoding/json"
	"time"
)

// OrderStatus mirrors the payment lifecycle persisted in PostgreSQL.
type OrderStatus string

const (
	OrderStatusNew        OrderStatus = "NEW"
	OrderStatusPending    OrderStatus = "PENDING"
	OrderStatusAuthorized OrderStatus = "AUTHORIZED"
	OrderStatusConfirmed  OrderStatus = "CONFIRMED"
	OrderStatusRejected   OrderStatus = "REJECTED"
	OrderStatusRefunded   OrderStatus = "REFUNDED"
)

// OrderItem stores one purchased line item.
type OrderItem struct {
	ID                     int64  `json:"id"`
	OrderID                int64  `json:"order_id"`
	ProductID              *int64 `json:"product_id,omitempty"`
	ProductSlug            string `json:"product_slug,omitempty"`
	ProductTitleRU         string `json:"product_title_ru,omitempty"`
	Quantity               int    `json:"quantity"`
	PriceAtPurchaseKopecks int64  `json:"price_at_purchase_kopecks"`
}

// Order is the persisted checkout aggregate.
type Order struct {
	ID                 int64           `json:"id"`
	TBankOrderID       string          `json:"tbank_order_id"`
	TBankPaymentID     *string         `json:"tbank_payment_id,omitempty"`
	CustomerName       string          `json:"customer_name"`
	CustomerEmail      string          `json:"customer_email"`
	CustomerPhone      string          `json:"customer_phone"`
	TotalAmountKopecks int64           `json:"total_amount_kopecks"`
	Status             OrderStatus     `json:"status"`
	RawTBankResponse   json.RawMessage `json:"raw_tbank_response,omitempty"`
	Items              []OrderItem     `json:"items"`
	CreatedAt          time.Time       `json:"created_at"`
	UpdatedAt          time.Time       `json:"updated_at"`
}

// CheckoutItemInput is one client cart line during checkout.
type CheckoutItemInput struct {
	ProductID int64 `json:"product_id"`
	Quantity  int   `json:"quantity"`
}

// CheckoutRequest is the public checkout initiation payload.
type CheckoutRequest struct {
	CustomerName string              `json:"customer_name"`
	Email        string              `json:"email"`
	Phone        string              `json:"phone"`
	SiteSlug     string              `json:"site_slug,omitempty"`
	Items        []CheckoutItemInput `json:"items"`
}

// CheckoutResponse is the API response for payment initialization.
type CheckoutResponse struct {
	Success    bool   `json:"success"`
	PaymentURL string `json:"payment_url"`
	OrderID    string `json:"order_id"`
}

// CreateOrderInput is the repository contract for inserting an order and items.
type CreateOrderInput struct {
	TBankOrderID       string
	CustomerName       string
	CustomerEmail      string
	CustomerPhone      string
	TotalAmountKopecks int64
	Status             OrderStatus
	Items              []OrderItemCreateInput
}

// OrderItemCreateInput stores the data needed for line-item insertion.
type OrderItemCreateInput struct {
	ProductID              int64
	Quantity               int
	PriceAtPurchaseKopecks int64
}

// OrderListFilter is the admin order listing query contract.
type OrderListFilter struct {
	Limit  int
	Offset int
	Status OrderStatus
}

// OrderRepository is the storage contract for orders.
type OrderRepository interface {
	Create(ctx context.Context, input CreateOrderInput) (*Order, error)
	List(ctx context.Context, filter OrderListFilter) ([]Order, int64, error)
	GetByTBankOrderID(ctx context.Context, tbankOrderID string) (*Order, error)
	AttachPaymentInit(ctx context.Context, orderID int64, paymentID string, status OrderStatus, raw json.RawMessage) error
	UpdateStatusByTBankOrderID(ctx context.Context, tbankOrderID string, paymentID *string, status OrderStatus, raw json.RawMessage) error
}
