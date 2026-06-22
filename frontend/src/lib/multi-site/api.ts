// Multi-site API client. All calls go through the central /api/v1/central
// namespace except per-site endpoints which use /api/v1/sites/{slug}/...
// Falls back to local mock data when the backend is unreachable so the
// admin UI stays usable during development.

import { Product } from "@/types/api";
import { Template } from "@/lib/templates/types";

const DEFAULT_API_BASE_URL = "http://localhost:8080/api/v1";

function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (typeof window !== "undefined" && (window as any).__API_BASE__) ||
    DEFAULT_API_BASE_URL
  ).replace(/\/+$/, "");
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
  return request("/central/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
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
  } catch {
    return mockCentralSites();
  }
}

export async function createCentralSite(token: string, input: CreateSiteInput): Promise<{ site: CentralSite; admin: { id: number; username: string; role: string }; admin_url: string; storefront_url: string }> {
  return request("/central/sites", {
    method: "POST",
    body: JSON.stringify(input),
  }, token);
}

export async function setSiteStatus(token: string, id: number, status: CentralSite["status"]): Promise<void> {
  return request(`/central/sites/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }, token);
}

export async function getSiteBySlug(slug: string): Promise<CentralSite | null> {
  try {
    return await request<CentralSite>(`/sites/${encodeURIComponent(slug)}`);
  } catch {
    return mockCentralSites().find((s) => s.slug === slug) || null;
  }
}

export async function listSiteProducts(slug: string): Promise<Product[]> {
  try {
    // Backend endpoint: /api/v1/sites/{slug}/products
    return await request<Product[]>(`/sites/${encodeURIComponent(slug)}/products`);
  } catch {
    return [];
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
  const r = await request<{ items: CentralSiteAdmin[] }>(`/central/sites/${siteId}/admins`, {}, token);
  return r.items;
}

export async function addSiteAdmin(token: string, siteId: number, username: string, password: string, role: string): Promise<CentralSiteAdmin> {
  return request(`/central/sites/${siteId}/admins`, {
    method: "POST",
    body: JSON.stringify({ username, password, role }),
  }, token);
}

export async function removeSiteAdmin(token: string, siteId: number, adminId: number): Promise<void> {
  return request(`/central/sites/${siteId}/admins/${adminId}`, {
    method: "DELETE",
  }, token);
}

// ---------------------------------------------------------------------------
// Super-admin consolidated shop management
// ---------------------------------------------------------------------------

export async function getShop(token: string, id: number): Promise<CentralSite | null> {
  try {
    return await request<CentralSite>(`/central/sites/${id}`, {}, token);
  } catch {
    return null;
  }
}

export async function updateShopTheme(token: string, id: number, templateId: string): Promise<void> {
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
  return request(`/central/sites/${id}/branding`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }, token);
}

// --- Products (super-admin CRUD) ---

export async function listShopProducts(token: string, id: number): Promise<ShopProduct[]> {
  try {
    const r = await request<{ items: ShopProduct[] }>(`/central/sites/${id}/products`, {}, token);
    return r.items || [];
  } catch {
    return [];
  }
}

export async function createShopProduct(token: string, id: number, p: Partial<ShopProduct>): Promise<ShopProduct> {
  return request(`/central/sites/${id}/products`, {
    method: "POST",
    body: JSON.stringify(p),
  }, token);
}

export async function updateShopProduct(token: string, id: number, productId: number, p: Partial<ShopProduct>): Promise<ShopProduct> {
  return request(`/central/sites/${id}/products/${productId}`, {
    method: "PUT",
    body: JSON.stringify(p),
  }, token);
}

export async function deleteShopProduct(token: string, id: number, productId: number): Promise<void> {
  return request(`/central/sites/${id}/products/${productId}`, {
    method: "DELETE",
  }, token);
}

// --- Orders ---

export async function listShopOrders(token: string, id: number): Promise<ShopOrder[]> {
  try {
    const r = await request<{ items: ShopOrder[] }>(`/central/sites/${id}/orders`, {}, token);
    return r.items || [];
  } catch {
    return [];
  }
}

// --- Email config ---

export async function getPlatformEmailConfig(token: string): Promise<EmailConfigDTO> {
  try {
    return await request<EmailConfigDTO>(`/central/email-config`, {}, token);
  } catch {
    return { configured: false };
  }
}

export async function upsertPlatformEmailConfig(token: string, input: EmailConfigInput): Promise<EmailConfigDTO> {
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
