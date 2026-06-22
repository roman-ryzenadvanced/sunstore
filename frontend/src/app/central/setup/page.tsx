"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, LogIn } from "lucide-react";

import { TEMPLATES } from "@/lib/templates/templates";
import {
  createCentralSite,
  persistMockSite,
  CentralSite
} from "@/lib/multi-site/api";
import { useCentralAuthStore } from "@/lib/multi-site/store";
import { toast } from "@/components/toaster";

import "../central.css";

export default function CentralSetupPage() {
  const router = useRouter();
  const token = useCentralAuthStore((s) => s.token);
  const [step, setStep] = useState<"niche" | "details" | "owner" | "review">(
    "niche"
  );
  // Default to solar-panels (the main theme) so the first shop the operator
  // creates is the flagship storefront unless they choose otherwise.
  const [templateId, setTemplateId] = useState<string>("solar-panels");
  const [name, setName] = useState("SunVolt");
  const [slug, setSlug] = useState("sunvolt");
  const [tagline, setTagline] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [ownerUsername, setOwnerUsername] = useState("owner");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const template = useMemo(
    () => TEMPLATES.find((t) => t.id === templateId),
    [templateId]
  );
  const filtered = useMemo(() => {
    if (!query) return TEMPLATES;
    const q = query.toLowerCase();
    return TEMPLATES.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.niche.toLowerCase().includes(q) ||
        t.id.includes(q)
    );
  }, [query]);

  function slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function next() {
    if (step === "niche") {
      if (!templateId) return setErr("Выберите шаблон");
      setErr(null);
      // Auto-fill name + slug from the selected template if the user hasn't customized them.
      if (template && (!name || name === "SunVolt" || name === TEMPLATES.find((t) => t.id === "solar-panels")?.branding.storeName)) {
        setName(template.branding.storeName);
      }
      if (template && (!slug || slug === "sunvolt")) {
        setSlug(slugify(template.branding.storeName));
      }
      setStep("details");
    } else if (step === "details") {
      if (!name) return setErr("Введите название магазина");
      if (!slug) return setErr("Введите slug");
      setErr(null);
      setStep("owner");
    } else if (step === "owner") {
      if (!ownerUsername || ownerUsername.length < 3)
        return setErr("Логин владельца ≥ 3 символов");
      if (!ownerEmail) return setErr("Email обязателен");
      if (ownerPassword.length < 8) return setErr("Пароль ≥ 8 символов");
      setErr(null);
      setStep("review");
    }
  }

  function back() {
    if (step === "details") setStep("niche");
    else if (step === "owner") setStep("details");
    else if (step === "review") setStep("owner");
  }

  async function provision() {
    if (!template) return;
    setBusy(true);
    setErr(null);
    const input = {
      slug,
      name,
      niche: template.niche,
      template_id: template.id,
      owner_email: ownerEmail,
      owner_username: ownerUsername,
      owner_password: ownerPassword,
      primary_color: primaryColor || template.colors.accent,
      logo_mark: template.branding.logoMark,
      tagline: tagline || template.branding.tagline,
      description: template.branding.description
    };
    try {
      if (!token) {
        const mock: CentralSite = {
          id: Date.now(),
          slug,
          name,
          niche: template.niche,
          template_id: template.id,
          status: "READY",
          primary_color: input.primary_color,
          logo_mark: input.logo_mark,
          tagline: input.tagline,
          description: input.description,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        persistMockSite(mock);
        toast.success("Магазин создан", `/${slug} — демо-режим`);
        router.push(`/central/dashboard?created=${slug}`);
        return;
      }
      await createCentralSite(token, input);
      toast.success("Магазин запущен", name);
      window.location.href = "/central/dashboard?created=" + slug;
    } catch (e: any) {
      const msg = e?.message || "Ошибка создания";
      setErr(msg);
      toast.error("Ошибка", msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="central-shell">
      <header className="central-header">
        <div>
          <p className="central-header__eyebrow">Sun.store / Setup</p>
          <h1 className="central-header__title">Создание магазина</h1>
        </div>
        <Link href="/central/dashboard" className="central-btn central-btn--ghost">
          ← Назад
        </Link>
      </header>

      <section className="central-setup">
        <Steps step={step} />
        {err && <p className="central-setup__error">{err}</p>}

        {step === "niche" && (
          <>
            <p className="central-setup__hint">
              Шаг 1 — выберите шаблон ниши. Любую тему можно потом кастомизировать.
            </p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск: ювелирка, спорт, книги…"
              className="central-setup__search"
            />
            <div className="central-setup__templates">
              {filtered.map((t) => {
                const selected = templateId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    className="central-setup__template"
                    style={{
                      background: selected ? t.colors.accent : t.colors.background,
                      color: selected ? t.colors.accentText : t.colors.text,
                      borderColor: selected ? t.colors.accent : t.colors.border
                    }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 6 }}>
                      {t.branding.logoMark}
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                      {t.name}
                    </p>
                    <p style={{ fontSize: 12, opacity: 0.7, margin: "4px 0 0" }}>
                      {t.niche}
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === "details" && template && (
          <>
            <p className="central-setup__hint">
              Шаг 2 — базовые данные магазина.
            </p>
            <div className="central-setup__fields">
              <Field
                label="Название магазина"
                value={name}
                onChange={(v) => {
                  setName(v);
                  if (!slug) setSlug(slugify(v));
                }}
              />
              <Field
                label="Slug (URL)"
                value={slug}
                onChange={setSlug}
                hint="латиница, без пробелов"
              />
              <Field
                label="Слоган (опц.)"
                value={tagline}
                onChange={setTagline}
                placeholder={template.branding.tagline}
              />
              <Field
                label="Главный цвет (HEX, опц.)"
                value={primaryColor}
                onChange={setPrimaryColor}
                placeholder={template.colors.accent}
              />
            </div>
          </>
        )}

        {step === "owner" && (
          <>
            <p className="central-setup__hint">
              Шаг 3 — данные первого владельца магазина.
            </p>
            <div className="central-setup__fields">
              <Field
                label="Логин владельца"
                value={ownerUsername}
                onChange={setOwnerUsername}
              />
              <Field
                label="Email"
                value={ownerEmail}
                onChange={setOwnerEmail}
                type="email"
              />
              <Field
                label="Пароль (≥ 8 символов)"
                value={ownerPassword}
                onChange={setOwnerPassword}
                type="password"
              />
            </div>
          </>
        )}

        {step === "review" && template && (
          <>
            <p className="central-setup__hint">
              Шаг 4 — проверка и запуск.
            </p>
            <div className="central-setup__review">
              <p className="central-setup__review-eyebrow">Шаблон</p>
              <p className="central-setup__review-value">
                {template.name} ({template.niche})
              </p>
              <p className="central-setup__review-eyebrow">Магазин</p>
              <p className="central-setup__review-value">
                {name} — /{slug}
              </p>
              <p className="central-setup__review-eyebrow">Владелец</p>
              <p className="central-setup__review-value">
                {ownerUsername} ({ownerEmail})
              </p>
            </div>
          </>
        )}

        <div className="central-setup__actions">
          {step !== "niche" && (
            <button
              onClick={back}
              className="central-btn central-btn--ghost"
            >
              ← Назад
            </button>
          )}
          {step !== "review" ? (
            <button
              onClick={next}
              className="central-btn central-btn--primary"
            >
              Далее →
            </button>
          ) : (
            <button
              onClick={provision}
              disabled={busy}
              className="central-btn central-btn--primary"
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="spin" /> Создаём…
                </>
              ) : (
                <>🚀 Запустить магазин</>
              )}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
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
      {hint && <span className="central-setup__field-hint">{hint}</span>}
    </label>
  );
}

function Steps({
  step
}: {
  step: "niche" | "details" | "owner" | "review";
}) {
  const order: Array<typeof step> = ["niche", "details", "owner", "review"];
  const labels = ["Ниша", "Данные", "Владелец", "Запуск"];
  return (
    <div className="central-setup__steps">
      {order.map((s, i) => {
        const active = s === step;
        const done = order.indexOf(step) > i;
        return (
          <div
            key={s}
            className={`central-setup__step ${
              active
                ? "central-setup__step--active"
                : done
                ? "central-setup__step--done"
                : ""
            }`}
          >
            <div className="central-setup__step-bar" />
            <p className="central-setup__step-label">{labels[i]}</p>
          </div>
        );
      })}
    </div>
  );
}
