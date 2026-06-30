// Package domain contains the multi-site core entities.
package domain

import (
	"time"
)

// SiteStatus is the lifecycle of a storefront site.
type SiteStatus string

const (
	SiteStatusProvisioning SiteStatus = "PROVISIONING"
	SiteStatusReady        SiteStatus = "READY"
	SiteStatusSuspended    SiteStatus = "SUSPENDED"
	SiteStatusArchived     SiteStatus = "ARCHIVED"
)

// Site is one storefront provisioned from a template.
type Site struct {
	ID           int64
	Slug         string
	Name         string
	Niche        string
	TemplateID   string
	Status       SiteStatus
	CustomDomain *string
	PrimaryColor *string
	LogoMark     *string
	Tagline      *string
	Description  *string
	Settings     map[string]any
	CreatedAt    time.Time
	UpdatedAt    time.Time
	LaunchedAt   *time.Time
}

// SiteAdmin is a per-site administrator.
type SiteAdmin struct {
	ID           int64
	SiteID       int64
	Username     string
	PasswordHash string
	Role         string
	IsActive     bool
	LastLoginAt  *time.Time
	CreatedAt    time.Time
}

// SuperAdmin is a central platform administrator.
type SuperAdmin struct {
	ID           int64
	Username     string
	PasswordHash string
	CreatedAt    time.Time
}

// SiteProduct is a product owned by a single site.
type SiteProduct struct {
	ID            int64     `json:"id"`
	SiteID        int64     `json:"site_id"`
	Slug          string    `json:"slug"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	PriceKopecks  int64     `json:"price_kopecks"`
	SKU           string    `json:"sku"`
	StockQuantity int       `json:"stock_quantity"`
	Images        []string  `json:"images"`
	Category      string    `json:"category"`
	IsActive      bool      `json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	// Populated only by cross-store queries (JOIN sites). site_id is always set.
	SiteName string `json:"site_name,omitempty"`
	SiteSlug string `json:"site_slug,omitempty"`
}

// SiteOrder is an order tied to a site.
type SiteOrder struct {
	ID                 int64           `json:"id"`
	SiteID             int64           `json:"site_id"`
	TBankOrderID       string          `json:"tbank_order_id"`
	TBankPaymentID     *string         `json:"tbank_payment_id,omitempty"`
	CustomerName       string          `json:"customer_name"`
	CustomerEmail      string          `json:"customer_email"`
	CustomerPhone      string          `json:"customer_phone"`
	TotalAmountKopecks int64           `json:"total_amount_kopecks"`
	Status             OrderStatus     `json:"status"`
	RawTBankResponse   map[string]any  `json:"raw_tbank_response,omitempty"`
	CreatedAt          time.Time       `json:"created_at"`
	UpdatedAt          time.Time       `json:"updated_at"`
	Items              []SiteOrderItem `json:"items,omitempty"`

	// Populated only by cross-store queries (JOIN sites). site_id is always set.
	SiteName string `json:"site_name,omitempty"`
	SiteSlug string `json:"site_slug,omitempty"`
}

// SiteOrderItem is a line item snapshot of a site order.
type SiteOrderItem struct {
	ID                    int64  `json:"id"`
	OrderID               int64  `json:"order_id"`
	ProductID             *int64 `json:"product_id,omitempty"`
	Quantity              int    `json:"quantity"`
	PriceAtPurchaseKopeck int64  `json:"price_at_purchase_kopecks"`
}

// CreateSiteOrderInput is the repository contract for inserting a site order.
type CreateSiteOrderInput struct {
	SiteID             int64
	TBankOrderID       string
	CustomerName       string
	CustomerEmail      string
	CustomerPhone      string
	TotalAmountKopecks int64
	Status             OrderStatus
	Items              []SiteOrderItemCreateInput
}

// SiteOrderItemCreateInput stores the data needed for site line-item insertion.
type SiteOrderItemCreateInput struct {
	ProductID              int64
	Quantity               int
	PriceAtPurchaseKopecks int64
}

// SiteFilter narrows the result set when listing sites.
type SiteFilter struct {
	Status     SiteStatus
	Niche      string
	TemplateID string
	Search     string
	Limit      int
	Offset     int
}

// CrossStoreOrderFilter narrows the cross-store order listing. SiteID == 0
// means "all stores".
type CrossStoreOrderFilter struct {
	SiteID int64
	Status OrderStatus // empty = any status
	Search string      // customer name / email / tbank order id
	Limit  int
	Offset int
}

// CrossStoreProductFilter narrows the cross-store product listing. SiteID == 0
// means "all stores".
type CrossStoreProductFilter struct {
	SiteID     int64
	Search     string // title / sku
	Category   string
	ActiveOnly bool
	Limit      int
	Offset     int
}
