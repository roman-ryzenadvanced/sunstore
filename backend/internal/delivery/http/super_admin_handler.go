// Package httpdelivery — super-admin handler that consolidates all shop
// management (theme, products, orders, email config) under one panel.
//
// All endpoints require a central (super-admin) JWT.
package httpdelivery

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"sunstore/internal/domain"
	"sunstore/internal/usecase"
)

// SuperAdminHandler exposes the consolidated super-admin API surface.
type SuperAdminHandler struct {
	sites  *usecase.SiteService
	email  *usecase.EmailUseCase
}

// NewSuperAdminHandler constructs a SuperAdminHandler.
func NewSuperAdminHandler(sites *usecase.SiteService, email *usecase.EmailUseCase) *SuperAdminHandler {
	return &SuperAdminHandler{sites: sites, email: email}
}

// ---------------------------------------------------------------------------
// Shop detail / theme / branding
// ---------------------------------------------------------------------------

// GetShop returns the full shop profile (theme, branding, status).
func (h *SuperAdminHandler) GetShop(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	site, err := h.sites.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}
	c.JSON(http.StatusOK, site)
}

// UpdateTheme changes a shop's theme (template_id).
func (h *SuperAdminHandler) UpdateTheme(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	var body struct {
		TemplateID string `json:"template_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload", "detail": err.Error()})
		return
	}
	if err := h.sites.UpdateTheme(c.Request.Context(), id, body.TemplateID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "update_failed", "detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"template_id": body.TemplateID})
}

// UpdateBranding patches a shop's identity fields.
func (h *SuperAdminHandler) UpdateBranding(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	var body struct {
		Name        *string `json:"name"`
		Tagline     *string `json:"tagline"`
		PrimaryColor *string `json:"primary_color"`
		LogoMark    *string `json:"logo_mark"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload", "detail": err.Error()})
		return
	}
	if err := h.sites.UpdateBranding(c.Request.Context(), id, body.Name, body.Tagline, body.PrimaryColor, body.LogoMark); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "update_failed", "detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ---------------------------------------------------------------------------
// Shop products (super-admin CRUD)
// ---------------------------------------------------------------------------

// ListShopProducts returns ALL products for a shop (including inactive).
func (h *SuperAdminHandler) ListShopProducts(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	prods, err := h.sites.ListSiteProducts(c.Request.Context(), id, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list_failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": prods})
}

// CreateShopProduct creates a new product on a shop.
func (h *SuperAdminHandler) CreateShopProduct(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	var body struct {
		Slug          string   `json:"slug"`
		Title         string   `json:"title" binding:"required"`
		Description   string   `json:"description"`
		PriceKopecks  int64    `json:"price_kopecks"`
		SKU           string   `json:"sku"`
		StockQuantity int      `json:"stock_quantity"`
		Images        []string `json:"images"`
		Category      string   `json:"category"`
		IsActive      bool     `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload", "detail": err.Error()})
		return
	}
	if body.Category == "" {
		body.Category = "general"
	}
	p, err := h.sites.CreateSiteProduct(c.Request.Context(), usecase.CreateSiteProductInput{
		SiteID:        id,
		Slug:          body.Slug,
		Title:         body.Title,
		Description:   body.Description,
		PriceKopecks:  body.PriceKopecks,
		SKU:           body.SKU,
		StockQuantity: body.StockQuantity,
		Images:        body.Images,
		Category:      body.Category,
		IsActive:      body.IsActive,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "create_failed", "detail": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, p)
}

// UpdateShopProduct patches an existing product on a shop.
func (h *SuperAdminHandler) UpdateShopProduct(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	prodID, err := strconv.ParseInt(c.Param("productId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_product_id"})
		return
	}
	var body struct {
		Slug          string   `json:"slug"`
		Title         string   `json:"title"`
		Description   string   `json:"description"`
		PriceKopecks  int64    `json:"price_kopecks"`
		SKU           string   `json:"sku"`
		StockQuantity int      `json:"stock_quantity"`
		Images        []string `json:"images"`
		Category      string   `json:"category"`
		IsActive      bool     `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload", "detail": err.Error()})
		return
	}
	p := &domain.SiteProduct{
		ID:            prodID,
		SiteID:        id,
		Slug:          body.Slug,
		Title:         body.Title,
		Description:   body.Description,
		PriceKopecks:  body.PriceKopecks,
		SKU:           body.SKU,
		StockQuantity: body.StockQuantity,
		Images:        body.Images,
		Category:      body.Category,
		IsActive:      body.IsActive,
	}
	if err := h.sites.UpdateSiteProduct(c.Request.Context(), p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "update_failed", "detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}

// DeleteShopProduct removes a product.
func (h *SuperAdminHandler) DeleteShopProduct(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	prodID, err := strconv.ParseInt(c.Param("productId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_product_id"})
		return
	}
	if err := h.sites.DeleteSiteProduct(c.Request.Context(), id, prodID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ---------------------------------------------------------------------------
// Shop orders (super-admin listing)
// ---------------------------------------------------------------------------

// ListShopOrders returns the orders of a shop.
func (h *SuperAdminHandler) ListShopOrders(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	limit := atoiDefault(c.Query("limit"), 50)
	offset := atoiDefault(c.Query("offset"), 0)
	orders, total, err := h.sites.ListSiteOrders(c.Request.Context(), id, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list_failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"items":  orders,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// ---------------------------------------------------------------------------
// Platform-level email config
// ---------------------------------------------------------------------------

// GetPlatformEmail returns the platform-wide email config (password masked).
func (h *SuperAdminHandler) GetPlatformEmail(c *gin.Context) {
	cfg, err := h.email.DB().GetPlatformEmailConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"configured": false})
		return
	}
	c.JSON(http.StatusOK, emailConfigToDTO(cfg, true))
}

// UpsertPlatformEmail creates or updates the platform email config.
func (h *SuperAdminHandler) UpsertPlatformEmail(c *gin.Context) {
	var body emailConfigInput
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload", "detail": err.Error()})
		return
	}
	cfg := body.toDomain(domain.EmailScopePlatform, nil)
	if err := h.email.DB().UpsertPlatformEmailConfig(c.Request.Context(), cfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "upsert_failed", "detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, emailConfigToDTO(cfg, true))
}

// TestPlatformEmail sends a test email using the currently-stored platform config.
func (h *SuperAdminHandler) TestPlatformEmail(c *gin.Context) {
	var body struct {
		To string `json:"to" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload", "detail": err.Error()})
		return
	}
	err := h.email.Send(c.Request.Context(), usecase.SendInput{
		SiteID:   nil,
		To:       body.To,
		Subject:  "Sun.store — тест платформы email",
		BodyHTML: "<p>Это тестовое письмо с платформы Sun.store.</p><p>Если вы получили это письмо — настройка SMTP работает корректно.</p>",
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "send_failed", "detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ---------------------------------------------------------------------------
// Per-site email overrides
// ---------------------------------------------------------------------------

// GetSiteEmail returns the per-site email override (or 404 → fall back to platform).
func (h *SuperAdminHandler) GetSiteEmail(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	cfg, err := h.email.DB().GetSiteEmailConfig(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"configured": false})
		return
	}
	c.JSON(http.StatusOK, emailConfigToDTO(cfg, true))
}

// UpsertSiteEmail creates or updates the per-site override.
func (h *SuperAdminHandler) UpsertSiteEmail(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	var body emailConfigInput
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload", "detail": err.Error()})
		return
	}
	siteID := id
	cfg := body.toDomain(domain.EmailScopeSite, &siteID)
	if err := h.email.DB().UpsertSiteEmailConfig(c.Request.Context(), cfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "upsert_failed", "detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, emailConfigToDTO(cfg, true))
}

// DeleteSiteEmail removes the per-site override (falls back to platform default).
func (h *SuperAdminHandler) DeleteSiteEmail(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	_ = h.email.DB().DeleteSiteEmailConfig(c.Request.Context(), id)
	c.Status(http.StatusNoContent)
}

// TestSiteEmail sends a test email using the per-site config (or platform fallback).
func (h *SuperAdminHandler) TestSiteEmail(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	var body struct {
		To string `json:"to" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload", "detail": err.Error()})
		return
	}
	siteID := id
	err = h.email.Send(c.Request.Context(), usecase.SendInput{
		SiteID:   &siteID,
		To:       body.To,
		Subject:  "Sun.store — тест email для магазина",
		BodyHTML: "<p>Тестовое письмо для магазина. Если вы получили это — настроенный для магазина SMTP работает.</p>",
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "send_failed", "detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ListEmailOutbox returns recent email attempts (optionally filtered by site).
func (h *SuperAdminHandler) ListEmailOutbox(c *gin.Context) {
	var siteID int64 = 0
	if s := c.Param("id"); s != "" {
		if v, err := strconv.ParseInt(s, 10, 64); err == nil {
			siteID = v
		}
	}
	limit := atoiDefault(c.Query("limit"), 50)
	entries, err := h.email.DB().ListEmailOutbox(c.Request.Context(), siteID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list_failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": entries})
}

// ---------------------------------------------------------------------------
// DTO helpers
// ---------------------------------------------------------------------------

type emailConfigInput struct {
	Provider     string `json:"provider" binding:"required"`
	FromAddress  string `json:"from_address" binding:"required"`
	FromName     string `json:"from_name"`
	SMTPHost     string `json:"smtp_host"`
	SMTPPort     int    `json:"smtp_port"`
	SMTPUsername string `json:"smtp_username"`
	SMTPPassword string `json:"smtp_password"` // empty = keep existing
	UseTLS       bool   `json:"use_tls"`
	UseSSL       bool   `json:"use_ssl"`
	ReplyTo      string `json:"reply_to"`
	IsActive     bool   `json:"is_active"`
}

func (in emailConfigInput) toDomain(scope domain.EmailConfigScope, siteID *int64) *domain.EmailConfig {
	provider := domain.EmailProvider(in.Provider)
	if provider != domain.EmailProviderGmail && provider != domain.EmailProviderSMTP {
		provider = domain.EmailProviderSMTP
	}
	if in.FromName == "" {
		in.FromName = "Sun.store Platform"
	}
	return &domain.EmailConfig{
		Scope:        scope,
		SiteID:       siteID,
		Provider:     provider,
		FromAddress:  in.FromAddress,
		FromName:     in.FromName,
		SMTPHost:     in.SMTPHost,
		SMTPPort:     in.SMTPPort,
		SMTPUsername: in.SMTPUsername,
		SMTPPassword: in.SMTPPassword,
		UseTLS:       in.UseTLS,
		UseSSL:       in.UseSSL,
		ReplyTo:      in.ReplyTo,
		IsActive:     in.IsActive,
	}
}

// emailConfigToDTO converts a domain.EmailConfig into a JSON-safe DTO.
// When maskSecret is true, the password is replaced with "••••••" so it is
// never serialized to the client.
func emailConfigToDTO(c *domain.EmailConfig, maskSecret bool) gin.H {
	pw := c.SMTPPassword
	if maskSecret && pw != "" {
		pw = "••••••"
	}
	return gin.H{
		"configured":    true,
		"id":            c.ID,
		"scope":         c.Scope,
		"site_id":       c.SiteID,
		"provider":      c.Provider,
		"from_address":  c.FromAddress,
		"from_name":     c.FromName,
		"smtp_host":     c.SMTPHost,
		"smtp_port":     c.SMTPPort,
		"smtp_username": c.SMTPUsername,
		"smtp_password": pw,
		"use_tls":       c.UseTLS,
		"use_ssl":       c.UseSSL,
		"reply_to":      c.ReplyTo,
		"is_active":     c.IsActive,
		"updated_at":    c.UpdatedAt,
	}
}
