// Package postgres — email_configs + email_outbox persistence.
package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"sunstore/internal/domain"
)

// --- Email configs ---

// UpsertPlatformEmailConfig stores the single platform-wide email config.
func (d *DB) UpsertPlatformEmailConfig(ctx context.Context, c *domain.EmailConfig) error {
	const q = `
		INSERT INTO email_configs (scope, site_id, provider, from_address, from_name,
		                           smtp_host, smtp_port, smtp_username, smtp_password,
		                           use_tls, use_ssl, reply_to, is_active)
		VALUES ('platform', NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (scope) WHERE scope = 'platform' AND site_id IS NULL
		DO UPDATE SET
			provider       = EXCLUDED.provider,
			from_address   = EXCLUDED.from_address,
			from_name      = EXCLUDED.from_name,
			smtp_host      = EXCLUDED.smtp_host,
			smtp_port      = EXCLUDED.smtp_port,
			smtp_username  = EXCLUDED.smtp_username,
			smtp_password  = COALESCE(NULLIF(EXCLUDED.smtp_password, ''), email_configs.smtp_password),
			use_tls        = EXCLUDED.use_tls,
			use_ssl        = EXCLUDED.use_ssl,
			reply_to       = EXCLUDED.reply_to,
			is_active      = EXCLUDED.is_active,
			updated_at     = CURRENT_TIMESTAMP
		RETURNING id, created_at, updated_at`
	return d.Pool.QueryRow(ctx, q,
		c.Provider, c.FromAddress, c.FromName,
		c.SMTPHost, c.SMTPPort, c.SMTPUsername, c.SMTPPassword,
		c.UseTLS, c.UseSSL, c.ReplyTo, c.IsActive,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

// UpsertSiteEmailConfig stores (or updates) a per-site email override.
func (d *DB) UpsertSiteEmailConfig(ctx context.Context, c *domain.EmailConfig) error {
	if c.SiteID == nil {
		return errors.New("site email config requires site_id")
	}
	const q = `
		INSERT INTO email_configs (scope, site_id, provider, from_address, from_name,
		                           smtp_host, smtp_port, smtp_username, smtp_password,
		                           use_tls, use_ssl, reply_to, is_active)
		VALUES ('site', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (site_id) WHERE scope = 'site'
		DO UPDATE SET
			provider       = EXCLUDED.provider,
			from_address   = EXCLUDED.from_address,
			from_name      = EXCLUDED.from_name,
			smtp_host      = EXCLUDED.smtp_host,
			smtp_port      = EXCLUDED.smtp_port,
			smtp_username  = EXCLUDED.smtp_username,
			smtp_password  = COALESCE(NULLIF(EXCLUDED.smtp_password, ''), email_configs.smtp_password),
			use_tls        = EXCLUDED.use_tls,
			use_ssl        = EXCLUDED.use_ssl,
			reply_to       = EXCLUDED.reply_to,
			is_active      = EXCLUDED.is_active,
			updated_at     = CURRENT_TIMESTAMP
		RETURNING id, created_at, updated_at`
	return d.Pool.QueryRow(ctx, q,
		*c.SiteID, c.Provider, c.FromAddress, c.FromName,
		c.SMTPHost, c.SMTPPort, c.SMTPUsername, c.SMTPPassword,
		c.UseTLS, c.UseSSL, c.ReplyTo, c.IsActive,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

// GetPlatformEmailConfig returns the platform-wide config (or ErrNotFound).
func (d *DB) GetPlatformEmailConfig(ctx context.Context) (*domain.EmailConfig, error) {
	const q = selectEmailConfigBase + ` WHERE scope = 'platform' AND site_id IS NULL LIMIT 1`
	return scanEmailConfig(d.Pool.QueryRow(ctx, q))
}

// GetSiteEmailConfig returns the site-specific override (or ErrNotFound).
func (d *DB) GetSiteEmailConfig(ctx context.Context, siteID int64) (*domain.EmailConfig, error) {
	const q = selectEmailConfigBase + ` WHERE scope = 'site' AND site_id = $1 LIMIT 1`
	return scanEmailConfig(d.Pool.QueryRow(ctx, q, siteID))
}

// GetEffectiveEmailConfig returns the per-site config if one exists, else the
// platform default. This is what the email usecase should call before sending.
func (d *DB) GetEffectiveEmailConfig(ctx context.Context, siteID int64) (*domain.EmailConfig, error) {
	cfg, err := d.GetSiteEmailConfig(ctx, siteID)
	if err == nil {
		return cfg, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return nil, err
	}
	return d.GetPlatformEmailConfig(ctx)
}

// DeleteSiteEmailConfig removes the per-site override (falls back to platform default).
func (d *DB) DeleteSiteEmailConfig(ctx context.Context, siteID int64) error {
	tag, err := d.Pool.Exec(ctx, `DELETE FROM email_configs WHERE scope = 'site' AND site_id = $1`, siteID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// --- Outbox ---

// InsertEmailOutboxEntry logs an email attempt.
func (d *DB) InsertEmailOutboxEntry(ctx context.Context, e *domain.EmailOutboxEntry) error {
	const q = `INSERT INTO email_outbox (site_id, config_id, to_address, subject, body_html, status, error, sent_at)
	           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at`
	return d.Pool.QueryRow(ctx, q,
		e.SiteID, e.ConfigID, e.ToAddress, e.Subject, e.BodyHTML, e.Status, e.Error, e.SentAt,
	).Scan(&e.ID, &e.CreatedAt)
}

// ListEmailOutbox returns the most recent N entries for a site (or platform-wide if siteID == 0).
func (d *DB) ListEmailOutbox(ctx context.Context, siteID int64, limit int) ([]*domain.EmailOutboxEntry, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	var q string
	var args []any
	if siteID > 0 {
		q = `SELECT id, site_id, config_id, to_address, subject, status, error, sent_at, created_at
		     FROM email_outbox WHERE site_id = $1 ORDER BY created_at DESC LIMIT $2`
		args = []any{siteID, limit}
	} else {
		q = `SELECT id, site_id, config_id, to_address, subject, status, error, sent_at, created_at
		     FROM email_outbox ORDER BY created_at DESC LIMIT $1`
		args = []any{limit}
	}
	rows, err := d.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]*domain.EmailOutboxEntry, 0, limit)
	for rows.Next() {
		e := &domain.EmailOutboxEntry{}
		if err := rows.Scan(&e.ID, &e.SiteID, &e.ConfigID, &e.ToAddress, &e.Subject, &e.Status, &e.Error, &e.SentAt, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// --- scan helpers ---

const selectEmailConfigBase = `SELECT id, scope, site_id, provider, from_address, from_name,
       smtp_host, smtp_port, smtp_username, smtp_password, use_tls, use_ssl,
       reply_to, is_active, created_at, updated_at FROM email_configs`

func scanEmailConfig(r rowScanner) (*domain.EmailConfig, error) {
	c := &domain.EmailConfig{}
	err := r.Scan(
		&c.ID, &c.Scope, &c.SiteID, &c.Provider, &c.FromAddress, &c.FromName,
		&c.SMTPHost, &c.SMTPPort, &c.SMTPUsername, &c.SMTPPassword,
		&c.UseTLS, &c.UseSSL, &c.ReplyTo, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("scan email config: %w", err)
	}
	return c, nil
}
