// Package main is the entry point of the Sun.store-style e-commerce API.
// Phase 1 wires up configuration, logging, the PostgreSQL pool, and a
// minimal Gin router with a /healthz endpoint. The full route map,
// middleware chain, and use-case wiring are introduced in Phase 2/3.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"sunstore/internal/config"
	httpdelivery "sunstore/internal/delivery/http"
	"sunstore/internal/repository/postgres"
	tbankrepo "sunstore/internal/repository/tbank"
	"sunstore/internal/usecase"
)

const (
	readHeaderTimeout = 5 * time.Second
	idleTimeout       = 60 * time.Second
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	if err := run(logger); err != nil {
		logger.Error("fatal startup error", slog.String("err", err.Error()))
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	logger.Info("config loaded",
		slog.String("env", cfg.App.Env),
		slog.Int("port", cfg.App.Port),
	)

	rootCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	db, err := postgres.New(rootCtx, cfg.DB)
	if err != nil {
		return err
	}
	defer db.Close()
	logger.Info("postgres connection pool established")

	if !cfg.App.IsDevelopment() {
		gin.SetMode(gin.ReleaseMode)
	}

	productRepo := postgres.NewProductRepository(db.Pool)
	orderRepo := postgres.NewOrderRepository(db)
	adminRepo := postgres.NewAdminUserRepository(db.Pool)
	var paymentGateway usecase.PaymentGateway
	if cfg.TBank.IsDemo() {
		logger.Info("tbank demo mode enabled")
		paymentGateway = tbankrepo.NewDemoClient(cfg.TBank, logger)
	} else {
		logger.Info("tbank gateway configured", slog.String("mode", strings.ToLower(cfg.TBank.Mode)))
		paymentGateway = tbankrepo.NewClient(cfg.TBank, logger)
	}
	tbankNotifier := tbankrepo.NewNotifier(cfg.TBank.Password)

	productUC := usecase.NewProductUseCase(productRepo)
	orderUC := usecase.NewOrderUseCase(orderRepo)
	paymentUC := usecase.NewPaymentUseCase(productRepo, orderRepo, paymentGateway)
	siteCheckoutUC := usecase.NewSiteCheckoutUseCase(db, paymentGateway)
	adminUC := usecase.NewAdminUseCase(adminRepo, cfg.JWT.Secret, cfg.JWT.Issuer, cfg.JWT.TTL)
	notificationUC := usecase.NewPaymentNotificationUseCase(orderRepo, db, tbankNotifier)

	// Multi-site
	siteSvc := usecase.NewSiteService(db)
	siteAuthSvc := usecase.NewSiteAuthService(db)
	superSvc := usecase.NewSuperAdminService(db)
	emailSvc := usecase.NewEmailUseCase(db)
	crmSvc := usecase.NewCRMUseCase(db)
	bootstrapUsername := strings.TrimSpace(os.Getenv("SUPER_ADMIN_BOOTSTRAP_USERNAME"))
	bootstrapPassword := os.Getenv("SUPER_ADMIN_BOOTSTRAP_PASSWORD")
	if cfg.App.IsDevelopment() && bootstrapUsername == "" && bootstrapPassword == "" {
		bootstrapUsername = "admin"
		bootstrapPassword = "changeme123"
	}
	if bootstrapUsername != "" && bootstrapPassword != "" {
		if err := superSvc.EnsureDefault(rootCtx, bootstrapUsername, bootstrapPassword); err != nil {
			logger.Warn("super-admin bootstrap failed", slog.String("err", err.Error()))
		}
	} else {
		logger.Info("super-admin bootstrap skipped")
	}

	// Initialize the JWT signer used by the central/super and site tokens.
	httpdelivery.SetJWTConfig(cfg.JWT)

	router := httpdelivery.NewRouter(httpdelivery.RouterDeps{
		Config:        cfg,
		Logger:        logger,
		DB:            db,
		Products:      productUC,
		Orders:        orderUC,
		Payments:      paymentUC,
		SiteCheckout:  siteCheckoutUC,
		Admins:        adminUC,
		Notifications: notificationUC,
		Sites:         siteSvc,
		SiteAuth:      siteAuthSvc,
		Super:         superSvc,
		Email:         emailSvc,
		CRM:           crmSvc,
	})

	srv := &http.Server{
		Addr:              addrFromPort(cfg.App.Port),
		Handler:           router,
		ReadHeaderTimeout: readHeaderTimeout,
		ReadTimeout:       cfg.App.ReadTimeout,
		WriteTimeout:      cfg.App.WriteTimeout,
		IdleTimeout:       idleTimeout,
	}

	serverErr := make(chan error, 1)
	go func() {
		logger.Info("HTTP server starting", slog.String("addr", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
		close(serverErr)
	}()

	select {
	case err := <-serverErr:
		return err
	case <-rootCtx.Done():
		logger.Info("shutdown signal received, draining connections")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.App.ShutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", slog.String("err", err.Error()))
		return err
	}
	logger.Info("server stopped cleanly")
	return nil
}

func addrFromPort(port int) string {
	return ":" + itoa(port)
}

// itoa avoids importing strconv into the bootstrap file (kept hot-path lean).
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	buf := [20]byte{}
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
