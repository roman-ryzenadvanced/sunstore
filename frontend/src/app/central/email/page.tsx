"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Loader2, LogOut, Mail, Save, Trash2, Wand2 } from "lucide-react";

import {
  EmailConfigDTO, EmailConfigInput,
  getPlatformEmailConfig, upsertPlatformEmailConfig, testPlatformEmail,
} from "@/lib/multi-site/api";
import { useCentralAuthStore } from "@/lib/multi-site/store";
import { toast } from "@/components/toaster";

import "../central.css";

export default function PlatformEmailPage() {
  const router = useRouter();
  const token = useCentralAuthStore((s) => s.token);
  const clear = useCentralAuthStore((s) => s.clear);

  const [cfg, setCfg] = useState<EmailConfigDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState("");

  // Form state
  const [provider, setProvider] = useState<"smtp" | "gmail">("smtp");
  const [fromAddress, setFromAddress] = useState("");
  const [fromName, setFromName] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [useTLS, setUseTLS] = useState(true);
  const [useSSL, setUseSSL] = useState(false);
  const [replyTo, setReplyTo] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (token === null) {
      router.push("/central/login");
      return;
    }
    if (!token) return;
    setLoading(true);
    getPlatformEmailConfig(token)
      .then((c) => {
        setCfg(c);
        if (c.configured) {
          setProvider((c.provider as any) || "smtp");
          setFromAddress(c.from_address || "");
          setFromName(c.from_name || "");
          setSmtpHost(c.smtp_host || "");
          setSmtpPort(String(c.smtp_port || 587));
          setSmtpUsername(c.smtp_username || "");
          setUseTLS(c.use_tls ?? true);
          setUseSSL(c.use_ssl ?? false);
          setReplyTo(c.reply_to || "");
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function save() {
    if (!token) return;
    if (!fromAddress) { toast.error("Укажите From-адрес"); return; }
    setBusy(true);
    try {
      const input: EmailConfigInput = {
        provider,
        from_address: fromAddress,
        from_name: fromName,
        smtp_host: smtpHost,
        smtp_port: parseInt(smtpPort || "587", 10),
        smtp_username: smtpUsername,
        smtp_password: smtpPassword, // empty = keep existing
        use_tls: useTLS,
        use_ssl: useSSL,
        reply_to: replyTo,
        is_active: true
      };
      const updated = await upsertPlatformEmailConfig(token, input);
      setCfg(updated);
      setSmtpPassword("");
      toast.success("Платформенные email-настройки сохранены");
    } catch (e: any) {
      toast.error("Ошибка сохранения", e?.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!token) return;
    if (!testTo) { toast.error("Введите email получателя"); return; }
    setBusy(true);
    try {
      const r = await testPlatformEmail(token, testTo);
      if (r.ok) toast.success("Тестовое письмо отправлено", testTo);
      else toast.error("Ошибка отправки", r.error || "неизвестная");
    } finally {
      setBusy(false);
    }
  }

  function pickGmail() {
    setProvider("gmail");
    setSmtpHost("smtp.gmail.com");
    setSmtpPort("587");
    setUseTLS(true);
    setUseSSL(false);
  }
  function pickSMTP() {
    setProvider("smtp");
  }

  if (loading) {
    return (
      <main className="central-shell">
        <p style={{ color: "#888", padding: 24 }}>Загрузка email-настроек…</p>
      </main>
    );
  }

  return (
    <main className="central-shell">
      <header className="central-header">
        <div>
          <p className="central-header__eyebrow">Super Admin / Platform Email</p>
          <h1 className="central-header__title">Email-настройки платформы</h1>
          <p style={{ color: "#888", fontSize: 12, marginTop: 4 }}>
            Эти настройки используются по умолчанию для всех магазинов, у которых нет собственного переопределения.
          </p>
        </div>
        <div className="central-header__actions">
          <Link href="/central/dashboard" className="central-btn central-btn--ghost">
            <ArrowLeft size={14} /> К магазинам
          </Link>
          <button
            onClick={() => { clear(); toast.info("Сессия завершена"); router.push("/central/login"); }}
            className="central-btn central-btn--ghost"
          >
            <LogOut size={14} /> Выйти
          </button>
        </div>
      </header>

      <section style={{ padding: "0 24px 24px", display: "grid", gap: 16 }}>
        <div className="central-stat" style={{ padding: 20 }}>
          <p className="central-stat__label">Статус платформенной конфигурации</p>
          <p style={{ marginTop: 8, fontSize: 14 }}>
            {cfg?.configured
              ? <>✓ Настроено. From: <code>{cfg.from_address}</code> ({cfg.provider}). Последнее обновление: {cfg.updated_at ? new Date(cfg.updated_at).toLocaleString("ru-RU") : "—"}</>
              : <>ℹ️ Платформенная конфигурация ещё не задана. Все уведомления (подтверждения заказов, статусы) будут молча пропускаться, пока вы её не заполните.</>
            }
          </p>
        </div>

        <div className="central-stat" style={{ padding: 20 }}>
          <p className="central-stat__label">Тип аккаунта</p>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button
              onClick={pickSMTP}
              className={`central-btn ${provider === "smtp" ? "central-btn--primary" : "central-btn--ghost"}`}
            >
              Custom SMTP
            </button>
            <button
              onClick={pickGmail}
              className={`central-btn ${provider === "gmail" ? "central-btn--primary" : "central-btn--ghost"}`}
            >
              Gmail (App Password)
            </button>
          </div>
          {provider === "gmail" && (
            <div style={{ marginTop: 12, padding: 12, background: "#0a0a0a", borderRadius: 8, border: "1px solid #2a2a2a", fontSize: 12, color: "#aaa", lineHeight: 1.6 }}>
              <p style={{ margin: 0, fontWeight: 600, color: "#fff", marginBottom: 6 }}>Как получить Gmail App Password:</p>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li>Включите двухэтапную аутентификацию: <code>myaccount.google.com → Security → 2-Step Verification</code></li>
                <li>Откройте <code>Security → App passwords</code></li>
                <li>Создайте новый пароль для приложения «Mail / Other (Custom name: Sun.store)»</li>
                <li>Скопируйте 16-значный пароль и вставьте его в поле SMTP password ниже</li>
                <li>From-адрес = ваш Gmail (например, <code>your.shop@gmail.com</code>)</li>
              </ol>
            </div>
          )}
        </div>

        <div className="central-stat" style={{ padding: 20 }}>
          <p className="central-stat__label">Параметры SMTP</p>
          <div className="central-setup__fields" style={{ marginTop: 12 }}>
            <Field label="From (адрес отправителя)" value={fromAddress} onChange={setFromAddress} />
            <Field label="Имя отправителя" value={fromName} onChange={setFromName} placeholder="Sun.store Platform" />
            <Field label="SMTP host" value={smtpHost} onChange={setSmtpHost} placeholder={provider === "gmail" ? "smtp.gmail.com" : "smtp.yandex.ru"} />
            <Field label="SMTP port" value={smtpPort} onChange={setSmtpPort} type="number" />
            <Field label="SMTP username" value={smtpUsername} onChange={setSmtpUsername} placeholder={fromAddress || "user@gmail.com"} />
            <label className="central-setup__field">
              <span className="central-setup__field-label">SMTP password {cfg?.configured && "(оставьте пустым — текущий сохранён)"}</span>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder={cfg?.configured ? "••••••••" : provider === "gmail" ? "16-значный App Password" : "Пароль"}
                  className="central-setup__field-input"
                  style={{ paddingRight: 36 }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: 0, color: "#888", cursor: "pointer", padding: 4 }}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>
            <Field label="Reply-To (опц.)" value={replyTo} onChange={setReplyTo} />
            <label className="central-setup__field" style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#aaa", fontSize: 12 }}>
                <input type="checkbox" checked={useTLS} onChange={(e) => setUseTLS(e.target.checked)} /> STARTTLS (порт 587)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#aaa", fontSize: 12 }}>
                <input type="checkbox" checked={useSSL} onChange={(e) => setUseSSL(e.target.checked)} /> SSL (порт 465)
              </label>
            </label>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={save} disabled={busy} className="central-btn central-btn--primary">
              {busy ? <><Loader2 size={14} className="spin" /> Сохранение…</> : <><Save size={14} /> Сохранить конфигурацию</>}
            </button>
          </div>
        </div>

        <div className="central-stat" style={{ padding: 20 }}>
          <p className="central-stat__label">Тестовая отправка</p>
          <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            Отправим тестовое письмо на указанный адрес, чтобы убедиться, что SMTP-настройки корректны.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@example.com"
              className="central-setup__field-input"
              style={{ flex: "1 1 240px", marginBottom: 0 }}
              type="email"
            />
            <button onClick={sendTest} disabled={busy} className="central-btn central-btn--primary">
              <Wand2 size={14} /> Отправить тест
            </button>
          </div>
        </div>

        <div className="central-stat" style={{ padding: 20 }}>
          <p className="central-stat__label">Per-site override</p>
          <p style={{ fontSize: 13, color: "#aaa", marginTop: 8 }}>
            У каждого магазина можно задать собственную email-конфигурацию (вкладка «Email» внутри конкретного магазина),
            которая переопределяет платформенную. Это полезно, если разные магазины должны отправлять письма от разных
            адресов (например, <code>orders@sunvolt.ru</code> для солнечных панелей, <code>hello@boutique.ru</code> для ювелирки).
          </p>
        </div>
      </section>
    </main>
  );
}

function Field({
  label, value, onChange, placeholder, type
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="central-setup__field">
      <span className="central-setup__field-label">{label}</span>
      <input
        type={type || "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="central-setup__field-input"
      />
    </label>
  );
}
