// Package httpdelivery contains HTTP handlers for the multi-site platform.
package httpdelivery

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"sunstore/internal/domain"
	"sunstore/internal/usecase"
)

// SiteHandler exposes the central multi-site management endpoints.
type SiteHandler struct {
	sites *usecase.SiteService
	auth  *usecase.SiteAuthService
}

func NewSiteHandler(sites *usecase.SiteService, auth *usecase.SiteAuthService) *SiteHandler {
	return &SiteHandler{sites: sites, auth: auth}
}

// List returns the page of sites managed by the central platform.
func (h *SiteHandler) List(c *gin.Context) {
	f := domain.SiteFilter{
		Status:     domain.SiteStatus(c.Query("status")),
		Niche:      c.Query("niche"),
		TemplateID: c.Query("template_id"),
		Search:     c.Query("q"),
		Limit:      atoiDefault(c.Query("limit"), 50),
		Offset:     atoiDefault(c.Query("offset"), 0),
	}
	sites, total, err := h.sites.List(c.Request.Context(), f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list_failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"items":  sites,
		"total":  total,
		"limit":  f.Limit,
		"offset": f.Offset,
	})
}

// GetBySlug returns a public site profile + theme tokens.
func (h *SiteHandler) GetBySlug(c *gin.Context) {
	slug := c.Param("siteSlug")
	site, err := h.sites.GetBySlug(c.Request.Context(), slug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}
	if site.Status != domain.SiteStatusReady {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}
	c.JSON(http.StatusOK, site)
}

// ListPublicProducts returns the active catalog for one public storefront.
func (h *SiteHandler) ListPublicProducts(c *gin.Context) {
	slug := c.Param("siteSlug")
	site, err := h.sites.GetBySlug(c.Request.Context(), slug)
	if err != nil || site.Status != domain.SiteStatusReady {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}
	products, err := h.sites.ListSiteProducts(c.Request.Context(), site.ID, true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list_failed"})
		return
	}
	out := make([]gin.H, 0, len(products))
	for _, p := range products {
		out = append(out, gin.H{
			"id":               p.ID,
			"site_id":          p.SiteID,
			"site_slug":        site.Slug,
			"site_name":        site.Name,
			"category_id":      nil,
			"category_slug":    p.Category,
			"category_name_ru": p.Category,
			"slug":             p.Slug,
			"title_ru":         p.Title,
			"description_ru":   p.Description,
			"price_kopecks":    p.PriceKopecks,
			"sku":              p.SKU,
			"stock_quantity":   p.StockQuantity,
			"images":           p.Images,
			"is_active":        p.IsActive,
			"created_at":       p.CreatedAt,
			"updated_at":       p.UpdatedAt,
		})
	}
	c.JSON(http.StatusOK, out)
}

// Create registers a brand-new site + first owner admin.
func (h *SiteHandler) Create(c *gin.Context) {
	var in usecase.CreateSiteInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload", "detail": err.Error()})
		return
	}
	site, admin, err := h.sites.CreateSite(c.Request.Context(), in)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "create_failed", "detail": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"site": site,
		"admin": gin.H{
			"id":       admin.ID,
			"username": admin.Username,
			"role":     admin.Role,
		},
		"admin_url":      "/sites/" + site.Slug + "/admin/login",
		"storefront_url": "/sites/" + site.Slug,
	})
}

// SetStatus transitions a site's lifecycle.
func (h *SiteHandler) SetStatus(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	var body struct {
		Status domain.SiteStatus `json:"status"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload"})
		return
	}
	if err := h.sites.SetStatus(c.Request.Context(), id, body.Status); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "update_failed", "detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": body.Status})
}

// --- Per-site admin auth ---

// SiteAdminLogin authenticates a per-site admin and returns a JWT.
func (h *SiteHandler) SiteAdminLogin(c *gin.Context) {
	slug := c.Param("siteSlug")
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload"})
		return
	}
	admin, site, err := h.auth.Authenticate(c.Request.Context(), slug, body.Username, body.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth_failed", "detail": err.Error()})
		return
	}
	token, err := signSiteAdminJWT(site, admin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token_failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"admin": gin.H{
			"id":       admin.ID,
			"username": admin.Username,
			"role":     admin.Role,
		},
		"site": gin.H{
			"id":   site.ID,
			"slug": site.Slug,
			"name": site.Name,
		},
	})
}

// ListSiteAdmins lists the per-site admins.
func (h *SiteHandler) ListSiteAdmins(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	admins, err := h.auth.ListAdmins(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list_failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": admins})
}

// AddSiteAdmin creates a new per-site admin.
func (h *SiteHandler) AddSiteAdmin(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload"})
		return
	}
	admin, err := h.auth.AddAdmin(c.Request.Context(), id, body.Username, body.Password, body.Role)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "create_failed", "detail": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, admin)
}

// RemoveSiteAdmin deletes a per-site admin.
func (h *SiteHandler) RemoveSiteAdmin(c *gin.Context) {
	siteID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	adminID, err := strconv.ParseInt(c.Param("adminId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	if err := h.auth.RemoveAdmin(c.Request.Context(), siteID, adminID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func atoiDefault(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil {
		return def
	}
	return n
}
