// Package postgres contains the multi-site repository implementations.
package postgres

import (
        "context"
        "encoding/json"
        "errors"
        "fmt"
        "time"

        "github.com/jackc/pgx/v5"

        "sunstore/internal/domain"
)

// --- Sites ---

func (d *DB) CreateSite(ctx context.Context, s *domain.Site) error {
        settings, err := json.Marshal(s.Settings)
        if err != nil {
                return fmt.Errorf("postgres: marshal site settings: %w", err)
        }
        const q = `
                INSERT INTO sites (slug, name, niche, template_id, status, custom_domain,
                                   primary_color, logo_mark, tagline, description, settings)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id, created_at, updated_at`
        return d.Pool.QueryRow(ctx, q,
                s.Slug, s.Name, s.Niche, s.TemplateID, s.Status, s.CustomDomain,
                s.PrimaryColor, s.LogoMark, s.Tagline, s.Description, settings,
        ).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
}

func (d *DB) GetSiteByID(ctx context.Context, id int64) (*domain.Site, error) {
        return scanSite(d.Pool.QueryRow(ctx, selectSiteByID, id))
}

func (d *DB) GetSiteBySlug(ctx context.Context, slug string) (*domain.Site, error) {
        return scanSite(d.Pool.QueryRow(ctx, selectSiteBySlug, slug))
}

func (d *DB) ListSites(ctx context.Context, f domain.SiteFilter) ([]*domain.Site, int, error) {
        args := []any{}
        where := "WHERE 1=1"
        if f.Status != "" {
                args = append(args, f.Status)
                where += fmt.Sprintf(" AND status = $%d", len(args))
        }
        if f.Niche != "" {
                args = append(args, f.Niche)
                where += fmt.Sprintf(" AND niche = $%d", len(args))
        }
        if f.TemplateID != "" {
                args = append(args, f.TemplateID)
                where += fmt.Sprintf(" AND template_id = $%d", len(args))
        }
        if f.Search != "" {
                args = append(args, "%"+f.Search+"%")
                where += fmt.Sprintf(" AND (name ILIKE $%d OR slug ILIKE $%d)", len(args), len(args))
        }

        var total int
        if err := d.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM sites "+where, args...).Scan(&total); err != nil {
                return nil, 0, err
        }

        limit := f.Limit
        if limit <= 0 || limit > 200 {
                limit = 50
        }
        offset := f.Offset
        if offset < 0 {
                offset = 0
        }
        args = append(args, limit, offset)
        q := selectSiteBase + " " + where +
                fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", len(args)-1, len(args))

        rows, err := d.Pool.Query(ctx, q, args...)
        if err != nil {
                return nil, 0, err
        }
        defer rows.Close()

        out := make([]*domain.Site, 0, limit)
        for rows.Next() {
                s, err := scanSiteRow(rows)
                if err != nil {
                        return nil, 0, err
                }
                out = append(out, s)
        }
        return out, total, rows.Err()
}

func (d *DB) UpdateSiteStatus(ctx context.Context, id int64, status domain.SiteStatus) error {
        const q = `UPDATE sites SET status = $2, launched_at = CASE WHEN $2 = 'READY' AND launched_at IS NULL THEN CURRENT_TIMESTAMP ELSE launched_at END WHERE id = $1`
        tag, err := d.Pool.Exec(ctx, q, id, status)
        if err != nil {
                return err
        }
        if tag.RowsAffected() == 0 {
                return ErrNotFound
        }
        return nil
}

func (d *DB) UpdateSiteSettings(ctx context.Context, id int64, settings map[string]any) error {
        raw, err := json.Marshal(settings)
        if err != nil {
                return err
        }
        tag, err := d.Pool.Exec(ctx, `UPDATE sites SET settings = $2 WHERE id = $1`, id, raw)
        if err != nil {
                return err
        }
        if tag.RowsAffected() == 0 {
                return ErrNotFound
        }
        return nil
}

// UpdateSiteTheme changes the template_id (a.k.a. theme) of a site.
func (d *DB) UpdateSiteTheme(ctx context.Context, id int64, templateID string) error {
        tag, err := d.Pool.Exec(ctx, `UPDATE sites SET template_id = $2 WHERE id = $1`, id, templateID)
        if err != nil {
                return err
        }
        if tag.RowsAffected() == 0 {
                return ErrNotFound
        }
        return nil
}

// UpdateSiteBranding updates identity fields (name/tagline/color/logo) of a site.
// Empty strings are ignored (NULL is preserved).
func (d *DB) UpdateSiteBranding(ctx context.Context, id int64, name, tagline, primaryColor, logoMark *string) error {
        tag, err := d.Pool.Exec(ctx, `
                UPDATE sites SET
                        name          = COALESCE(NULLIF($2, ''), name),
                        tagline       = CASE WHEN $3::text IS NULL THEN tagline ELSE $3 END,
                        primary_color = CASE WHEN $4::text IS NULL THEN primary_color ELSE $4 END,
                        logo_mark     = CASE WHEN $5::text IS NULL THEN logo_mark ELSE $5 END
                WHERE id = $1`,
                id, name, tagline, primaryColor, logoMark)
        if err != nil {
                return err
        }
        if tag.RowsAffected() == 0 {
                return ErrNotFound
        }
        return nil
}

// --- Site Orders (super-admin listing) ---

// ListSiteOrders returns the most recent N orders for a site.
func (d *DB) ListSiteOrders(ctx context.Context, siteID int64, limit, offset int) ([]*domain.SiteOrder, int, error) {
        if limit <= 0 || limit > 200 {
                limit = 50
        }
        if offset < 0 {
                offset = 0
        }
        var total int
        if err := d.Pool.QueryRow(ctx,
                `SELECT COUNT(*) FROM site_orders WHERE site_id = $1`, siteID,
        ).Scan(&total); err != nil {
                return nil, 0, err
        }
        q := `SELECT id, site_id, tbank_order_id, tbank_payment_id, customer_name,
                     customer_email, customer_phone, total_amount_kopecks, status,
                     raw_tbank_response, created_at, updated_at
              FROM site_orders WHERE site_id = $1
              ORDER BY created_at DESC LIMIT $2 OFFSET $3`
        rows, err := d.Pool.Query(ctx, q, siteID, limit, offset)
        if err != nil {
                return nil, 0, err
        }
        defer rows.Close()
        out := make([]*domain.SiteOrder, 0, limit)
        for rows.Next() {
                o := &domain.SiteOrder{}
                if err := rows.Scan(&o.ID, &o.SiteID, &o.TBankOrderID, &o.TBankPaymentID,
                        &o.CustomerName, &o.CustomerEmail, &o.CustomerPhone,
                        &o.TotalAmountKopecks, &o.Status, &o.RawTBankResponse,
                        &o.CreatedAt, &o.UpdatedAt); err != nil {
                        return nil, 0, err
                }
                out = append(out, o)
        }
        return out, total, rows.Err()
}

func (d *DB) DeleteSite(ctx context.Context, id int64) error {
        tag, err := d.Pool.Exec(ctx, `DELETE FROM sites WHERE id = $1`, id)
        if err != nil {
                return err
        }
        if tag.RowsAffected() == 0 {
                return ErrNotFound
        }
        return nil
}

// --- Site Admins ---

func (d *DB) CreateSiteAdmin(ctx context.Context, a *domain.SiteAdmin) error {
        const q = `INSERT INTO site_admins (site_id, username, password_hash, role) VALUES ($1, $2, $3, $4)
                   RETURNING id, created_at`
        return d.Pool.QueryRow(ctx, q, a.SiteID, a.Username, a.PasswordHash, a.Role).Scan(&a.ID, &a.CreatedAt)
}

func (d *DB) GetSiteAdmin(ctx context.Context, siteID int64, username string) (*domain.SiteAdmin, error) {
        const q = `SELECT id, site_id, username, password_hash, role, is_active, last_login_at, created_at
                   FROM site_admins WHERE site_id = $1 AND username = $2`
        a := &domain.SiteAdmin{}
        err := d.Pool.QueryRow(ctx, q, siteID, username).Scan(
                &a.ID, &a.SiteID, &a.Username, &a.PasswordHash, &a.Role, &a.IsActive, &a.LastLoginAt, &a.CreatedAt,
        )
        if errors.Is(err, pgx.ErrNoRows) {
                return nil, ErrNotFound
        }
        return a, err
}

func (d *DB) ListSiteAdmins(ctx context.Context, siteID int64) ([]*domain.SiteAdmin, error) {
        const q = `SELECT id, site_id, username, password_hash, role, is_active, last_login_at, created_at
                   FROM site_admins WHERE site_id = $1 ORDER BY created_at`
        rows, err := d.Pool.Query(ctx, q, siteID)
        if err != nil {
                return nil, err
        }
        defer rows.Close()
        out := []*domain.SiteAdmin{}
        for rows.Next() {
                a := &domain.SiteAdmin{}
                if err := rows.Scan(&a.ID, &a.SiteID, &a.Username, &a.PasswordHash, &a.Role, &a.IsActive, &a.LastLoginAt, &a.CreatedAt); err != nil {
                        return nil, err
                }
                out = append(out, a)
        }
        return out, rows.Err()
}

func (d *DB) DeleteSiteAdmin(ctx context.Context, siteID int64, adminID int64) error {
        tag, err := d.Pool.Exec(ctx, `DELETE FROM site_admins WHERE site_id = $1 AND id = $2`, siteID, adminID)
        if err != nil {
                return err
        }
        if tag.RowsAffected() == 0 {
                return ErrNotFound
        }
        return nil
}

func (d *DB) TouchSiteAdminLogin(ctx context.Context, adminID int64) error {
        _, err := d.Pool.Exec(ctx, `UPDATE site_admins SET last_login_at = $2 WHERE id = $1`, adminID, time.Now().UTC())
        return err
}

// --- Super Admins ---

func (d *DB) GetSuperAdminByUsername(ctx context.Context, username string) (*domain.SuperAdmin, error) {
        const q = `SELECT id, username, password_hash, created_at FROM super_admins WHERE username = $1`
        a := &domain.SuperAdmin{}
        err := d.Pool.QueryRow(ctx, q, username).Scan(&a.ID, &a.Username, &a.PasswordHash, &a.CreatedAt)
        if errors.Is(err, pgx.ErrNoRows) {
                return nil, ErrNotFound
        }
        return a, err
}

func (d *DB) CreateSuperAdmin(ctx context.Context, a *domain.SuperAdmin) error {
        const q = `INSERT INTO super_admins (username, password_hash) VALUES ($1, $2) RETURNING id, created_at`
        return d.Pool.QueryRow(ctx, q, a.Username, a.PasswordHash).Scan(&a.ID, &a.CreatedAt)
}

// --- Site-scoped helpers ---

// --- Site Products ---

func (d *DB) CreateSiteProduct(ctx context.Context, p *domain.SiteProduct) error {
        const q = `INSERT INTO site_products (site_id, slug, title_ru, description_ru, price_kopecks, sku,
                                               stock_quantity, images, category, is_active)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, created_at, updated_at`
        return d.Pool.QueryRow(ctx, q, p.SiteID, p.Slug, p.Title, p.Description, p.PriceKopecks, p.SKU,
                p.StockQuantity, p.Images, p.Category, p.IsActive).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

func (d *DB) ListSiteProducts(ctx context.Context, siteID int64, onlyActive bool) ([]*domain.SiteProduct, error) {
        q := `SELECT id, site_id, slug, title_ru, description_ru, price_kopecks, sku, stock_quantity,
                     images, category, is_active, created_at, updated_at FROM site_products WHERE site_id = $1`
        if onlyActive {
                q += ` AND is_active = TRUE`
        }
        q += ` ORDER BY created_at DESC`
        rows, err := d.Pool.Query(ctx, q, siteID)
        if err != nil {
                return nil, err
        }
        defer rows.Close()
        out := []*domain.SiteProduct{}
        for rows.Next() {
                p := &domain.SiteProduct{}
                if err := rows.Scan(&p.ID, &p.SiteID, &p.Slug, &p.Title, &p.Description, &p.PriceKopecks, &p.SKU,
                        &p.StockQuantity, &p.Images, &p.Category, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
                        return nil, err
                }
                out = append(out, p)
        }
        return out, rows.Err()
}

func (d *DB) GetSiteProductBySlug(ctx context.Context, siteID int64, slug string) (*domain.SiteProduct, error) {
        const q = `SELECT id, site_id, slug, title_ru, description_ru, price_kopecks, sku, stock_quantity,
                          images, category, is_active, created_at, updated_at FROM site_products
                   WHERE site_id = $1 AND slug = $2`
        p := &domain.SiteProduct{}
        err := d.Pool.QueryRow(ctx, q, siteID, slug).Scan(
                &p.ID, &p.SiteID, &p.Slug, &p.Title, &p.Description, &p.PriceKopecks, &p.SKU,
                &p.StockQuantity, &p.Images, &p.Category, &p.IsActive, &p.CreatedAt, &p.UpdatedAt,
        )
        if errors.Is(err, pgx.ErrNoRows) {
                return nil, ErrNotFound
        }
        return p, err
}

func (d *DB) GetSiteProductByID(ctx context.Context, siteID, id int64) (*domain.SiteProduct, error) {
        const q = `SELECT id, site_id, slug, title_ru, description_ru, price_kopecks, sku, stock_quantity,
                          images, category, is_active, created_at, updated_at FROM site_products
                   WHERE site_id = $1 AND id = $2`
        p := &domain.SiteProduct{}
        err := d.Pool.QueryRow(ctx, q, siteID, id).Scan(
                &p.ID, &p.SiteID, &p.Slug, &p.Title, &p.Description, &p.PriceKopecks, &p.SKU,
                &p.StockQuantity, &p.Images, &p.Category, &p.IsActive, &p.CreatedAt, &p.UpdatedAt,
        )
        if errors.Is(err, pgx.ErrNoRows) {
                return nil, ErrNotFound
        }
        return p, err
}

func (d *DB) UpdateSiteProduct(ctx context.Context, p *domain.SiteProduct) error {
        const q = `UPDATE site_products SET title_ru=$3, description_ru=$4, price_kopecks=$5,
                     sku=$6, stock_quantity=$7, images=$8, category=$9, is_active=$10
                   WHERE site_id=$1 AND id=$2`
        tag, err := d.Pool.Exec(ctx, q, p.SiteID, p.ID, p.Title, p.Description, p.PriceKopecks,
                p.SKU, p.StockQuantity, p.Images, p.Category, p.IsActive)
        if err != nil {
                return err
        }
        if tag.RowsAffected() == 0 {
                return ErrNotFound
        }
        return nil
}

func (d *DB) DeleteSiteProduct(ctx context.Context, siteID, id int64) error {
        tag, err := d.Pool.Exec(ctx, `DELETE FROM site_products WHERE site_id = $1 AND id = $2`, siteID, id)
        if err != nil {
                return err
        }
        if tag.RowsAffected() == 0 {
                return ErrNotFound
        }
        return nil
}

// --- scan helpers ---

const selectSiteBase = `SELECT id, slug, name, niche, template_id, status, custom_domain,
                                    primary_color, logo_mark, tagline, description, settings,
                                    created_at, updated_at, launched_at FROM sites`
const selectSiteByID = selectSiteBase + ` WHERE id = $1`
const selectSiteBySlug = selectSiteBase + ` WHERE slug = $1`

type rowScanner interface {
        Scan(dest ...any) error
}

func scanSite(r rowScanner) (*domain.Site, error) {
        s := &domain.Site{}
        var settingsRaw []byte
        err := r.Scan(&s.ID, &s.Slug, &s.Name, &s.Niche, &s.TemplateID, &s.Status, &s.CustomDomain,
                &s.PrimaryColor, &s.LogoMark, &s.Tagline, &s.Description, &settingsRaw,
                &s.CreatedAt, &s.UpdatedAt, &s.LaunchedAt)
        if errors.Is(err, pgx.ErrNoRows) {
                return nil, ErrNotFound
        }
        if err != nil {
                return nil, err
        }
        if len(settingsRaw) > 0 {
                _ = json.Unmarshal(settingsRaw, &s.Settings)
        }
        return s, nil
}

func scanSiteRow(r rowScanner) (*domain.Site, error) { return scanSite(r) }
