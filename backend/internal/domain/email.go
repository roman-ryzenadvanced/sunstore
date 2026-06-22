// Package domain — email configuration + outbox entities.
package domain

import "time"

// EmailProvider is the type of SMTP backend in use.
type EmailProvider string

const (
	EmailProviderSMTP  EmailProvider = "smtp"
	EmailProviderGmail EmailProvider = "gmail"
)

// EmailConfigScope tells whether this config is the platform default
// or a per-site override.
type EmailConfigScope string

const (
	EmailScopePlatform EmailConfigScope = "platform"
	EmailScopeSite     EmailConfigScope = "site"
)

// EmailConfig is a stored SMTP / Gmail configuration.
type EmailConfig struct {
	ID           int64
	Scope        EmailConfigScope
	SiteID       *int64
	Provider     EmailProvider
	FromAddress  string
	FromName     string
	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string // app-level secret; never serialized to client in plaintext
	UseTLS       bool
	UseSSL       bool
	ReplyTo      string
	IsActive     bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// EmailOutboxEntry is a single email attempt (sent or failed).
type EmailOutboxEntry struct {
	ID        int64
	SiteID    *int64
	ConfigID  *int64
	ToAddress string
	Subject   string
	BodyHTML  string
	Status    string // PENDING | SENT | FAILED
	Error     string
	SentAt    *time.Time
	CreatedAt time.Time
}
