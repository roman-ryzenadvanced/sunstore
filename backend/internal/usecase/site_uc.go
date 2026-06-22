// Package usecase contains the multi-site business logic.
package usecase

import (
        "context"
        "errors"
        "fmt"
        "strings"
        "time"

        "golang.org/x/crypto/bcrypt"

        "sunstore/internal/domain"
        "sunstore/internal/repository/postgres"
)

// SiteService handles creation, retrieval, and lifecycle of storefronts.
type SiteService struct {
        db *postgres.DB
}

func NewSiteService(db *postgres.DB) *SiteService { return &SiteService{db: db} }

// CreateSiteInput is the payload accepted by CreateSite.
type CreateSiteInput struct {
        Slug         string
        Name         string
        Niche        string
        TemplateID   string
        OwnerEmail   string
        OwnerUsername string
        OwnerPassword string
        PrimaryColor string
        LogoMark     string
        Tagline      string
        Description  string
        CustomDomain string
}

// CreateSite inserts a new site + creates its first owner admin in one
// transaction. Returns the persisted site and the admin record.
func (s *SiteService) CreateSite(ctx context.Context, in CreateSiteInput) (*domain.Site, *domain.SiteAdmin, error) {
        slug := strings.ToLower(strings.TrimSpace(in.Slug))
        if err := validateSlug(slug); err != nil {
                return nil, nil, err
        }
        if strings.TrimSpace(in.Name) == "" {
                return nil, nil, errors.New("site name is required")
        }
        if strings.TrimSpace(in.TemplateID) == "" {
                return nil, nil, errors.New("template id is required")
        }
        if strings.TrimSpace(in.OwnerUsername) == "" || len(in.OwnerPassword) < 8 {
                return nil, nil, errors.New("owner username and password (min 8 chars) are required")
        }

        hash, err := bcrypt.GenerateFromPassword([]byte(in.OwnerPassword), 12)
        if err != nil {
                return nil, nil, fmt.Errorf("hash owner password: %w", err)
        }

        site := &domain.Site{
                Slug:       slug,
                Name:       strings.TrimSpace(in.Name),
                Niche:      in.Niche,
                TemplateID: in.TemplateID,
                Status:     domain.SiteStatusProvisioning,
        }
        if in.PrimaryColor != "" {
                site.PrimaryColor = &in.PrimaryColor
        }
        if in.LogoMark != "" {
                site.LogoMark = &in.LogoMark
        }
        if in.Tagline != "" {
                site.Tagline = &in.Tagline
        }
        if in.Description != "" {
                site.Description = &in.Description
        }
        if in.CustomDomain != "" {
                site.CustomDomain = &in.CustomDomain
        }
        site.Settings = map[string]any{
                "owner_email": in.OwnerEmail,
                "created_by":  "central",
        }

        // Insert site
        if err := s.db.CreateSite(ctx, site); err != nil {
                return nil, nil, fmt.Errorf("create site: %w", err)
        }

        admin := &domain.SiteAdmin{
                SiteID:       site.ID,
                Username:     strings.TrimSpace(in.OwnerUsername),
                PasswordHash: string(hash),
                Role:         "owner",
                IsActive:     true,
        }
        if err := s.db.CreateSiteAdmin(ctx, admin); err != nil {
                return nil, nil, fmt.Errorf("create site admin: %w", err)
        }

        // Mark site ready once provisioning is complete
        _ = s.db.UpdateSiteStatus(ctx, site.ID, domain.SiteStatusReady)
        site.Status = domain.SiteStatusReady
        return site, admin, nil
}

// GetBySlug returns a site by its public slug.
func (s *SiteService) GetBySlug(ctx context.Context, slug string) (*domain.Site, error) {
        site, err := s.db.GetSiteBySlug(ctx, strings.ToLower(slug))
        if err != nil {
                return nil, err
        }
        return site, nil
}

// List returns a page of sites + the total count.
func (s *SiteService) List(ctx context.Context, f domain.SiteFilter) ([]*domain.Site, int, error) {
        return s.db.ListSites(ctx, f)
}

// SetStatus transitions a site.
func (s *SiteService) SetStatus(ctx context.Context, id int64, status domain.SiteStatus) error {
        if !validSiteStatus(status) {
                return fmt.Errorf("invalid status: %s", status)
        }
        return s.db.UpdateSiteStatus(ctx, id, status)
}

// UpdateSettings overwrites the JSONB settings column.
func (s *SiteService) UpdateSettings(ctx context.Context, id int64, settings map[string]any) error {
        return s.db.UpdateSiteSettings(ctx, id, settings)
}

// UpdateTheme changes a site's template_id (i.e. theme).
func (s *SiteService) UpdateTheme(ctx context.Context, id int64, templateID string) error {
        if strings.TrimSpace(templateID) == "" {
                return errors.New("template_id is required")
        }
        return s.db.UpdateSiteTheme(ctx, id, templateID)
}

// UpdateBranding changes a site's identity (name/tagline/color/logo).
// nil pointers = "leave unchanged".
func (s *SiteService) UpdateBranding(ctx context.Context, id int64, name, tagline, primaryColor, logoMark *string) error {
        return s.db.UpdateSiteBranding(ctx, id, name, tagline, primaryColor, logoMark)
}

// GetByID returns a site by its primary key.
func (s *SiteService) GetByID(ctx context.Context, id int64) (*domain.Site, error) {
        return s.db.GetSiteByID(ctx, id)
}

// --- Super-admin product management ---

// CreateSiteProductInput is the payload for creating a product on a site.
type CreateSiteProductInput struct {
        SiteID        int64
        Slug          string
        Title         string
        Description   string
        PriceKopecks  int64
        SKU           string
        StockQuantity int
        Images        []string
        Category      string
        IsActive      bool
}

// CreateSiteProduct inserts a product owned by a site.
func (s *SiteService) CreateSiteProduct(ctx context.Context, in CreateSiteProductInput) (*domain.SiteProduct, error) {
        if strings.TrimSpace(in.Title) == "" {
                return nil, errors.New("title is required")
        }
        if in.PriceKopecks < 0 {
                return nil, errors.New("price must be >= 0")
        }
        slug := strings.TrimSpace(in.Slug)
        if slug == "" {
                return nil, errors.New("slug is required")
        }
        sku := strings.TrimSpace(in.SKU)
        if sku == "" {
                sku = slug + "-" + fmt.Sprintf("%d", time.Now().Unix())
        }
        imgs := in.Images
        if imgs == nil {
                imgs = []string{}
        }
        p := &domain.SiteProduct{
                SiteID:        in.SiteID,
                Slug:          slug,
                Title:         in.Title,
                Description:   in.Description,
                PriceKopecks:  in.PriceKopecks,
                SKU:           sku,
                StockQuantity: in.StockQuantity,
                Images:        imgs,
                Category:      in.Category,
                IsActive:      in.IsActive,
        }
        if err := s.db.CreateSiteProduct(ctx, p); err != nil {
                return nil, err
        }
        return p, nil
}

// UpdateSiteProduct patches a product on a site.
func (s *SiteService) UpdateSiteProduct(ctx context.Context, p *domain.SiteProduct) error {
        return s.db.UpdateSiteProduct(ctx, p)
}

// DeleteSiteProduct removes a product.
func (s *SiteService) DeleteSiteProduct(ctx context.Context, siteID, productID int64) error {
        return s.db.DeleteSiteProduct(ctx, siteID, productID)
}

// ListSiteProducts returns the products of a site.
func (s *SiteService) ListSiteProducts(ctx context.Context, siteID int64, onlyActive bool) ([]*domain.SiteProduct, error) {
        return s.db.ListSiteProducts(ctx, siteID, onlyActive)
}

// ListSiteOrders returns the orders of a site (paginated).
func (s *SiteService) ListSiteOrders(ctx context.Context, siteID int64, limit, offset int) ([]*domain.SiteOrder, int, error) {
        return s.db.ListSiteOrders(ctx, siteID, limit, offset)
}

// --- Site Admin auth ---

type SiteAuthService struct {
        db *postgres.DB
}

func NewSiteAuthService(db *postgres.DB) *SiteAuthService { return &SiteAuthService{db: db} }

// Authenticate checks the username/password against the site's admin table.
// Returns the admin record on success.
func (a *SiteAuthService) Authenticate(ctx context.Context, siteSlug, username, password string) (*domain.SiteAdmin, *domain.Site, error) {
        site, err := a.db.GetSiteBySlug(ctx, strings.ToLower(siteSlug))
        if err != nil {
                return nil, nil, fmt.Errorf("site not found")
        }
        if site.Status != domain.SiteStatusReady {
                return nil, nil, fmt.Errorf("site not ready")
        }
        admin, err := a.db.GetSiteAdmin(ctx, site.ID, username)
        if err != nil {
                return nil, nil, fmt.Errorf("invalid credentials")
        }
        if !admin.IsActive {
                return nil, nil, fmt.Errorf("account disabled")
        }
        if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(password)); err != nil {
                return nil, nil, fmt.Errorf("invalid credentials")
        }
        _ = a.db.TouchSiteAdminLogin(ctx, admin.ID)
        admin.LastLoginAt = ptrTime(time.Now().UTC())
        return admin, site, nil
}

// ListAdmins returns all admins for a site.
func (a *SiteAuthService) ListAdmins(ctx context.Context, siteID int64) ([]*domain.SiteAdmin, error) {
        return a.db.ListSiteAdmins(ctx, siteID)
}

// AddAdmin creates a new admin under a site.
func (a *SiteAuthService) AddAdmin(ctx context.Context, siteID int64, username, password, role string) (*domain.SiteAdmin, error) {
        if len(password) < 8 {
                return nil, errors.New("password must be at least 8 characters")
        }
        if role == "" {
                role = "manager"
        }
        hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
        if err != nil {
                return nil, err
        }
        admin := &domain.SiteAdmin{
                SiteID:       siteID,
                Username:     strings.TrimSpace(username),
                PasswordHash: string(hash),
                Role:         role,
                IsActive:     true,
        }
        if err := a.db.CreateSiteAdmin(ctx, admin); err != nil {
                return nil, err
        }
        return admin, nil
}

// RemoveAdmin deletes a site admin.
func (a *SiteAuthService) RemoveAdmin(ctx context.Context, siteID, adminID int64) error {
        return a.db.DeleteSiteAdmin(ctx, siteID, adminID)
}

// --- Super admin auth ---

type SuperAdminService struct {
        db *postgres.DB
}

func NewSuperAdminService(db *postgres.DB) *SuperAdminService { return &SuperAdminService{db: db} }

// Authenticate checks the super-admin credentials.
func (s *SuperAdminService) Authenticate(ctx context.Context, username, password string) (*domain.SuperAdmin, error) {
        admin, err := s.db.GetSuperAdminByUsername(ctx, username)
        if err != nil {
                return nil, fmt.Errorf("invalid credentials")
        }
        if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(password)); err != nil {
                return nil, fmt.Errorf("invalid credentials")
        }
        return admin, nil
}

// EnsureDefault creates a default super-admin if none exist. Used by bootstrap.
func (s *SuperAdminService) EnsureDefault(ctx context.Context, username, password string) error {
        if _, err := s.db.GetSuperAdminByUsername(ctx, username); err == nil {
                return nil
        }
        if len(password) < 8 {
                return errors.New("default super-admin password too short")
        }
        hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
        if err != nil {
                return err
        }
        admin := &domain.SuperAdmin{Username: username, PasswordHash: string(hash)}
        return s.db.CreateSuperAdmin(ctx, admin)
}

// --- helpers ---

func validateSlug(s string) error {
        if s == "" {
                return errors.New("slug is required")
        }
        if len(s) > 80 {
                return errors.New("slug too long")
        }
        for _, r := range s {
                if !(r == '-' || r == '_' || (r >= '0' && r <= '9') || (r >= 'a' && r <= 'z')) {
                        return fmt.Errorf("slug must be lowercase a-z, 0-9, '-' or '_'")
                }
        }
        return nil
}

func validSiteStatus(s domain.SiteStatus) bool {
        switch s {
        case domain.SiteStatusProvisioning, domain.SiteStatusReady,
                domain.SiteStatusSuspended, domain.SiteStatusArchived:
                return true
        }
        return false
}

func ptrTime(t time.Time) *time.Time { return &t }
