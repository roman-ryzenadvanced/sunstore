"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Mail, Plus, RefreshCw, Settings } from "lucide-react";

import {
  listCentralSites,
  setSiteStatus,
  CentralSite
} from "@/lib/multi-site/api";
import { useCentralAuthStore } from "@/lib/multi-site/store";
import { TEMPLATES } from "@/lib/templates/templates";
import { toast } from "@/components/toaster";

import "../central.css";

export default function CentralDashboardPage() {
  const router = useRouter();
  const token = useCentralAuthStore((s) => s.token);
  const clear = useCentralAuthStore((s) => s.clear);
  const [sites, setSites] = useState<CentralSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (token === null) {
      router.push("/central/login");
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const list = await listCentralSites(token, {
        search: filter || undefined
      });
      setSites(list);
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(() => {
    return {
      total: sites.length,
      ready: sites.filter((s) => s.status === "READY").length,
      suspended: sites.filter((s) => s.status === "SUSPENDED").length,
      provisioning: sites.filter((s) => s.status === "PROVISIONING").length
    };
  }, [sites]);

  async function toggleStatus(s: CentralSite) {
    if (!token) return;
    const next: CentralSite["status"] =
      s.status === "READY" ? "SUSPENDED" : "READY";
    try {
      await setSiteStatus(token, s.id, next);
      toast.success(
        next === "READY" ? "Магазин активирован" : "Магазин приостановлен",
        s.name
      );
      await refresh();
    } catch (e: any) {
      toast.error("Ошибка", e?.message || "Не удалось изменить статус");
    }
  }

  return (
    <main className="central-shell">
      <header className="central-header">
        <div>
          <p className="central-header__eyebrow">Sun.store Super Admin</p>
          <h1 className="central-header__title">Единая супер-админ панель</h1>
          <p style={{ color: "#888", fontSize: 12, marginTop: 4 }}>
            Управляйте всеми магазинами, их темами, товарами, заказами и email-настройками отсюда.
          </p>
        </div>
        <div className="central-header__actions">
          <Link href="/central/email" className="central-btn central-btn--ghost">
            <Mail size={14} /> Email платформы
          </Link>
          <Link href="/central/setup" className="central-btn central-btn--primary">
            <Plus size={14} /> Создать магазин
          </Link>
          <button
            onClick={() => {
              clear();
              toast.info("Сессия завершена");
              router.push("/central/login");
            }}
            className="central-btn central-btn--ghost"
          >
            <LogOut size={14} /> Выйти
          </button>
        </div>
      </header>

      <section className="central-stats">
        {[
          { label: "Всего сайтов", v: counts.total },
          { label: "Активных", v: counts.ready },
          { label: "Provisioning", v: counts.provisioning },
          { label: "Suspended", v: counts.suspended }
        ].map((c) => (
          <div key={c.label} className="central-stat">
            <p className="central-stat__label">{c.label}</p>
            <p className="central-stat__value">{c.v}</p>
          </div>
        ))}
      </section>

      <section style={{ padding: "0 24px 24px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") refresh();
            }}
            placeholder="Поиск по имени или slug…"
            className="central-search"
            style={{ marginBottom: 0 }}
          />
          <button
            onClick={refresh}
            disabled={loading}
            className="central-btn central-btn--ghost"
            aria-label="Обновить список"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
          </button>
        </div>

        {loading ? (
          <p style={{ color: "#888", padding: 24 }}>Загрузка…</p>
        ) : sites.length === 0 ? (
          <div className="central-empty">
            <p className="central-empty__text">Пока нет магазинов.</p>
            <Link
              href="/central/setup"
              className="central-btn central-btn--primary"
              style={{ marginTop: 12, display: "inline-flex" }}
            >
              <Plus size={14} /> Создать первый магазин
            </Link>
          </div>
        ) : (
          <div className="central-sites-grid">
            {sites.map((s) => {
              const template = TEMPLATES.find((t) => t.id === s.template_id);
              return (
                <article key={s.id} className="central-site-card">
                  <div className="central-site-card__head">
                    <div>
                      <p className="central-site-card__name">
                        <span style={{ marginRight: 8 }}>{s.logo_mark || template?.branding?.logoMark}</span>
                        {s.name}
                      </p>
                      <p className="central-site-card__meta">
                        slug: {s.slug} · theme: {s.template_id}
                      </p>
                    </div>
                    <span
                      className={`central-status-pill central-status-pill--${s.status.toLowerCase()}`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <p className="central-site-card__tagline">
                    {s.tagline || template?.branding.tagline || "—"}
                  </p>
                  <div className="central-site-card__cats">
                    {template?.categories.slice(0, 5).map((c) => (
                      <span key={c.id} className="central-site-card__cat">
                        {c.name}
                      </span>
                    ))}
                  </div>
                  <div className="central-site-card__actions">
                    <Link
                      href={`/central/sites/${s.id}`}
                      className="central-site-card__action central-site-card__action--primary"
                    >
                      <Settings size={12} /> Управлять
                    </Link>
                    <Link
                      href={`/sites/${s.slug}`}
                      target="_blank"
                      className="central-site-card__action"
                    >
                      Открыть витрину
                    </Link>
                    <button
                      onClick={() => toggleStatus(s)}
                      className="central-site-card__action"
                    >
                      {s.status === "READY" ? "Suspend" : "Activate"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
