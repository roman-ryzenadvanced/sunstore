// Package httpdelivery wires the entire HTTP surface, including the
// central multi-site management endpoints.
package httpdelivery

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"sunstore/internal/config"
	"sunstore/internal/usecase"
)

// HealthChecker is the subset required for /healthz.
type HealthChecker interface {
	Ping(ctx context.Context) error
}

// RouterDeps groups all delivery-layer dependencies.
type RouterDeps struct {
	Config        *config.Config
	Logger        *slog.Logger
	DB            HealthChecker
	Products      *usecase.ProductUseCase
	Orders        *usecase.OrderUseCase
	Payments      *usecase.PaymentUseCase
	SiteCheckout  *usecase.SiteCheckoutUseCase
	Admins        *usecase.AdminUseCase
	Notifications *usecase.PaymentNotificationUseCase
	Sites         *usecase.SiteService
	SiteAuth      *usecase.SiteAuthService
	Super         *usecase.SuperAdminService
	Email         *usecase.EmailUseCase
	CRM           *usecase.CRMUseCase
}

// NewRouter builds the entire HTTP surface.
func NewRouter(deps RouterDeps) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(requestLogger(deps.Logger))
	r.Use(corsMiddleware(deps.Config.App.AllowedOrigins))

	productHandler := NewProductHandler(deps.Products)
	orderHandler := NewOrderHandler(deps.Orders, deps.Payments, deps.SiteCheckout)
	adminHandler := NewAdminHandler(deps.Admins)
	webhookHandler := NewWebhookHandler(deps.Logger, deps.Notifications)
	siteHandler := NewSiteHandler(deps.Sites, deps.SiteAuth)
	superHandler := NewSuperAdminHandler(deps.Sites, deps.Email)
	crmHandler := NewCRMHandler(deps.CRM, deps.Sites, deps.Email, deps.Config.Platform)

	r.GET("/healthz", func(c *gin.Context) {
		pingCtx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := deps.DB.Ping(pingCtx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status": "degraded",
				"db":     "down",
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"db":     "up",
		})
	})

	api := r.Group("/api/v1")
	{
		// Public storefront
		api.GET("/products", productHandler.ListStorefront)
		api.GET("/products/:slug", productHandler.GetStorefrontBySlug)
		api.POST("/checkout/init", orderHandler.CheckoutInit)

		// Legacy single-tenant admin (kept for backward-compat)
		adminAuth := api.Group("/admin/auth")
		adminAuth.POST("/login", adminHandler.Login)

		admin := api.Group("/admin")
		admin.Use(adminAuthMiddleware(deps.Admins))
		{
			admin.GET("/products", productHandler.ListAdmin)
			admin.POST("/products", productHandler.CreateAdmin)
			admin.PUT("/products/:id", productHandler.UpdateAdmin)
			admin.DELETE("/products/:id", productHandler.DeleteAdmin)
			admin.GET("/orders", orderHandler.ListAdmin)
		}

		// Multi-site central admin (super-admin)
		central := api.Group("/central")
		{
			central.POST("/auth/login", superAdminLoginHandler(deps.Super))

			// Shop list + create + lifecycle
			central.GET("/sites", centralAuthMiddleware(), siteHandler.List)
			central.POST("/sites", centralAuthMiddleware(), siteHandler.Create)
			central.PATCH("/sites/:id/status", centralAuthMiddleware(), siteHandler.SetStatus)

			// Cross-store unified views (super-admin "all orders" / "all products")
			central.GET("/orders", centralAuthMiddleware(), superHandler.ListAllOrders)
			central.GET("/products", centralAuthMiddleware(), superHandler.ListAllProducts)

			// Shop detail (super-admin consolidated panel)
			central.GET("/sites/:id", centralAuthMiddleware(), superHandler.GetShop)
			central.PATCH("/sites/:id/theme", centralAuthMiddleware(), superHandler.UpdateTheme)
			central.PATCH("/sites/:id/branding", centralAuthMiddleware(), superHandler.UpdateBranding)

			// Shop products (super-admin CRUD)
			central.GET("/sites/:id/products", centralAuthMiddleware(), superHandler.ListShopProducts)
			central.POST("/sites/:id/products", centralAuthMiddleware(), superHandler.CreateShopProduct)
			central.PUT("/sites/:id/products/:productId", centralAuthMiddleware(), superHandler.UpdateShopProduct)
			central.DELETE("/sites/:id/products/:productId", centralAuthMiddleware(), superHandler.DeleteShopProduct)

			// Shop orders (super-admin listing)
			central.GET("/sites/:id/orders", centralAuthMiddleware(), superHandler.ListShopOrders)

			// Email outbox (audit log)
			central.GET("/email-outbox", centralAuthMiddleware(), superHandler.ListEmailOutbox)
			central.GET("/sites/:id/email-outbox", centralAuthMiddleware(), superHandler.ListEmailOutbox)

			// Platform-level email config
			central.GET("/email-config", centralAuthMiddleware(), superHandler.GetPlatformEmail)
			central.PUT("/email-config", centralAuthMiddleware(), superHandler.UpsertPlatformEmail)
			central.POST("/email-config/test", centralAuthMiddleware(), superHandler.TestPlatformEmail)

			// Per-site email override
			central.GET("/sites/:id/email-config", centralAuthMiddleware(), superHandler.GetSiteEmail)
			central.PUT("/sites/:id/email-config", centralAuthMiddleware(), superHandler.UpsertSiteEmail)
			central.DELETE("/sites/:id/email-config", centralAuthMiddleware(), superHandler.DeleteSiteEmail)
			central.POST("/sites/:id/email-config/test", centralAuthMiddleware(), superHandler.TestSiteEmail)

			// Legacy per-site admin management (kept for backward compat; super admin can use it too)
			central.GET("/sites/:id/admins", centralAuthMiddleware(), siteHandler.ListSiteAdmins)
			central.POST("/sites/:id/admins", centralAuthMiddleware(), siteHandler.AddSiteAdmin)
			central.DELETE("/sites/:id/admins/:adminId", centralAuthMiddleware(), siteHandler.RemoveSiteAdmin)

			// ── CRM: custom domains + DNS ──────────────────────────────────
			central.GET("/dns/platform", centralAuthMiddleware(), crmHandler.PlatformDNS)
			central.GET("/sites/:id/domain", centralAuthMiddleware(), crmHandler.AttachDomain) // GET returns instructions
			central.POST("/sites/:id/domain", centralAuthMiddleware(), crmHandler.AttachDomain)
			central.DELETE("/sites/:id/domain", centralAuthMiddleware(), crmHandler.RemoveDomain)
			central.POST("/sites/:id/domain/verify", centralAuthMiddleware(), crmHandler.VerifyDomain)

			// ── CRM: support / contact-form inbox ─────────────────────────
			central.GET("/tickets", centralAuthMiddleware(), crmHandler.ListAllTickets)
			central.GET("/sites/:id/tickets", centralAuthMiddleware(), crmHandler.ListShopTickets)
			central.PATCH("/sites/:id/tickets/:ticketId", centralAuthMiddleware(), crmHandler.UpdateTicket)

			// ── CRM: mailing-list management ───────────────────────────────
			central.GET("/subscribers", centralAuthMiddleware(), crmHandler.ListAllSubscribers)
			central.GET("/sites/:id/subscribers", centralAuthMiddleware(), crmHandler.ListShopSubscribers)
			central.DELETE("/sites/:id/subscribers/:subscriberId", centralAuthMiddleware(), crmHandler.RemoveSubscriber)
			central.POST("/broadcast", centralAuthMiddleware(), crmHandler.Broadcast)
		}

		// Per-site public profile (theme + identity)
		api.GET("/sites/:siteSlug", siteHandler.GetBySlug)
		api.GET("/sites/:siteSlug/products", siteHandler.ListPublicProducts)

		// Per-site admin login
		api.POST("/sites/:siteSlug/admin/auth/login", siteHandler.SiteAdminLogin)

		// ── Public storefront CRM endpoints (contact form + newsletter) ────
		api.POST("/sites/:siteSlug/contact", crmHandler.PublicContact)
		api.POST("/sites/:siteSlug/subscribe", crmHandler.PublicSubscribe)
		api.DELETE("/sites/:siteSlug/subscribe", crmHandler.PublicUnsubscribe)

		// T-Bank webhook (existing)
		webhooks := api.Group("/webhooks")
		webhooks.POST("/tbank", webhookHandler.TBank)
	}

	return r
}

// superAdminLoginHandler returns a closure that authenticates a central admin.
func superAdminLoginHandler(svc *usecase.SuperAdminService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload"})
			return
		}
		admin, err := svc.Authenticate(c.Request.Context(), body.Username, body.Password)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "auth_failed"})
			return
		}
		tok, err := SignSuperAdminJWT(admin)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "token_failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"token":    tok,
			"username": admin.Username,
		})
	}
}
