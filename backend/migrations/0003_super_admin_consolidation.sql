-- ============================================================================
-- 0003_super_admin_consolidation.sql
--
-- Consolidates all shop management under the Super Admin panel.
-- Adds:
--   1. email_configs       — platform-wide + per-site SMTP / Gmail app-password
--                            configs used for outgoing notifications.
--   2. site_email_overrides — per-site override of the platform email config.
--
-- No per-site admin auth is required anymore: the super admin token authorizes
-- every operation on every shop.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- email_configs: SMTP / Gmail credentials used to send transactional email
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_configs (
    id                SERIAL PRIMARY KEY,
    scope             VARCHAR(20)  NOT NULL CHECK (scope IN ('platform','site')),
    site_id           INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    provider          VARCHAR(40)  NOT NULL DEFAULT 'smtp',  -- 'smtp' | 'gmail'
    from_address      VARCHAR(255) NOT NULL,
    from_name         VARCHAR(120) NOT NULL DEFAULT 'Sun.store Platform',
    smtp_host         VARCHAR(255),
    smtp_port         INTEGER,
    smtp_username     VARCHAR(255),
    smtp_password     VARCHAR(512),  -- stored encrypted-at-rest by app layer (or DB-level encryption)
    use_tls           BOOLEAN      NOT NULL DEFAULT TRUE,
    use_ssl           BOOLEAN      NOT NULL DEFAULT FALSE,
    reply_to          VARCHAR(255),
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (scope = 'platform' AND site_id IS NULL)
        OR
        (scope = 'site'     AND site_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_configs_platform
    ON email_configs (scope)
    WHERE scope = 'platform' AND site_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_configs_site
    ON email_configs (site_id)
    WHERE scope = 'site';

CREATE INDEX IF NOT EXISTS idx_email_configs_active ON email_configs (is_active);

DROP TRIGGER IF EXISTS email_configs_set_updated_at ON email_configs;
CREATE TRIGGER email_configs_set_updated_at
    BEFORE UPDATE ON email_configs
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_updated_at();

-- ---------------------------------------------------------------------------
-- email_outbox: audit log of every email sent by the platform (best-effort).
-- Useful for debugging "I didn't receive my confirmation" tickets.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_outbox (
    id              SERIAL PRIMARY KEY,
    site_id         INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    config_id       INTEGER REFERENCES email_configs(id) ON DELETE SET NULL,
    to_address      VARCHAR(255) NOT NULL,
    subject         VARCHAR(500) NOT NULL,
    body_html       TEXT,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',  -- 'PENDING' | 'SENT' | 'FAILED'
    error           TEXT,
    sent_at         TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_site   ON email_outbox (site_id);
CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON email_outbox (status);

COMMIT;
