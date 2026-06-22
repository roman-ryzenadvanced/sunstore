"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Box, Eye, EyeOff, Loader2, LogOut, Mail, PackageOpen,
  Palette, Plus, RefreshCw, Save, Settings, ShoppingBag, Store, Trash2, Wand2
} from "lucide-react";

import {
  CentralSite, ShopProduct, ShopOrder,
  getShop, listShopProducts, listShopOrders,
  updateShopTheme, updateShopBranding,
  createShopProduct, updateShopProduct, deleteShopProduct,
  getSiteEmailConfig, upsertSiteEmailConfig, deleteSiteEmailConfig, testSiteEmail,
  EmailConfigDTO, EmailConfigInput
} from "@/lib/multi-site/api";
import { useCentralAuthStore } from "@/lib/multi-site/store";
import { TEMPLATES } from "@/lib/templates/templates";
import { toast } from "@/components/toaster";
import { formatPrice, slugify } from "@/lib/format";

import "../../central.css";

type Tab = "overview" | "theme" | "products" | "orders" | "email";

export default function ShopDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params?.id);
  const token = useCentralAuthStore((s) => s.token);
  const clear = useCentralAuthStore((s) => s.clear);

  const [site, setSite] = useState<CentralSite | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);

  useEffect(() => {
    if (token === null) {
      router.push("/central/login");
      return;
    }
    if (!id) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  async function refresh() {
    if (!token || !id) return;
    setLoading(true);
    try {
      const s = await getShop(token, id);
      setSite(s);
      // If backend unreachable, hydrate from localStorage mock.
      if (!s) {
        const raw = window.localStorage.getItem("sunstore-central-sites");
        if (raw) {
          try {
            const list: CentralSite[] = JSON.parse(raw);
            const found = list.find((x) => x.id === id);
            if (found) setSite(found);
          } catch { /* ignore */ }
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    if (!token || !id) return;
    setProductsLoaded(false);
    try {
      // Try backend first.
      const list = await listShopProducts(token, id);
      if (list.length > 0) {
        setProducts(list);
        return;
      }
      // Fall back to localStorage (per-site products saved by storefront).
      const raw = window.localStorage.getItem(`sunstore-site-products-${site?.slug || ""}`);
      if (raw) {
        try { setProducts(JSON.parse(raw)); return; } catch { /* ignore */ }
      }
      // If site has a template, seed from template products.
      const tpl = TEMPLATES.find((t) => t.id === site?.template_id);
      if (tpl) {
        const seeded: ShopProduct[] = tpl.products.map((p) => ({
          id: Number(p.id.replace(/\D/g, "") || Date.now()),
          site_id: id,
          slug: p.slug,
          title: p.title,
          description: p.description,
          price_kopecks: p.price_kopecks,
          sku: p.sku,
          stock_quantity: p.stock_quantity,
          images: p.images,
          category: p.category_id,
          is_active: p.is_active,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        setProducts(seeded);
        window.localStorage.setItem(
          `sunstore-site-products-${site?.slug || ""}`,
          JSON.stringify(seeded)
        );
      }
    } finally {
      setProductsLoaded(true);
    }
  }

  async function loadOrders() {
    if (!token || !id) return;
    setOrdersLoaded(false);
    try {
      const list = await listShopOrders(token, id);
      setOrders(list);
    } finally {
      setOrdersLoaded(true);
    }
  }

  function switchTab(next: Tab) {
    setTab(next);
    if (next === "products" && !productsLoaded) loadProducts();
    if (next === "orders" && !ordersLoaded) loadOrders();
  }

  if (loading) {
    return (
      <main className="central-shell">
        <p style={{ color: "#888", padding: 24 }}>Загрузка магазина…</p>
      </main>
    );
  }

  if (!site) {
    return (
      <main className="central-shell">
        <div className="central-empty" style={{ margin: 24 }}>
          <PackageOpen size={32} style={{ opacity: 0.4 }} />
          <p className="central-empty__text">Магазин не найден.</p>
          <Link href="/central/dashboard" className="central-btn central-btn--ghost" style={{ marginTop: 12 }}>
            ← К списку магазинов
          </Link>
        </div>
      </main>
    );
  }

  const template = TEMPLATES.find((t) => t.id === site.template_id);

  return (
    <main className="central-shell">
      <header className="central-header">
        <div>
          <p className="central-header__eyebrow">Super Admin / Shop</p>
          <h1 className="central-header__title">{site.name}</h1>
          <p className="central-site-card__meta" style={{ marginTop: 4 }}>
            slug: {site.slug} · niche: {site.niche} · theme: {site.template_id}
          </p>
        </div>
        <div className="central-header__actions">
          <Link href={`/sites/${site.slug}`} target="_blank" className="central-btn central-btn--ghost">
            <Store size={14} /> Открыть витрину
          </Link>
          <Link href="/central/dashboard" className="central-btn central-btn--ghost">
            <ArrowLeft size={14} /> Все магазины
          </Link>
          <button
            onClick={() => { clear(); toast.info("Сессия завершена"); router.push("/central/login"); }}
            className="central-btn central-btn--ghost"
          >
            <LogOut size={14} /> Выйти
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="central-tabs" aria-label="Разделы магазина">
        {([
          ["overview", "Обзор", Settings],
          ["theme", "Тема", Palette],
          ["products", "Товары", Box],
          ["orders", "Заказы", ShoppingBag],
          ["email", "Email", Mail]
        ] as [Tab, string, any][]).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={`central-tab ${tab === key ? "central-tab--active" : ""}`}
            aria-current={tab === key}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </nav>

      <section style={{ padding: "0 24px 24px" }}>
        {tab === "overview" && (
          <OverviewTab site={site} template={template} />
        )}
        {tab === "theme" && (
          <ThemeTab site={site} template={template} onUpdated={refresh} />
        )}
        {tab === "products" && (
          <ProductsTab
            site={site}
            products={products}
            loaded={productsLoaded}
            onChange={loadProducts}
          />
        )}
        {tab === "orders" && (
          <OrdersTab orders={orders} loaded={ordersLoaded} />
        )}
        {tab === "email" && (
          <EmailTab siteId={site.id} />
        )}
      </section>
    </main>
  );
}

// ===========================================================================
// Overview tab
// ===========================================================================

function OverviewTab({ site, template }: { site: CentralSite; template?: any }) {
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
      <div className="central-stat" style={{ padding: 20 }}>
        <p className="central-stat__label">Бренд</p>
        <p className="central-stat__value" style={{ fontSize: 22 }}>{site.name}</p>
        <p style={{ color: "#888", fontSize: 12, marginTop: 8 }}>slug: {site.slug}</p>
        <p style={{ color: "#888", fontSize: 12 }}>niche: {site.niche}</p>
        <p style={{ color: "#888", fontSize: 12 }}>status: <span className={`central-status-pill central-status-pill--${site.status.toLowerCase()}`}>{site.status}</span></p>
      </div>
      <div className="central-stat" style={{ padding: 20 }}>
        <p className="central-stat__label">Тема</p>
        <p className="central-stat__value" style={{ fontSize: 22 }}>{template?.name || site.template_id}</p>
        <p style={{ color: "#888", fontSize: 12, marginTop: 8 }}>{template?.niche || "—"}</p>
        <p style={{ color: "#888", fontSize: 12 }}>accent: <span style={{ display: "inline-block", width: 12, height: 12, background: site.primary_color || template?.colors?.accent, verticalAlign: "middle", borderRadius: 2, marginLeft: 4 }} /> {site.primary_color || template?.colors?.accent}</p>
      </div>
      <div className="central-stat" style={{ padding: 20, gridColumn: "1 / -1" }}>
        <p className="central-stat__label">Тэглайн</p>
        <p style={{ marginTop: 8, fontSize: 16 }}>{site.tagline || template?.branding?.tagline || "—"}</p>
        {site.description && (
          <p style={{ marginTop: 8, color: "#aaa", fontSize: 13 }}>{site.description}</p>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Theme tab — change theme + branding
// ===========================================================================

function ThemeTab({
  site, template, onUpdated
}: {
  site: CentralSite;
  template?: any;
  onUpdated: () => void;
}) {
  const token = useCentralAuthStore((s) => s.token);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(site.name);
  const [tagline, setTagline] = useState(site.tagline || "");
  const [primaryColor, setPrimaryColor] = useState(site.primary_color || "");
  const [logoMark, setLogoMark] = useState(site.logo_mark || "");

  async function applyTheme(tplId: string) {
    if (!token) return;
    setBusy(true);
    try {
      await updateShopTheme(token, site.id, tplId);
      toast.success("Тема применена", tplId);
      onUpdated();
    } catch (e: any) {
      toast.error("Ошибка смены темы", e?.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveBranding() {
    if (!token) return;
    setBusy(true);
    try {
      await updateShopBranding(token, site.id, {
        name, tagline, primary_color: primaryColor, logo_mark: logoMark
      });
      // Also update the localStorage mock so the change is visible without backend.
      const raw = window.localStorage.getItem("sunstore-central-sites");
      if (raw) {
        try {
          const list: CentralSite[] = JSON.parse(raw);
          const next = list.map((s) =>
            s.id === site.id ? { ...s, name, tagline, primary_color: primaryColor, logo_mark: logoMark } : s
          );
          window.localStorage.setItem("sunstore-central-sites", JSON.stringify(next));
        } catch { /* ignore */ }
      }
      toast.success("Брендинг сохранён");
      onUpdated();
    } catch (e: any) {
      toast.error("Ошибка сохранения", e?.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div>
        <p className="central-setup__review-eyebrow" style={{ marginBottom: 12 }}>
          Тема магазина (выберите новую тему — витрина мгновенно переключится)
        </p>
        <div className="central-setup__templates">
          {TEMPLATES.map((t) => {
            const selected = site.template_id === t.id;
            return (
              <button
                key={t.id}
                disabled={busy}
                onClick={() => applyTheme(t.id)}
                className="central-setup__template"
                style={{
                  background: selected ? t.colors.accent : t.colors.background,
                  color: selected ? t.colors.accentText : t.colors.text,
                  borderColor: selected ? t.colors.accent : t.colors.border,
                  opacity: busy ? 0.5 : 1
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{t.branding.logoMark}</div>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{t.name}</p>
                <p style={{ fontSize: 12, opacity: 0.7, margin: "4px 0 0" }}>{t.niche}</p>
                {selected && (
                  <p style={{ fontSize: 10, marginTop: 6, opacity: 0.8 }}>✓ Активная тема</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="central-setup__review-eyebrow" style={{ marginBottom: 12 }}>
          Брендинг магазина
        </p>
        <div className="central-setup__fields">
          <label className="central-setup__field">
            <span className="central-setup__field-label">Название магазина</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="central-setup__field-input" />
          </label>
          <label className="central-setup__field">
            <span className="central-setup__field-label">Слоган</span>
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} className="central-setup__field-input" />
          </label>
          <label className="central-setup__field">
            <span className="central-setup__field-label">Главный цвет (HEX)</span>
            <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="central-setup__field-input" placeholder={template?.colors?.accent} />
          </label>
          <label className="central-setup__field">
            <span className="central-setup__field-label">Знак логотипа (1 эмодзи/символ)</span>
            <input value={logoMark} onChange={(e) => setLogoMark(e.target.value)} className="central-setup__field-input" maxLength={4} />
          </label>
        </div>
        <div style={{ marginTop: 16 }}>
          <button onClick={saveBranding} disabled={busy} className="central-btn central-btn--primary">
            {busy ? <><Loader2 size={14} className="spin" /> Сохранение…</> : <><Save size={14} /> Сохранить брендинг</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Products tab — super-admin CRUD
// ===========================================================================

function ProductsTab({
  site, products, loaded, onChange
}: {
  site: CentralSite;
  products: ShopProduct[];
  loaded: boolean;
  onChange: () => void;
}) {
  const token = useCentralAuthStore((s) => s.token);
  const [editing, setEditing] = useState<ShopProduct | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function upsert(p: ShopProduct) {
    if (!token) return;
    setSaving(true);
    try {
      // Try backend first; if it fails (offline), patch localStorage.
      try {
        if (editing) {
          await updateShopProduct(token, site.id, p.id, p);
        } else {
          await createShopProduct(token, site.id, p);
        }
        toast.success("Сохранено в backend", p.title);
      } catch {
        // Offline fallback: persist to localStorage (per-site products bucket).
        const key = `sunstore-site-products-${site.slug}`;
        const raw = window.localStorage.getItem(key);
        const list: ShopProduct[] = raw ? JSON.parse(raw) : [];
        const idx = list.findIndex((x) => x.id === p.id);
        if (idx >= 0) list[idx] = p; else list.unshift(p);
        window.localStorage.setItem(key, JSON.stringify(list));
        toast.success("Сохранено локально (демо-режим)", p.title);
      }
      setShowForm(false);
      setEditing(null);
      onChange();
    } catch (e: any) {
      toast.error("Ошибка сохранения", e?.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    if (!confirm(`Удалить «${p.title}»? Действие необратимо.`)) return;
    if (token) {
      try { await deleteShopProduct(token, site.id, id); }
      catch { /* ignore — fall through to local removal */ }
    }
    // Local removal regardless
    const key = `sunstore-site-products-${site.slug}`;
    const raw = window.localStorage.getItem(key);
    if (raw) {
      try {
        const list: ShopProduct[] = JSON.parse(raw);
        const next = list.filter((x) => x.id !== id);
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch { /* ignore */ }
    }
    toast.success("Удалено", p.title);
    onChange();
  }

  const totalValue = products.reduce((a, p) => a + p.price_kopecks * p.stock_quantity, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, margin: 0 }}>Каталог товаров</h2>
          <p style={{ color: "#888", fontSize: 12, margin: "4px 0 0" }}>
            Всего: {products.length} · На сумму: {formatPrice(totalValue)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onChange} className="central-btn central-btn--ghost">
            <RefreshCw size={14} /> Обновить
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="central-btn central-btn--primary">
            <Plus size={14} /> Новый товар
          </button>
        </div>
      </div>

      {showForm && (
        <ProductForm
          initial={editing}
          saving={saving}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSubmit={upsert}
        />
      )}

      {!loaded ? (
        <p style={{ color: "#888", padding: 24 }}>Загрузка товаров…</p>
      ) : products.length === 0 ? (
        <div className="central-empty">
          <PackageOpen size={32} style={{ opacity: 0.4 }} />
          <p className="central-empty__text">Нет товаров. Нажмите «Новый товар».</p>
        </div>
      ) : (
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ background: "#1a1a1a", color: "#888", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
                <th style={{ padding: 12, textAlign: "left" }}>Товар</th>
                <th style={{ padding: 12, textAlign: "left" }}>SKU</th>
                <th style={{ padding: 12, textAlign: "left" }}>Категория</th>
                <th style={{ padding: 12, textAlign: "right" }}>Цена</th>
                <th style={{ padding: 12, textAlign: "right" }}>Запас</th>
                <th style={{ padding: 12, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid #1a1a1a" }}>
                  <td style={{ padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, background: "#1f1f1f", borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                        {p.images?.[0] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 14 }}>{p.title}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#888" }}>/{p.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: 12, fontSize: 12, color: "#aaa" }}>{p.sku}</td>
                  <td style={{ padding: 12, fontSize: 12, color: "#aaa" }}>{p.category}</td>
                  <td style={{ padding: 12, fontSize: 14, textAlign: "right" }}>{formatPrice(p.price_kopecks)}</td>
                  <td style={{ padding: 12, fontSize: 14, textAlign: "right" }}>{p.stock_quantity}</td>
                  <td style={{ padding: 12, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => { setEditing(p); setShowForm(true); }}
                      className="central-btn central-btn--ghost"
                      style={{ fontSize: 11, padding: "4px 8px", marginRight: 6 }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="central-btn central-btn--danger"
                      style={{ fontSize: 11, padding: "4px 8px" }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProductForm({
  initial, saving, onSubmit, onCancel
}: {
  initial: ShopProduct | null;
  saving: boolean;
  onSubmit: (p: ShopProduct) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [price, setPrice] = useState(((initial?.price_kopecks || 0) / 100).toString());
  const [stock, setStock] = useState((initial?.stock_quantity || 0).toString());
  const [sku, setSku] = useState(initial?.sku || "");
  const [category, setCategory] = useState(initial?.category || "general");
  const [image, setImage] = useState(initial?.images?.[0] || "");
  const [active, setActive] = useState(initial?.is_active ?? true);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error("Введите название"); return; }
    const product: ShopProduct = {
      id: initial?.id || Date.now(),
      site_id: initial?.site_id || 0,
      slug: slug || slugify(title),
      title: title.trim(),
      description: description.trim(),
      price_kopecks: Math.round(parseFloat(price || "0") * 100),
      sku: sku || (slug || slugify(title)) + "-" + Math.floor(Math.random() * 1000),
      stock_quantity: parseInt(stock || "0", 10),
      images: image ? [image] : [],
      category: category || "general",
      is_active: active,
      created_at: initial?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    onSubmit(product);
  }

  return (
    <form onSubmit={submit} style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <div className="central-setup__fields">
        <Field label="Название" value={title} onChange={(v) => { setTitle(v); if (!slug) setSlug(slugify(v)); }} />
        <Field label="Slug" value={slug} onChange={setSlug} />
        <Field label="SKU" value={sku} onChange={setSku} />
        <Field label="Категория" value={category} onChange={setCategory} />
        <Field label="Описание" value={description} onChange={setDescription} />
        <Field label="URL изображения" value={image} onChange={setImage} />
        <Field label="Цена (RUB)" value={price} onChange={setPrice} type="number" />
        <Field label="Запас" value={stock} onChange={setStock} type="number" />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, color: "#aaa", fontSize: 12 }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Активен
      </label>
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button type="submit" disabled={saving} className="central-btn central-btn--primary">
          {saving ? <><Loader2 size={14} className="spin" /> Сохранение…</> : <><Save size={14} /> Сохранить</>}
        </button>
        <button type="button" onClick={onCancel} className="central-btn central-btn--ghost">Отмена</button>
      </div>
    </form>
  );
}

function Field({
  label, value, onChange, type
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="central-setup__field">
      <span className="central-setup__field-label">{label}</span>
      <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} className="central-setup__field-input" />
    </label>
  );
}

// ===========================================================================
// Orders tab
// ===========================================================================

function OrdersTab({ orders, loaded }: { orders: ShopOrder[]; loaded: boolean }) {
  if (!loaded) return <p style={{ color: "#888", padding: 24 }}>Загрузка заказов…</p>;
  if (orders.length === 0) {
    return (
      <div className="central-empty">
        <ShoppingBag size={32} style={{ opacity: 0.4 }} />
        <p className="central-empty__text">Заказов пока нет. Когда клиенты начнут оформлять покупки, они появятся здесь.</p>
      </div>
    );
  }
  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
        <thead>
          <tr style={{ background: "#1a1a1a", color: "#888", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
            <th style={{ padding: 12, textAlign: "left" }}>#</th>
            <th style={{ padding: 12, textAlign: "left" }}>Клиент</th>
            <th style={{ padding: 12, textAlign: "left" }}>Контакт</th>
            <th style={{ padding: 12, textAlign: "right" }}>Сумма</th>
            <th style={{ padding: 12, textAlign: "left" }}>Статус</th>
            <th style={{ padding: 12, textAlign: "left" }}>Дата</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} style={{ borderTop: "1px solid #1a1a1a" }}>
              <td style={{ padding: 12, fontSize: 12 }}>#{o.id}</td>
              <td style={{ padding: 12, fontSize: 14 }}>{o.customer_name}</td>
              <td style={{ padding: 12, fontSize: 12, color: "#aaa" }}>
                {o.customer_email}<br />{o.customer_phone}
              </td>
              <td style={{ padding: 12, fontSize: 14, textAlign: "right" }}>{formatPrice(o.total_amount_kopecks)}</td>
              <td style={{ padding: 12, fontSize: 12 }}>
                <span className={`central-status-pill central-status-pill--${String(o.status || "").toLowerCase()}`}>
                  {o.status}
                </span>
              </td>
              <td style={{ padding: 12, fontSize: 12, color: "#aaa" }}>
                {new Date(o.created_at).toLocaleString("ru-RU")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===========================================================================
// Email tab — per-site override
// ===========================================================================

function EmailTab({ siteId }: { siteId: number }) {
  const token = useCentralAuthStore((s) => s.token);
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
    if (!token) return;
    setLoading(true);
    getSiteEmailConfig(token, siteId)
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
  }, [token, siteId]);

  async function save() {
    if (!token) return;
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
      const updated = await upsertSiteEmailConfig(token, siteId, input);
      setCfg(updated);
      setSmtpPassword("");
      toast.success("Email-настройки магазина сохранены");
    } catch (e: any) {
      toast.error("Ошибка сохранения", e?.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!token) return;
    if (!confirm("Удалить переопределение и использовать платформенные настройки по умолчанию?")) return;
    setBusy(true);
    try {
      await deleteSiteEmailConfig(token, siteId);
      setCfg({ configured: false });
      setFromAddress(""); setSmtpHost(""); setSmtpUsername(""); setSmtpPassword("");
      toast.info("Переназначение удалено — будет использоваться платформенный email");
    } catch (e: any) {
      toast.error("Ошибка удаления", e?.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!token) return;
    if (!testTo) { toast.error("Введите email получателя"); return; }
    setBusy(true);
    try {
      const r = await testSiteEmail(token, siteId, testTo);
      if (r.ok) toast.success("Тестовое письмо отправлено", testTo);
      else toast.error("Ошибка отправки", r.error || "неизвестная");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p style={{ color: "#888", padding: 24 }}>Загрузка email-настроек…</p>;

  // Auto-fill Gmail defaults when provider is gmail
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

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="central-stat" style={{ padding: 20 }}>
        <p className="central-stat__label">Статус</p>
        <p style={{ marginTop: 8, fontSize: 14 }}>
          {cfg?.configured
            ? <>✓ Настроено переопределение для этого магазина. Письма будут отправляться с указанного ниже адреса.</>
            : <>ℹ️ Переопределения нет. Используются <Link href="/central/email" style={{ color: "#00ff88" }}>платформенные настройки email</Link>.</>
          }
        </p>
      </div>

      <div className="central-stat" style={{ padding: 20 }}>
        <p className="central-stat__label">Тип аккаунта</p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
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
          <p style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
            Создайте App Password в Google Account → Security → 2-Step Verification → App passwords.
            Используйте этот 16-значный пароль как SMTP-пароль.
          </p>
        )}
      </div>

      <div className="central-stat" style={{ padding: 20 }}>
        <div className="central-setup__fields">
          <Field label="From (адрес отправителя)" value={fromAddress} onChange={setFromAddress} />
          <Field label="Имя отправителя" value={fromName} onChange={setFromName} />
          <Field label="SMTP host" value={smtpHost} onChange={setSmtpHost} />
          <Field label="SMTP port" value={smtpPort} onChange={setSmtpPort} type="number" />
          <Field label="SMTP username" value={smtpUsername} onChange={setSmtpUsername} />
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
              <input type="checkbox" checked={useTLS} onChange={(e) => setUseTLS(e.target.checked)} /> STARTTLS
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#aaa", fontSize: 12 }}>
              <input type="checkbox" checked={useSSL} onChange={(e) => setUseSSL(e.target.checked)} /> SSL (порт 465)
            </label>
          </label>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={save} disabled={busy} className="central-btn central-btn--primary">
            {busy ? <><Loader2 size={14} className="spin" /> Сохранение…</> : <><Save size={14} /> Сохранить</>}
          </button>
          {cfg?.configured && (
            <button onClick={remove} disabled={busy} className="central-btn central-btn--danger">
              <Trash2 size={14} /> Удалить переопределение
            </button>
          )}
        </div>
      </div>

      <div className="central-stat" style={{ padding: 20 }}>
        <p className="central-stat__label">Тестовая отправка</p>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <input
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="test@example.com"
            className="central-setup__field-input"
            style={{ flex: "1 1 240px", marginBottom: 0 }}
            type="email"
          />
          <button onClick={sendTest} disabled={busy} className="central-btn central-btn--primary">
            <Wand2 size={14} /> Отправить тест
          </button>
        </div>
      </div>
    </div>
  );
}
