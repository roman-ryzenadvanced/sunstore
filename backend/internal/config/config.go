// Package config loads, validates, and exposes runtime configuration
// for the Sun.store-style e-commerce backend.
//
// All values are pulled from environment variables. Required values cause
// Load() to return an error; defaults are applied for the rest. The package
// is intentionally tiny and dependency-free aside from the standard library
// so it can be used from any layer (main, tests, CLI tools).
package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config is the fully-resolved runtime configuration for the API service.
type Config struct {
	App      AppConfig
	DB       PostgresConfig
	TBank    TBankConfig
	JWT      JWTConfig
	Platform PlatformConfig
}

// PlatformConfig describes the hosted-store platform (nameservers, apex IP,
// preview base URL) used to generate custom-domain + onboarding instructions.
type PlatformConfig struct {
	Name           string   // platform display name, e.g. "Sun.store"
	Nameservers    []string // nameservers store owners must set at their registrar
	ApexIP         string   // A-record target for apex domains
	PreviewBaseURL string   // base URL for slug-based previews (e.g. the Vercel app)
	APIDocsURL     string   // public API / docs URL
}

// AppConfig covers HTTP-server-level concerns.
type AppConfig struct {
	Env             string        // "development" | "staging" | "production"
	Port            int           // TCP port to bind
	ReadTimeout     time.Duration // request read deadline
	WriteTimeout    time.Duration // response write deadline
	ShutdownTimeout time.Duration // graceful-shutdown budget
	AllowedOrigins  []string      // CORS allow-list
}

// IsDevelopment reports whether the service is running in a non-production env.
func (a AppConfig) IsDevelopment() bool { return a.Env != "production" }

// PostgresConfig holds the connection parameters for the primary database.
type PostgresConfig struct {
	Host            string
	Port            int
	User            string
	Password        string
	Database        string
	SSLMode         string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

// DSN renders a libpq-compatible connection string suitable for pgx.
func (p PostgresConfig) DSN() string {
	u := url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(p.User, p.Password),
		Host:   fmt.Sprintf("%s:%d", p.Host, p.Port),
		Path:   "/" + p.Database,
	}
	q := u.Query()
	q.Set("sslmode", p.SSLMode)
	u.RawQuery = q.Encode()
	return u.String()
}

// TBankConfig carries the Internet-Acquiring credentials and endpoints.
type TBankConfig struct {
	Mode            string        // "live" | "sandbox" | "demo"
	TerminalKey     string        // shop identifier
	Password        string        // terminal password used for token signing
	APIBaseURL      string        // base URL for Init/Confirm/CheckStatus calls
	InitTimeout     time.Duration // per-request HTTP timeout
	NotificationURL string        // server-to-server callback URL
	ReturnURL       string        // customer redirect after success
	FailureURL      string        // customer redirect after failure
}

// IsDemo reports whether the payment layer should use the local demo gateway.
func (t TBankConfig) IsDemo() bool { return strings.EqualFold(strings.TrimSpace(t.Mode), "demo") }

// JWTConfig controls admin-portal token issuance and validation.
type JWTConfig struct {
	Secret []byte
	TTL    time.Duration
	Issuer string
}

// Load reads configuration from process environment, applies defaults,
// and validates all required fields. Returns a populated *Config or an error.
func Load() (*Config, error) {
	cfg := &Config{
		App: AppConfig{
			Env:             getString("APP_ENV", "development"),
			Port:            getInt("APP_PORT", 8080),
			ReadTimeout:     getDuration("APP_READ_TIMEOUT", 15*time.Second),
			WriteTimeout:    getDuration("APP_WRITE_TIMEOUT", 15*time.Second),
			ShutdownTimeout: getDuration("APP_SHUTDOWN_TIMEOUT", 20*time.Second),
			AllowedOrigins:  splitCSV(getString("APP_CORS_ALLOWED_ORIGINS", "http://localhost:3000")),
		},
		DB: PostgresConfig{
			Host:            getString("POSTGRES_HOST", "localhost"),
			Port:            getInt("POSTGRES_PORT", 5432),
			User:            getString("POSTGRES_USER", "postgres"),
			Password:        os.Getenv("POSTGRES_PASSWORD"),
			Database:        getString("POSTGRES_DB", "sunstore"),
			SSLMode:         getString("POSTGRES_SSLMODE", "disable"),
			MaxOpenConns:    getInt("POSTGRES_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    getInt("POSTGRES_MAX_IDLE_CONNS", 5),
			ConnMaxLifetime: getDuration("POSTGRES_CONN_MAX_LIFETIME", 30*time.Minute),
		},
		TBank: TBankConfig{
			Mode:            getString("TBANK_MODE", "demo"),
			TerminalKey:     os.Getenv("TBANK_TERMINAL_KEY"),
			Password:        os.Getenv("TBANK_PASSWORD"),
			APIBaseURL:      getString("TBANK_API_BASE_URL", "https://securepay.tinkoff.ru/v2"),
			InitTimeout:     getDuration("TBANK_INIT_TIMEOUT", 15*time.Second),
			NotificationURL: getString("TBANK_NOTIFICATION_URL", "http://localhost:8080/api/v1/webhooks/tbank"),
			ReturnURL:       getString("TBANK_RETURN_URL", "http://localhost:3000/checkout/status"),
			FailureURL:      getString("TBANK_FAILURE_URL", "http://localhost:3000/checkout/status?status=rejected"),
		},
		JWT: JWTConfig{
			Secret: []byte(os.Getenv("JWT_SECRET")),
			TTL:    getDuration("JWT_TTL", 12*time.Hour),
			Issuer: getString("JWT_ISSUER", "sunstore-api"),
		},
		Platform: PlatformConfig{
			Name:           getString("PLATFORM_NAME", "Sun.store"),
			Nameservers:    splitCSV(getString("PLATFORM_NAMESERVERS", "ns1.sun.store,ns2.sun.store")),
			ApexIP:         getString("PLATFORM_APEX_IP", "76.76.21.21"),
			PreviewBaseURL: getString("PLATFORM_PREVIEW_BASE_URL", "https://sunstore.vercel.app"),
			APIDocsURL:     getString("PLATFORM_API_DOCS_URL", "https://sunstore.vercel.app"),
		},
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

// validate enforces the invariants required to boot the service safely.
func (c *Config) validate() error {
	var errs []string

	if c.App.Port <= 0 || c.App.Port > 65535 {
		errs = append(errs, fmt.Sprintf("APP_PORT out of range: %d", c.App.Port))
	}
	if c.App.ReadTimeout <= 0 {
		errs = append(errs, "APP_READ_TIMEOUT must be > 0")
	}
	if c.App.WriteTimeout <= 0 {
		errs = append(errs, "APP_WRITE_TIMEOUT must be > 0")
	}
	if c.App.ShutdownTimeout <= 0 {
		errs = append(errs, "APP_SHUTDOWN_TIMEOUT must be > 0")
	}
	if len(c.App.AllowedOrigins) == 0 {
		errs = append(errs, "APP_CORS_ALLOWED_ORIGINS must list at least one origin")
	}

	if c.DB.Host == "" {
		errs = append(errs, "POSTGRES_HOST is required")
	}
	if c.DB.User == "" {
		errs = append(errs, "POSTGRES_USER is required")
	}
	if c.DB.Password == "" {
		errs = append(errs, "POSTGRES_PASSWORD is required")
	}
	if c.DB.Database == "" {
		errs = append(errs, "POSTGRES_DB is required")
	}
	if c.DB.MaxOpenConns <= 0 {
		errs = append(errs, "POSTGRES_MAX_OPEN_CONNS must be > 0")
	}
	if c.DB.MaxIdleConns < 0 || c.DB.MaxIdleConns > c.DB.MaxOpenConns {
		errs = append(errs, "POSTGRES_MAX_IDLE_CONNS must be 0..MaxOpenConns")
	}

	switch strings.ToLower(strings.TrimSpace(c.TBank.Mode)) {
	case "", "live", "sandbox", "demo":
	default:
		errs = append(errs, "TBANK_MODE must be one of: live, sandbox, demo")
	}
	if !c.TBank.IsDemo() && c.TBank.TerminalKey == "" {
		errs = append(errs, "TBANK_TERMINAL_KEY is required unless TBANK_MODE=demo")
	}
	if !c.TBank.IsDemo() && c.TBank.Password == "" {
		errs = append(errs, "TBANK_PASSWORD is required unless TBANK_MODE=demo")
	}
	if _, err := url.Parse(c.TBank.APIBaseURL); err != nil {
		errs = append(errs, "TBANK_API_BASE_URL is not a valid URL: "+err.Error())
	}
	if _, err := url.Parse(c.TBank.NotificationURL); err != nil {
		errs = append(errs, "TBANK_NOTIFICATION_URL is not a valid URL: "+err.Error())
	}

	if len(c.JWT.Secret) < 32 {
		errs = append(errs, "JWT_SECRET must be at least 32 bytes")
	}
	if c.JWT.TTL <= 0 {
		errs = append(errs, "JWT_TTL must be > 0")
	}
	if c.JWT.Issuer == "" {
		errs = append(errs, "JWT_ISSUER is required")
	}

	if len(errs) == 0 {
		return nil
	}
	return errors.New("config: invalid configuration: " + strings.Join(errs, "; "))
}

// --- helpers ---------------------------------------------------------------

func getString(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

func getInt(key string, def int) int {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func getDuration(key string, def time.Duration) time.Duration {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return def
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}
