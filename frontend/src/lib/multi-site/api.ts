// Multi-site API client. All calls go through the central /api/v1/central
// namespace except per-site endpoints which use /api/v1/sites/{slug}/...
// Falls back to local mock data when the backend is unreachable so the
// admin UI stays usable during development.

import { Product } from "@/types/api";
import { Template } from "@/lib/templates/types";
import { TEMPLATES } from "@/lib/templates/templates";
import { mockOrders, mockProducts } from "@/lib/mock-data";

const DEFAULT_API_BASE_URL = "http://localhost:8080/api/v1";
const ENABLE_DEMO_FALLBACKS =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACKS !== "false";

function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (typeof window !== "undefined" && (window as any).__API_BASE__) ||
    DEFAULT_API_BASE_URL
  ).replace(/\/+$/, "");
}

function hasExplicitApiBaseUrl(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_API_BASE_URL ||
      (typeof window !== "undefined" && (window as any).__API_BASE__)
  );
}

function isLocalPlaceholderApiBase(baseUrl = getApiBaseUrl()): boolean {
  return /^https?:\/\/(localhost|127(?:\.\d+){3})(:\d+)?(\/|$)/i.test(baseUrl);
}

function shouldUseEmbeddedSiteMocks(): boolean {
  return (
    ENABLE_DEMO_FALLBACKS &&
    isLocalPlaceholderApiBase() &&
    !hasExplicitApiBaseUrl()
  );
}

// ---------------------------------------------------------------------------
// Client-side demo store (Vercel / frontend-only)
// ---------------------------------------------------------------------------

type DemoCentralState = {
  sites: CentralSite[];
  siteAdmins: Record<number, CentralSiteAdmin[]>;
  siteProducts: Record<number, ShopProduct[]>;
  siteOrders: Record<number, ShopOrder[]>;
  platformEmail: EmailConfigDTO;
  subscribers: Array<{ id: number; email: string; name?: string; created_at: string }>;
  tickets: Array<{ id: number; name: string; email: string; phone?: string; subject: string; message: string; created_at: string }>;
};

const DEMO_STORAGE_KEY = "sunstore-demo-central-v1";

function shouldUseClientDemoCentral(): boolean {
  return ENABLE_DEMO_FALLBACKS && typeof window !== "undefined" && shouldUseEmbeddedSiteMocks();
}

function safeNow(): string {
  return new Date().toISOString();
}

function buildStorefrontUrl(siteSlug: string): string {
  // Works on Vercel preview/prod, same-origin and slug-based routing
  return `/sites/${encodeURIComponent(siteSlug)}`;
}

function buildAdminUrl(siteId: number): string {
  return `/central/sites/${siteId}`;
}

function toShopProduct(site: CentralSite, product: Product, idx: number): ShopProduct {
  return {
    id: Number(product.id) || idx + 1,
    site_id: site.id,
    site_slug: site.slug,
    site_name: site.name,
    slug: product.slug,
    title: product.title_ru,
    description: product.description_ru,
    price_kopecks: product.price_kopecks,
    sku: product.sku,
    stock_quantity: product.stock_quantity,
    images: product.images ?? [],
    category: product.category_slug || product.category_name_ru || "general",
    is_active: product.is_active,
    created_at: product.created_at ?? safeNow(),
    updated_at: product.updated_at ?? safeNow()
  };
}

function toShopOrder(site: CentralSite, order: any, idx: number): ShopOrder {
  return {
    id: Number(order.id) || idx + 1,
    site_id: site.id,
    site_slug: site.slug,
    site_name: site.name,
    tbank_order_id: order.tbank_order_id ?? `SUN-MOCK-${idx + 1}`,
    tbank_payment_id: order.tbank_payment_id ?? null,
    customer_name: order.customer_name ?? "Покупатель",
    customer_email: order.customer_email ?? "buyer@example.com",
    customer_phone: order.customer_phone ?? "+7 999 000-00-00",
    total_amount_kopecks: order.total_amount_kopecks ?? 0,
    status: order.status ?? "CONFIRMED",
    created_at: order.created_at ?? safeNow(),
    updated_at: order.updated_at ?? safeNow()
  };
}

function initDemoState(): DemoCentralState {
  const sites = mockCentralSites();
  const siteAdmins: Record<number, CentralSiteAdmin[]> = {};
  const siteProducts: Record<number, ShopProduct[]> = {};
  const siteOrders: Record<number, ShopOrder[]> = {};

  for (const site of sites) {
    siteAdmins[site.id] = [
      {
        id: site.id * 100 + 1,
        site_id: site.id,
        username: "admin",
        role: "owner",
        is_active: true,
        last_login_at: null,
        created_at: safeNow()
      }
    ];

    // Product set: for the "solar panels" demo site use the storefront mock catalog,
    // for template-driven sites use template products.
    if (site.slug === "sun-panels") {
      siteProducts[site.id] = mockProducts.map((p, idx) => toShopProduct(site, p, idx));
      siteOrders[site.id] = mockOrders.map((o, idx) => toShopOrder(site, o, idx));
    } else {
      const template = TEMPLATES.find((t) => t.id === site.template_id);
      siteProducts[site.id] = (template?.products ?? []).map((p, idx) => ({
        id: Number(p.id.replace(/\D/g, "")) || idx + 1,
        site_id: site.id,
        site_slug: site.slug,
        site_name: site.name,
        slug: p.slug,
        title: p.title,
        description: p.description,
        price_kopecks: p.price_kopecks,
        sku: p.sku,
        stock_quantity: p.stock_quantity,
        images: p.images,
        category: p.category_id,
        is_active: p.is_active,
        created_at: safeNow(),
        updated_at: safeNow()
      }));
      siteOrders[site.id] = [];
    }
  }

  return {
    sites,
    siteAdmins,
    siteProducts,
    siteOrders,
    platformEmail: { configured: false },
    subscribers: [],
    tickets: []
  };
}

function loadDemoState(): DemoCentralState {
  if (typeof window === "undefined") return initDemoState();
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) {
      const initial = initDemoState();
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as DemoCentralState;
    if (!parsed?.sites) throw new Error("bad demo store");
    return parsed;
  } catch {
    const initial = initDemoState();
    try {
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(initial));
    } catch {
      // ignore
    }
    return initial;
  }
}

function saveDemoState(next: DemoCentralState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function requireDemoToken(token?: string | null): void {
  if (!token) throw new Error("HTTP 401: missing token");
}

function nextId(values: Array<{ id: number }>, base = 1): number {
  const max = values.reduce((acc, v) => Math.max(acc, v.id || 0), 0);
  return Math.max(max + 1, base);
}

export interface CentralSite {
  id: number;
  slug: string;
  name: string;
  niche: string;
  template_id: string;
  status: "PROVISIONING" | "READY" | "SUSPENDED" | "ARCHIVED";
  custom_domain?: string | null;
  primary_color?: string | null;
  logo_mark?: string | null;
  tagline?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
  launched_at?: string | null;
  settings?: Record<string, any>;
}

export interface CentralSiteAdmin {
  id: number;
  site_id: number;
  username: string;
  role: string;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
}

export interface CreateSiteInput {
  slug: string;
  name: string;
  niche: string;
  template_id: string;
  owner_email: string;
  owner_username: string;
  owner_password: string;
  primary_color?: string;
  logo_mark?: string;
  tagline?: string;
  description?: string;
  custom_domain?: string;
}

// ---------------------------------------------------------------------------
// Super-admin types (new consolidated API surface)
// ---------------------------------------------------------------------------

export interface ShopProduct {
  id: number;
  site_id: number;
  slug: string;
  title: string;
  description: string;
  price_kopecks: number;
  sku: string;
  stock_quantity: number;
  images: string[];
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** Populated by the cross-store listing (GET /central/products). */
  site_name?: string;
  site_slug?: string;
}

export interface ShopOrder {
  id: number;
  site_id: number;
  tbank_order_id: string;
  tbank_payment_id?: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount_kopecks: number;
  status: string;
  created_at: string;
  updated_at: string;
  /** Populated by the cross-store listing (GET /central/orders). */
  site_name?: string;
  site_slug?: string;
}

export interface EmailConfigDTO {
  configured: boolean;
  id?: number;
  scope?: "platform" | "site";
  site_id?: number | null;
  provider?: "smtp" | "gmail";
  from_address?: string;
  from_name?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string; // masked when read
  use_tls?: boolean;
  use_ssl?: boolean;
  reply_to?: string;
  is_active?: boolean;
  updated_at?: string;
}

export interface EmailConfigInput {
  provider: "smtp" | "gmail";
  from_address: string;
  from_name?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string; // empty = keep existing
  use_tls?: boolean;
  use_ssl?: boolean;
  reply_to?: string;
  is_active?: boolean;
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j.error || j.detail || JSON.stringify(j);
    } catch {
      detail = await res.text();
    }
    throw new Error(`HTTP ${res.status}: ${detail || res.statusText}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

// ----- Central admin auth -----

export async function centralLogin(username: string, password: string): Promise<{ token: string; username: string }> {
  try {
    return await request("/central/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) throw error;
    if (!username.trim() || !password.trim()) {
      throw new Error("HTTP 400: Введите логин и пароль");
    }
    // Frontend-only demo: accept credentials locally and issue a mock token.
    if (shouldUseClientDemoCentral()) {
      // Prefer the documented dev bootstrap for clarity, but allow any non-empty
      // credentials in demo mode so users can proceed without backend wiring.
      const demoToken = "demo-central-token";
      return { token: demoToken, username: username.trim() };
    }
    throw error;
  }
}

// ----- Sites -----

export async function listCentralSites(token: string, q?: { status?: string; niche?: string; search?: string }): Promise<CentralSite[]> {
  try {
    const params = new URLSearchParams();
    if (q?.status) params.set("status", q.status);
    if (q?.niche) params.set("niche", q.niche);
    if (q?.search) params.set("q", q.search);
    const suffix = params.toString() ? `?${params}` : "";
    const r = await request<{ items: CentralSite[] }>(`/central/sites${suffix}`, {}, token);
    return r.items;
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) throw error;
    return mockCentralSites();
  }
}

export async function createCentralSite(token: string, input: CreateSiteInput): Promise<{ site: CentralSite; admin: { id: number; username: string; role: string }; admin_url: string; storefront_url: string }> {
  if (shouldUseClientDemoCentral()) {
    requireDemoToken(token);
    const state = loadDemoState();
    const id = nextId(state.sites, 100);
    const site: CentralSite = {
      id,
      slug: input.slug,
      name: input.name,
      niche: input.niche,
      template_id: input.template_id,
      status: "READY",
      custom_domain: input.custom_domain ?? null,
      primary_color: input.primary_color ?? null,
      logo_mark: input.logo_mark ?? null,
      tagline: input.tagline ?? null,
      description: input.description ?? null,
      created_at: safeNow(),
      updated_at: safeNow(),
      launched_at: safeNow()
    };

    const adminId = id * 100 + 1;
    const admin = { id: adminId, username: input.owner_username, role: "owner" };
    state.sites = [site, ...state.sites];
    state.siteAdmins[id] = [
      {
        id: adminId,
        site_id: id,
        username: input.owner_username,
        role: "owner",
        is_active: true,
        last_login_at: null,
        created_at: safeNow()
      }
    ];

    const template = TEMPLATES.find((t) => t.id === input.template_id);
    state.siteProducts[id] = (template?.products ?? []).map((p, idx) => ({
      id: Number(p.id.replace(/\D/g, "")) || idx + 1,
      site_id: id,
      site_slug: input.slug,
      site_name: input.name,
      slug: p.slug,
      title: p.title,
      description: p.description,
      price_kopecks: p.price_kopecks,
      sku: p.sku,
      stock_quantity: p.stock_quantity,
      images: p.images,
      category: p.category_id,
      is_active: p.is_active,
      created_at: safeNow(),
      updated_at: safeNow()
    }));
    state.siteOrders[id] = [];

    saveDemoState(state);
    return {
      site,
      admin,
      admin_url: buildAdminUrl(id),
      storefront_url: buildStorefrontUrl(input.slug)
    };
  }

  return request("/central/sites", {
    method: "POST",
    body: JSON.stringify(input),
  }, token);
}

export async function setSiteStatus(token: string, id: number, status: CentralSite["status"]): Promise<void> {
  if (shouldUseClientDemoCentral()) {
    requireDemoToken(token);
    const state = loadDemoState();
    state.sites = state.sites.map((s) =>
      s.id === id ? { ...s, status, updated_at: safeNow() } : s
    );
    saveDemoState(state);
    return;
  }
  return request(`/central/sites/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }, token);
}

export async function getSiteBySlug(slug: string): Promise<CentralSite | null> {
  if (shouldUseEmbeddedSiteMocks()) {
    return getEmbeddedSiteBySlug(slug);
  }
  try {
    return await request<CentralSite>(`/sites/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) throw error;
    return getEmbeddedSiteBySlug(slug);
  }
}

export async function listSiteProducts(slug: string): Promise<Product[]> {
  if (shouldUseEmbeddedSiteMocks()) {
    return getEmbeddedSiteProducts(slug);
  }
  try {
    const items = await request<Array<ShopProduct | Product>>(
      `/sites/${encodeURIComponent(slug)}/products`
    );
    return items.map((item: any) => normalizeStorefrontProduct(item, slug));
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) throw error;
    return getEmbeddedSiteProducts(slug);
  }
}

// ----- Per-site admin -----

export async function siteAdminLogin(slug: string, username: string, password: string): Promise<{ token: string; site: { id: number; slug: string; name: string } }> {
  return request(`/sites/${encodeURIComponent(slug)}/admin/auth/login`, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function listSiteAdmins(token: string, siteId: number): Promise<CentralSiteAdmin[]> {
  if (shouldUseClientDemoCentral()) {
    requireDemoToken(token);
    const state = loadDemoState();
    return state.siteAdmins[siteId] ?? [];
  }
  const r = await request<{ items: CentralSiteAdmin[] }>(`/central/sites/${siteId}/admins`, {}, token);
  return r.items;
}

export async function addSiteAdmin(token: string, siteId: number, username: string, password: string, role: string): Promise<CentralSiteAdmin> {
  if (shouldUseClientDemoCentral()) {
    requireDemoToken(token);
    if (!username.trim() || !password.trim()) {
      throw new Error("HTTP 400: Введите логин и пароль");
    }
    const state = loadDemoState();
    const list = state.siteAdmins[siteId] ?? [];
    const admin: CentralSiteAdmin = {
      id: nextId(list, siteId * 100 + 1),
      site_id: siteId,
      username: username.trim(),
      role: role || "manager",
      is_active: true,
      last_login_at: null,
      created_at: safeNow()
    };
    state.siteAdmins[siteId] = [admin, ...list];
    saveDemoState(state);
    return admin;
  }
  return request(`/central/sites/${siteId}/admins`, {
    method: "POST",
    body: JSON.stringify({ username, password, role }),
  }, token);
}

export async function removeSiteAdmin(token: string, siteId: number, adminId: number): Promise<void> {
  if (shouldUseClientDemoCentral()) {
    requireDemoToken(token);
    const state = loadDemoState();
    state.siteAdmins[siteId] = (state.siteAdmins[siteId] ?? []).filter((a) => a.id !== adminId);
    saveDemoState(state);
    return;
  }
  return request(`/central/sites/${siteId}/admins/${adminId}`, {
    method: "DELETE",
  }, token);
}

// ---------------------------------------------------------------------------
// Super-admin consolidated shop management
// ---------------------------------------------------------------------------

export async function getShop(token: string, id: number): Promise<CentralSite | null> {
  if (shouldUseClientDemoCentral()) {
    requireDemoToken(token);
    const state = loadDemoState();
    return state.sites.find((s) => s.id === id) ?? null;
  }
  try {
    return await request<CentralSite>(`/central/sites/${id}`, {}, token);
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) throw error;
    return null;
  }
}

export async function updateShopTheme(token: string, id: number, templateId: string): Promise<void> {
  if (shouldUseClientDemoCentral()) {
    requireDemoToken(token);
    const state = loadDemoState();
    state.sites = state.sites.map((s) =>
      s.id === id ? { ...s, template_id: templateId, updated_at: safeNow() } : s
    );
    const site = state.sites.find((s) => s.id === id);
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (site && template) {
      state.siteProducts[id] = (template.products ?? []).map((p, idx) => ({
        id: Number(p.id.replace(/\D/g, "")) || idx + 1,
        site_id: id,
        site_slug: site.slug,
        site_name: site.name,
        slug: p.slug,
        title: p.title,
        description: p.description,
        price_kopecks: p.price_kopecks,
        sku: p.sku,
        stock_quantity: p.stock_quantity,
        images: p.images,
        category: p.category_id,
        is_active: p.is_active,
        created_at: safeNow(),
        updated_at: safeNow()
      }));
    }
    saveDemoState(state);
    return;
  }
  return request(`/central/sites/${id}/theme`, {
    method: "PATCH",
    body: JSON.stringify({ template_id: templateId }),
  }, token);
}

export async function updateShopBranding(token: string, id: number, body: {
  name?: string;
  tagline?: string;
  primary_color?: string;
  logo_mark?: string;
}): Promise<void> {
  if (shouldUseClientDemoCentral()) {
    requireDemoToken(token);
    const state = loadDemoState();
    state.sites = state.sites.map((s) => {
      if (s.id !== id) return s;
      return {
        ...s,
        name: body.name ?? s.name,
        tagline: body.tagline ?? s.tagline,
        primary_color: body.primary_color ?? s.primary_color,
        logo_mark: body.logo_mark ?? s.logo_mark,
        updated_at: safeNow()
      };
    });
    saveDemoState(state);
    return;
  }
  return request(`/central/sites/${id}/branding`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }, token);
}

// --- Products (super-admin CRUD) ---

export async function listShopProducts(token: string, id: number): Promise<ShopProduct[]> {
  if (shouldUseClientDemoCentral()) {
    requireDemoToken(token);
    const state = loadDemoState();
    return state.siteProducts[id] ?? [];
  }
  try {
    const r = await request<{ items: ShopProduct[] }>(`/central/sites/${id}/products`, {}, token);
    return r.items || [];
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) throw error;
    return [];
  }
}

export async function createShopProduct(token: string, id: number, p: Partial<ShopProduct>): Promise<ShopProduct> {
  if (shouldUseClientDemoCentral()) {
    requireDemoToken(token);
    const state = loadDemoState();
    const list = state.siteProducts[id] ?? [];
    const site = state.sites.find((s) => s.id === id);
    const created: ShopProduct = {
      id: nextId(list, 1),
      site_id: id,
      site_slug: site?.slug,
      site_name: site?.name,
      slug: (p.slug || `product-${Date.now()}`).toString(),
      title: (p.title || "Новый товар").toString(),
      description: (p.description || "").toString(),
      price_kopecks: Number(p.price_kopecks || 0),
      sku: (p.sku || `SKU-${Date.now()}`).toString(),
      stock_quantity: Number(p.stock_quantity || 0),
      images: Array.isArray(p.images) ? p.images : [],
      category: (p.category || "general").toString(),
      is_active: p.is_active !== false,
      created_at: safeNow(),
      updated_at: safeNow()
    };
    state.siteProducts[id] = [created, ...list];
    saveDemoState(state);
    return created;
  }
  return request(`/central/sites/${id}/products`, {
    method: "POST",
    body: JSON.stringify(p),
  }, token);
}

export async function updateShopProduct(token: string, id: number, productId: number, p: Partial<ShopProduct>): Promise<ShopProduct> {
  if (shouldUseClientDemoCentral()) {
    requireDemoToken(token);
    const state = loadDemoState();
    const list = state.siteProducts[id] ?? [];
    const next = list.map((item) => {
      if (item.id !== productId) return item;
      return {
        ...item,
        ...p,
        updated_at: safeNow()
      } as ShopProduct;
    });
    state.siteProducts[id] = next;
    saveDemoState(state);
    const found = next.find((x) => x.id === productId);
    if (!found) throw new Error("HTTP 404: Product not found");
    return found;
  }
  return request(`/central/sites/${id}/products/${productId}`, {
    method: "PUT",
    body: JSON.stringify(p),
  }, token);
}

export async function deleteShopProduct(token: string, id: number, productId: number): Promise<void> {
  if (shouldUseClientDemoCentral()) {
    requireDemoToken(token);
    const state = loadDemoState();
    state.siteProducts[id] = (state.siteProducts[id] ?? []).filter((p) => p.id !== productId);
    saveDemoState(state);
    return;
  }
  return request(`/central/sites/${id}/products/${productId}`, {
    method: "DELETE",
  }, token);
}

// --- Orders ---

export async function listShopOrders(token: string, id: number): Promise<ShopOrder[]> {
  if (shouldUseClientDemoCentral()) {
    requireDemoToken(token);
    const state = loadDemoState();
    return state.siteOrders[id] ?? [];
  }
  try {
    const r = await request<{ items: ShopOrder[] }>(`/central/sites/${id}/orders`, {}, token);
    return r.items || [];
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) throw error;
    return [];
  }
}

// --- Cross-store unified views (super-admin) ---

/** Orders across every store. site_id 0/omitted = all stores. */
export async function listAllShopOrders(
  token: string,
  q?: { site_id?: number; status?: string; search?: string; limit?: number; offset?: number }
): Promise<{ items: ShopOrder[]; total: number }> {
  if (shouldUseClientDemoCentral()) {
    requireDemoToken(token);
    const state = loadDemoState();
    const all = Object.values(state.siteOrders).flat();
    const filtered = all.filter((o) => {
      if (q?.site_id && o.site_id !== q.site_id) return false;
      if (q?.status && o.status !== q.status) return false;
      if (q?.search) {
        const h = `${o.customer_name} ${o.customer_email} ${o.tbank_order_id}`.toLowerCase();
        if (!h.includes(q.search.toLowerCase())) return false;
      }
      return true;
    });
    return { items: filtered, total: filtered.length };
  }
  const params = new URLSearchParams();
  if (q?.site_id) params.set("site_id", String(q.site_id));
  if (q?.status) params.set("status", q.status);
  if (q?.search) params.set("q", q.search);
  if (q?.limit) params.set("limit", String(q.limit));
  if (q?.offset) params.set("offset", String(q.offset));
  const qs = params.toString();
  try {
    return await request<{ items: ShopOrder[]; total: number }>(
      `/central/orders${qs ? `?${qs}` : ""}`,
      {},
      token
    );
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) throw error;
    return { items: [], total: 0 };
  }
}

/** Products across every store. site_id 0/omitted = all stores. */
export async function listAllShopProducts(
  token: string,
  q?: { site_id?: number; search?: string; category?: string; active?: boolean; limit?: number; offset?: number }
): Promise<{ items: ShopProduct[]; total: number }> {
  if (shouldUseClientDemoCentral()) {
    requireDemoToken(token);
    const state = loadDemoState();
    const all = Object.values(state.siteProducts).flat();
    const filtered = all.filter((p) => {
      if (q?.site_id && p.site_id !== q.site_id) return false;
      if (q?.category && p.category !== q.category) return false;
      if (q?.active && !p.is_active) return false;
      if (q?.search) {
        const h = `${p.title} ${p.description} ${p.sku}`.toLowerCase();
        if (!h.includes(q.search.toLowerCase())) return false;
      }
      return true;
    });
    return { items: filtered, total: filtered.length };
  }
  const params = new URLSearchParams();
  if (q?.site_id) params.set("site_id", String(q.site_id));
  if (q?.search) params.set("q", q.search);
  if (q?.category) params.set("category", q.category);
  if (q?.active) params.set("active", "1");
  if (q?.limit) params.set("limit", String(q.limit));
  if (q?.offset) params.set("offset", String(q.offset));
  const qs = params.toString();
  try {
    return await request<{ items: ShopProduct[]; total: number }>(
      `/central/products${qs ? `?${qs}` : ""}`,
      {},
      token
    );
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) throw error;
    return { items: [], total: 0 };
  }
}

// --- Email config ---

export async function getPlatformEmailConfig(token: string): Promise<EmailConfigDTO> {
  if (shouldUseClientDemoCentral()) {
    requireDemoToken(token);
    const state = loadDemoState();
    return state.platformEmail ?? { configured: false };
  }
  try {
    return await request<EmailConfigDTO>(`/central/email-config`, {}, token);
  } catch {
    return { configured: false };
  }
}

export async function upsertPlatformEmailConfig(token: string, input: EmailConfigInput): Promise<EmailConfigDTO> {
  if (shouldUseClientDemoCentral()) {
    requireDemoToken(token);
    const state = loadDemoState();
    state.platformEmail = { ...input, configured: true } as EmailConfigDTO;
    saveDemoState(state);
    return state.platformEmail;
  }
  return request(`/central/email-config`, {
    method: "PUT",
    body: JSON.stringify(input),
  }, token);
}

export async function testPlatformEmail(token: string, to: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await request(`/central/email-config/test`, {
      method: "POST",
      body: JSON.stringify({ to }),
    }, token);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "send_failed" };
  }
}

export async function getSiteEmailConfig(token: string, siteId: number): Promise<EmailConfigDTO> {
  try {
    return await request<EmailConfigDTO>(`/central/sites/${siteId}/email-config`, {}, token);
  } catch {
    return { configured: false };
  }
}

export async function upsertSiteEmailConfig(token: string, siteId: number, input: EmailConfigInput): Promise<EmailConfigDTO> {
  return request(`/central/sites/${siteId}/email-config`, {
    method: "PUT",
    body: JSON.stringify(input),
  }, token);
}

export async function deleteSiteEmailConfig(token: string, siteId: number): Promise<void> {
  return request(`/central/sites/${siteId}/email-config`, {
    method: "DELETE",
  }, token);
}

export async function testSiteEmail(token: string, siteId: number, to: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await request(`/central/sites/${siteId}/email-config/test`, {
      method: "POST",
      body: JSON.stringify({ to }),
    }, token);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "send_failed" };
  }
}

// ----- Mock fallback (in-memory, dev-only) -----

const MOCK_SITES_KEY = "sunstore-central-sites";

// ---------------------------------------------------------------------------
// CRM: custom domains, support tickets, mailing lists
// ---------------------------------------------------------------------------

export interface PlatformDNSInfo {
  nameservers: string[];
  apex_ip: string;
  preview_base_url: string;
  api_docs_url: string;
}

export interface DomainInstructions {
  domain: string;
  status: "NONE" | "PENDING" | "ACTIVE" | "FAILED";
  verified_at?: string | null;
  nameservers: string[];
  a_record: string;
  cname_record: string;
  preview_url: string;
  custom_domain_url?: string;
}

export interface SupportTicket {
  id: number;
  site_id: number;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: "NEW" | "OPEN" | "REPLIED" | "CLOSED";
  source: string;
  ip_address: string;
  reply_subject?: string | null;
  reply_body?: string | null;
  replied_at?: string | null;
  created_at: string;
  updated_at: string;
  site_name?: string;
  site_slug?: string;
}

export interface Subscriber {
  id: number;
  site_id: number;
  email: string;
  name: string;
  status: "SUBSCRIBED" | "UNSUBSCRIBED";
  source: string;
  created_at: string;
  unsubscribed_at?: string | null;
  site_name?: string;
  site_slug?: string;
}

export async function getPlatformDNS(token: string): Promise<PlatformDNSInfo> {
  try {
    return await request<PlatformDNSInfo>(`/central/dns/platform`, {}, token);
  } catch {
    return {
      nameservers: ["ns1.sun.store", "ns2.sun.store"],
      apex_ip: "76.76.21.21",
      preview_base_url: "https://sunstore.vercel.app",
      api_docs_url: "",
    };
  }
}

export async function getDomainInstructions(token: string, siteId: number): Promise<DomainInstructions | null> {
  try {
    return await request<DomainInstructions>(`/central/sites/${siteId}/domain`, {}, token);
  } catch {
    return null;
  }
}

export async function attachDomain(token: string, siteId: number, domain: string): Promise<DomainInstructions> {
  return request(`/central/sites/${siteId}/domain`, {
    method: "POST",
    body: JSON.stringify({ domain }),
  }, token);
}

export async function removeDomain(token: string, siteId: number): Promise<void> {
  return request(`/central/sites/${siteId}/domain`, {
    method: "DELETE",
  }, token);
}

export async function verifyDomain(token: string, siteId: number): Promise<{ status: string; verified: boolean }> {
  return request(`/central/sites/${siteId}/domain/verify`, {
    method: "POST",
  }, token);
}

export async function listAllTickets(
  token: string,
  q?: { site_id?: number; status?: string; search?: string }
): Promise<SupportTicket[]> {
  const params = new URLSearchParams();
  if (q?.site_id) params.set("site_id", String(q.site_id));
  if (q?.status) params.set("status", q.status);
  if (q?.search) params.set("q", q.search);
  const qs = params.toString();
  try {
    const r = await request<{ items: SupportTicket[] }>(`/central/tickets${qs ? `?${qs}` : ""}`, {}, token);
    return r.items || [];
  } catch {
    return [];
  }
}

export async function listShopTickets(token: string, siteId: number): Promise<SupportTicket[]> {
  try {
    const r = await request<{ items: SupportTicket[] }>(`/central/sites/${siteId}/tickets`, {}, token);
    return r.items || [];
  } catch {
    return [];
  }
}

export async function updateTicket(
  token: string, siteId: number, ticketId: number,
  body: { status?: string; reply_subject?: string; reply_body?: string }
): Promise<SupportTicket> {
  return request(`/central/sites/${siteId}/tickets/${ticketId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }, token);
}

export async function listAllSubscribers(
  token: string,
  q?: { site_id?: number; status?: string; search?: string }
): Promise<Subscriber[]> {
  const params = new URLSearchParams();
  if (q?.site_id) params.set("site_id", String(q.site_id));
  if (q?.status) params.set("status", q.status);
  if (q?.search) params.set("q", q.search);
  const qs = params.toString();
  try {
    const r = await request<{ items: Subscriber[] }>(`/central/subscribers${qs ? `?${qs}` : ""}`, {}, token);
    return r.items || [];
  } catch {
    return [];
  }
}

export async function listShopSubscribers(token: string, siteId: number): Promise<Subscriber[]> {
  try {
    const r = await request<{ items: Subscriber[] }>(`/central/sites/${siteId}/subscribers`, {}, token);
    return r.items || [];
  } catch {
    return [];
  }
}

export async function removeSubscriber(token: string, siteId: number, subscriberId: number): Promise<void> {
  return request(`/central/sites/${siteId}/subscribers/${subscriberId}`, {
    method: "DELETE",
  }, token);
}

export async function broadcast(
  token: string,
  body: { site_id?: number; subject: string; html_body: string }
): Promise<{ sent: number; failed: number }> {
  return request(`/central/broadcast`, {
    method: "POST",
    body: JSON.stringify(body),
  }, token);
}

// --- Public storefront CRM endpoints (no token needed) ---

export async function publicContact(
  slug: string,
  body: { name: string; email: string; phone?: string; subject: string; message: string }
): Promise<{ ok: boolean }> {
  return request(`/sites/${encodeURIComponent(slug)}/contact`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function publicSubscribe(
  slug: string,
  body: { email: string; name?: string }
): Promise<{ ok: boolean }> {
  return request(`/sites/${encodeURIComponent(slug)}/subscribe`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function publicUnsubscribe(slug: string, email: string): Promise<{ ok: boolean }> {
  return request(`/sites/${encodeURIComponent(slug)}/subscribe`, {
    method: "DELETE",
    body: JSON.stringify({ email }),
  });
}

function mockCentralSites(): CentralSite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MOCK_SITES_KEY);
    if (raw) return JSON.parse(raw) as CentralSite[];
  } catch {
    // ignore
  }
  return [];
}

export function persistMockSite(site: CentralSite) {
  if (typeof window === "undefined") return;
  const all = mockCentralSites();
  const existing = all.findIndex((s) => s.id === site.id);
  if (existing >= 0) all[existing] = site;
  else all.unshift(site);
  window.localStorage.setItem(MOCK_SITES_KEY, JSON.stringify(all));
}

function normalizeStorefrontProduct(item: Partial<ShopProduct> & Partial<Product>, slug: string): Product {
  return {
    id: Number(item.id || 0),
    site_id: item.site_id ?? null,
    site_slug: item.site_slug ?? slug,
    site_name: item.site_name ?? null,
    category_id: item.category_id ?? null,
    category_slug: item.category_slug ?? item.category ?? null,
    category_name_ru: item.category_name_ru ?? item.category ?? null,
    slug: item.slug || "",
    title_ru: item.title_ru ?? item.title ?? "",
    description_ru: item.description_ru ?? item.description ?? "",
    price_kopecks: Number(item.price_kopecks || 0),
    sku: item.sku || "",
    stock_quantity: Number(item.stock_quantity || 0),
    images: Array.isArray(item.images) ? item.images : [],
    is_active: Boolean(item.is_active),
    created_at: item.created_at || new Date(0).toISOString(),
    updated_at: item.updated_at || new Date(0).toISOString()
  };
}

function getEmbeddedSiteBySlug(slug: string): CentralSite | null {
  const existing = mockCentralSites().find((site) => site.slug === slug);
  if (existing) return existing;

  const template = TEMPLATES.find((entry) => entry.id === slug);
  if (!template) return null;

  return {
    id: template.id.length,
    slug,
    name: template.branding.storeName,
    niche: template.niche,
    template_id: template.id,
    status: "READY",
    custom_domain: null,
    primary_color: template.colors.accent,
    logo_mark: template.branding.logoMark,
    tagline: template.branding.tagline,
    description: template.branding.description,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    launched_at: new Date(0).toISOString()
  };
}

function getEmbeddedSiteProducts(slug: string): Product[] {
  const site = getEmbeddedSiteBySlug(slug);
  const template = TEMPLATES.find((entry) => entry.id === site?.template_id);
  if (!template) return [];

  return template.products.map((product, index) =>
    normalizeStorefrontProduct(
      {
        id: Number(product.id.replace(/\D/g, "")) || index + 1,
        site_id: site?.id,
        site_slug: slug,
        site_name: site?.name,
        category_id: undefined,
        category_slug: product.category_id,
        category_name_ru:
          template.categories.find((entry) => entry.id === product.category_id)?.name ??
          product.category_id,
        slug: product.slug,
        title_ru: product.title,
        description_ru: product.description,
        price_kopecks: product.price_kopecks,
        sku: product.sku,
        stock_quantity: product.stock_quantity,
        images: product.images,
        is_active: product.is_active,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString()
      },
      slug
    )
  );
}
