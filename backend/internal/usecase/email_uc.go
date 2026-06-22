// Package usecase — email sending via SMTP / Gmail app password.
package usecase

import (
        "context"
        "crypto/tls"
        "errors"
        "fmt"
        "net"
        "net/smtp"
        "strings"
        "time"

        "sunstore/internal/domain"
        "sunstore/internal/repository/postgres"
)

// EmailUseCase sends transactional email using the platform or per-site
// email config. Every send is logged to the email_outbox for auditability.
type EmailUseCase struct {
        db *postgres.DB
}

// NewEmailUseCase constructs an EmailUseCase.
func NewEmailUseCase(db *postgres.DB) *EmailUseCase { return &EmailUseCase{db: db} }

// DB exposes the underlying DB so handlers can call the email config
// repository functions without re-wiring a separate repo abstraction.
func (uc *EmailUseCase) DB() *postgres.DB { return uc.db }

// UpsertPlatformConfig stores the platform-wide email config.
func (uc *EmailUseCase) UpsertPlatformConfig(ctx context.Context, c *domain.EmailConfig) error {
        return uc.db.UpsertPlatformEmailConfig(ctx, c)
}

// UpsertSiteConfig stores (or updates) a per-site override.
func (uc *EmailUseCase) UpsertSiteConfig(ctx context.Context, c *domain.EmailConfig) error {
        return uc.db.UpsertSiteEmailConfig(ctx, c)
}

// GetPlatformConfig returns the platform-wide config.
func (uc *EmailUseCase) GetPlatformConfig(ctx context.Context) (*domain.EmailConfig, error) {
        return uc.db.GetPlatformEmailConfig(ctx)
}

// GetSiteConfig returns the per-site override (ErrNotFound if none).
func (uc *EmailUseCase) GetSiteConfig(ctx context.Context, siteID int64) (*domain.EmailConfig, error) {
        return uc.db.GetSiteEmailConfig(ctx, siteID)
}

// DeleteSiteConfig removes the per-site override.
func (uc *EmailUseCase) DeleteSiteConfig(ctx context.Context, siteID int64) error {
        return uc.db.DeleteSiteEmailConfig(ctx, siteID)
}

// ListOutbox returns the most recent N outbox entries (filtered by site if siteID > 0).
func (uc *EmailUseCase) ListOutbox(ctx context.Context, siteID int64, limit int) ([]*domain.EmailOutboxEntry, error) {
        return uc.db.ListEmailOutbox(ctx, siteID, limit)
}

// SendInput is the payload accepted by Send.
type SendInput struct {
        SiteID    *int64 // nil = platform-level (uses platform config)
        To        string
        Subject   string
        BodyHTML  string
        BodyText  string // optional plaintext fallback
}

// Send resolves the effective email config for the given site (or platform
// default) and sends an email. Always logs the attempt to the outbox.
func (uc *EmailUseCase) Send(ctx context.Context, in SendInput) error {
        if strings.TrimSpace(in.To) == "" {
                return errors.New("email: recipient is required")
        }

        var cfg *domain.EmailConfig
        var err error
        if in.SiteID != nil {
                cfg, err = uc.db.GetEffectiveEmailConfig(ctx, *in.SiteID)
        } else {
                cfg, err = uc.db.GetPlatformEmailConfig(ctx)
        }
        if err != nil {
                return fmt.Errorf("email: no effective config: %w", err)
        }
        if !cfg.IsActive {
                return errors.New("email: active config not found")
        }

        // Apply Gmail defaults if provider is gmail.
        host := cfg.SMTPHost
        port := cfg.SMTPPort
        user := cfg.SMTPUsername
        pass := cfg.SMTPPassword
        if cfg.Provider == domain.EmailProviderGmail {
                if host == "" {
                        host = "smtp.gmail.com"
                }
                if port == 0 {
                        port = 587
                }
                if user == "" {
                        user = cfg.FromAddress
                }
        }
        if host == "" || port == 0 {
                return errors.New("email: smtp host/port not configured")
        }

        entry := &domain.EmailOutboxEntry{
                SiteID:    in.SiteID,
                ConfigID:  &cfg.ID,
                ToAddress: in.To,
                Subject:   in.Subject,
                BodyHTML:  in.BodyHTML,
                Status:    "PENDING",
        }

        sendErr := uc.deliver(host, port, user, pass, cfg, in)
        if sendErr != nil {
                entry.Status = "FAILED"
                entry.Error = sendErr.Error()
                _ = uc.db.InsertEmailOutboxEntry(ctx, entry)
                return sendErr
        }

        now := time.Now().UTC()
        entry.Status = "SENT"
        entry.SentAt = &now
        _ = uc.db.InsertEmailOutboxEntry(ctx, entry)
        return nil
}

// deliver opens the SMTP connection and sends a single message.
func (uc *EmailUseCase) deliver(host string, port int, user, pass string, cfg *domain.EmailConfig, in SendInput) error {
        addr := net.JoinHostPort(host, fmt.Sprintf("%d", port))
        from := cfg.FromAddress
        fromName := cfg.FromName
        replyTo := cfg.ReplyTo
        if replyTo == "" {
                replyTo = from
        }

        msg := buildMIMEMessage(from, fromName, replyTo, in.To, in.Subject, in.BodyHTML, in.BodyText)

        // Use SSL for port 465 (implicit TLS), STARTTLS for everything else.
        if cfg.UseSSL || port == 465 {
                return deliverSSL(addr, host, user, pass, from, in.To, msg)
        }
        return deliverSTARTTLS(addr, host, user, pass, from, in.To, msg, cfg.UseTLS)
}

func deliverSTARTTLS(addr, host, user, pass, from, to string, msg []byte, useTLS bool) error {
        conn, err := net.DialTimeout("tcp", addr, 15*time.Second)
        if err != nil {
                return fmt.Errorf("dial smtp: %w", err)
        }
        c, err := smtp.NewClient(conn, host)
        if err != nil {
                _ = conn.Close()
                return fmt.Errorf("smtp new client: %w", err)
        }
        defer c.Close()

        if err := c.Hello("sunstore.local"); err != nil {
                return fmt.Errorf("smtp hello: %w", err)
        }
        if useTLS {
                if ok, _ := c.Extension("STARTTLS"); ok {
                        if err := c.StartTLS(&tls.Config{ServerName: host}); err != nil {
                                return fmt.Errorf("smtp starttls: %w", err)
                        }
                }
        }
        if user != "" && pass != "" {
                auth := smtp.PlainAuth("", user, pass, host)
                if ok, _ := c.Extension("AUTH"); ok {
                        if err := c.Auth(auth); err != nil {
                                return fmt.Errorf("smtp auth: %w", err)
                        }
                }
        }
        if err := c.Mail(from); err != nil {
                return fmt.Errorf("smtp MAIL FROM: %w", err)
        }
        if err := c.Rcpt(to); err != nil {
                return fmt.Errorf("smtp RCPT TO: %w", err)
        }
        w, err := c.Data()
        if err != nil {
                return fmt.Errorf("smtp DATA: %w", err)
        }
        if _, err := w.Write(msg); err != nil {
                return fmt.Errorf("smtp write body: %w", err)
        }
        if err := w.Close(); err != nil {
                return fmt.Errorf("smtp close body: %w", err)
        }
        return c.Quit()
}

func deliverSSL(addr, host, user, pass, from, to string, msg []byte) error {
        tlsCfg := &tls.Config{ServerName: host}
        conn, err := tls.Dial("tcp", addr, tlsCfg)
        if err != nil {
                return fmt.Errorf("tls dial smtp: %w", err)
        }
        defer conn.Close()
        c, err := smtp.NewClient(conn, host)
        if err != nil {
                return fmt.Errorf("smtp new client (ssl): %w", err)
        }
        defer c.Close()
        if err := c.Hello("sunstore.local"); err != nil {
                return fmt.Errorf("smtp hello (ssl): %w", err)
        }
        if user != "" && pass != "" {
                auth := smtp.PlainAuth("", user, pass, host)
                if ok, _ := c.Extension("AUTH"); ok {
                        if err := c.Auth(auth); err != nil {
                                return fmt.Errorf("smtp auth (ssl): %w", err)
                        }
                }
        }
        if err := c.Mail(from); err != nil {
                return fmt.Errorf("smtp MAIL FROM (ssl): %w", err)
        }
        if err := c.Rcpt(to); err != nil {
                return fmt.Errorf("smtp RCPT TO (ssl): %w", err)
        }
        w, err := c.Data()
        if err != nil {
                return fmt.Errorf("smtp DATA (ssl): %w", err)
        }
        if _, err := w.Write(msg); err != nil {
                return fmt.Errorf("smtp write body (ssl): %w", err)
        }
        if err := w.Close(); err != nil {
                return fmt.Errorf("smtp close body (ssl): %w", err)
        }
        return c.Quit()
}

// buildMIMEMessage assembles a multipart MIME message with HTML + plaintext.
func buildMIMEMessage(from, fromName, replyTo, to, subject, html, text string) []byte {
        if text == "" {
                // Cheap HTML-to-text fallback: strip tags.
                text = strings.ReplaceAll(html, "<br>", "\n")
                text = strings.ReplaceAll(text, "<br/>", "\n")
                text = strings.ReplaceAll(text, "</p>", "\n\n")
                text = stripHTMLTags(text)
        }
        boundary := "----=_SunstoreBoundary_" + fmt.Sprintf("%d", time.Now().UnixNano())
        var b strings.Builder
        fmt.Fprintf(&b, "From: %s <%s>\r\n", encodeHeader(fromName), from)
        fmt.Fprintf(&b, "To: %s\r\n", to)
        fmt.Fprintf(&b, "Reply-To: %s\r\n", replyTo)
        fmt.Fprintf(&b, "Subject: %s\r\n", encodeHeader(subject))
        fmt.Fprintf(&b, "MIME-Version: 1.0\r\n")
        fmt.Fprintf(&b, "Content-Type: multipart/alternative; boundary=\"%s\"\r\n", boundary)
        fmt.Fprintf(&b, "Date: %s\r\n", time.Now().UTC().Format(time.RFC1123Z))
        b.WriteString("\r\n")
        fmt.Fprintf(&b, "--%s\r\n", boundary)
        b.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
        b.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
        b.WriteString(text)
        b.WriteString("\r\n\r\n")
        fmt.Fprintf(&b, "--%s\r\n", boundary)
        b.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
        b.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
        b.WriteString(html)
        b.WriteString("\r\n\r\n")
        fmt.Fprintf(&b, "--%s--\r\n", boundary)
        return []byte(b.String())
}

// encodeHeader encodes UTF-8 headers using RFC 2047 B-encoding so Outlook
// and Gmail display Cyrillic subjects correctly.
func encodeHeader(s string) string {
        if isASCII(s) {
                return s
        }
        return "=?UTF-8?B?" + b64Encode(s) + "?="
}

func isASCII(s string) bool {
        for _, r := range s {
                if r > 127 {
                        return false
                }
        }
        return true
}

func b64Encode(s string) string {
        const tbl = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
        src := []byte(s)
        out := make([]byte, 0, ((len(src)+2)/3)*4)
        for i := 0; i < len(src); i += 3 {
                var n uint32
                var cnt int
                for j := 0; j < 3; j++ {
                        if i+j < len(src) {
                                n |= uint32(src[i+j]) << (16 - 8*j)
                                cnt++
                        }
                }
                out = append(out, tbl[(n>>18)&63])
                out = append(out, tbl[(n>>12)&63])
                if cnt > 1 {
                        out = append(out, tbl[(n>>6)&63])
                } else {
                        out = append(out, '=')
                }
                if cnt > 2 {
                        out = append(out, tbl[n&63])
                } else {
                        out = append(out, '=')
                }
        }
        return string(out)
}

func stripHTMLTags(s string) string {
        var out strings.Builder
        inTag := false
        for _, r := range s {
                switch r {
                case '<':
                        inTag = true
                case '>':
                        inTag = false
                default:
                        if !inTag {
                                out.WriteRune(r)
                        }
                }
        }
        return out.String()
}

// --- Templates for the most common transactional emails ---

// OrderConfirmationHTML returns an HTML body for an order-confirmation email.
func OrderConfirmationHTML(storeName, orderID, customerName string, items []OrderConfirmationItem, totalKopecks int64) string {
        var rows strings.Builder
        for _, it := range items {
                fmt.Fprintf(&rows,
                        `<tr><td style="padding:8px;border-bottom:1px solid #eee">%s</td>`+
                                `<td style="padding:8px;border-bottom:1px solid #eee;text-align:center">%d</td>`+
                                `<td style="padding:8px;border-bottom:1px solid #eee;text-align:right">%s</td></tr>`,
                        escapeHTML(it.Title), it.Quantity, formatKopecks(it.PriceKopecks))
        }
        return fmt.Sprintf(`<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#f6f6f6;margin:0;padding:20px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
  <div style="background:#0a0a0a;color:#00ff88;padding:24px">
    <h1 style="margin:0;font-size:20px">%s — заказ подтверждён</h1>
  </div>
  <div style="padding:24px">
    <p>Здравствуйте, %s!</p>
    <p>Ваш заказ <strong>#%s</strong> принят. Мы свяжемся с вами в случае вопросов по доставке.</p>
    <table style="width:100%%;border-collapse:collapse;margin:16px 0">
      <thead><tr style="background:#fafafa">
        <th style="padding:8px;text-align:left">Товар</th>
        <th style="padding:8px;text-align:center">Кол-во</th>
        <th style="padding:8px;text-align:right">Цена</th>
      </tr></thead>
      <tbody>%s</tbody>
      <tfoot><tr>
        <td colspan="2" style="padding:12px;text-align:right;font-weight:bold">Итого:</td>
        <td style="padding:12px;text-align:right;font-weight:bold">%s</td>
      </tr></tfoot>
    </table>
    <p style="color:#888;font-size:12px">Это письмо отправлено автоматически, отвечать не нужно.</p>
  </div>
</div></body></html>`,
                escapeHTML(storeName), escapeHTML(customerName), escapeHTML(orderID),
                rows.String(), formatKopecks(totalKopecks))
}

// OrderConfirmationItem is a single line item rendered in the confirmation email.
type OrderConfirmationItem struct {
        Title         string
        Quantity      int
        PriceKopecks  int64
}

func formatKopecks(k int64) string {
        rubles := k / 100
        kopecks := k % 100
        return fmt.Sprintf("%d,%02d ₽", rubles, kopecks)
}

func escapeHTML(s string) string {
        s = strings.ReplaceAll(s, "&", "&amp;")
        s = strings.ReplaceAll(s, "<", "&lt;")
        s = strings.ReplaceAll(s, ">", "&gt;")
        s = strings.ReplaceAll(s, `"`, "&quot;")
        return s
}
