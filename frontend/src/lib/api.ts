import {
  mockAdminLogin,
  mockOrders,
  mockProducts
} from "@/lib/mock-data";
import type {
  AdminLoginResponse,
  AdminProductQuery,
  ApiEnvelope,
  CatalogQuery,
  CheckoutRequest,
  CheckoutResponse,
  Order,
  OrderStatus,
  Product,
  ProductSort,
  UpsertProductInput
} from "@/types/api";

const DEFAULT_API_BASE_URL = "http://localhost:8080/api/v1";
const ENABLE_DEMO_FALLBACKS =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACKS === "true";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    DEFAULT_API_BASE_URL
  ).replace(/\/+$/, "");
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }

  const result = search.toString();
  return result ? `?${result}` : "";
}

async function request<T>(
  path: string,
  init?: RequestInit & {
    token?: string;
  }
) {
  const headers = new Headers(init?.headers);

  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  if (init?.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | CheckoutResponse
    | null;

  if (!response.ok) {
    const message =
      (payload &&
        "error" in payload &&
        typeof payload.error === "string" &&
        payload.error) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  if (payload && "data" in payload) {
    return payload.data;
  }

  return payload as T;
}

function sortProducts(products: Product[], sort: ProductSort = "newest") {
  const sorted = [...products];

  sorted.sort((a, b) => {
    switch (sort) {
      case "price_asc":
        return a.price_kopecks - b.price_kopecks;
      case "price_desc":
        return b.price_kopecks - a.price_kopecks;
      case "title_asc":
        return a.title_ru.localeCompare(b.title_ru, "ru");
      case "newest":
      default:
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  });

  return sorted;
}

function filterProducts(products: Product[], query: CatalogQuery | AdminProductQuery) {
  let output = [...products];

  if (query.category) {
    output = output.filter((product) => product.category_slug === query.category);
  }

  if ("search" in query && query.search) {
    const needle = query.search.toLowerCase();
    output = output.filter((product) =>
      [product.title_ru, product.description_ru, product.sku]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }

  output = sortProducts(output, query.sort);

  const offset = query.offset ?? 0;
  const limit = query.limit ?? output.length;
  return output.slice(offset, offset + limit);
}

export async function listStorefrontProducts(query: CatalogQuery = {}) {
  try {
    return await request<Product[]>(
      `/products${buildQuery({
        category: query.category,
        search: query.search,
        sort: query.sort,
        limit: query.limit,
        offset: query.offset
      })}`
    );
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) {
      throw error;
    }
    return filterProducts(
      mockProducts.filter((product) => product.is_active),
      query
    );
  }
}

export async function getStorefrontProduct(slug: string) {
  try {
    return await request<Product>(`/products/${slug}`);
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) {
      throw error;
    }
    const product = mockProducts.find((entry) => entry.slug === slug);
    if (!product) {
      throw new ApiError("Товар не найден", 404);
    }
    return product;
  }
}

export async function adminLogin(username: string, password: string) {
  try {
    return await request<AdminLoginResponse>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) {
      throw error;
    }
    if (!username.trim() || !password.trim()) {
      throw new ApiError("Введите логин и пароль", 400);
    }
    return mockAdminLogin;
  }
}

export async function listAdminProducts(
  token: string,
  query: AdminProductQuery = {}
) {
  try {
    return await request<Product[]>(
      `/admin/products${buildQuery({
        category: query.category,
        search: query.search,
        sort: query.sort,
        limit: query.limit,
        offset: query.offset
      })}`,
      { token }
    );
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) {
      throw error;
    }
    return filterProducts(mockProducts, query);
  }
}

export async function createAdminProduct(token: string, input: UpsertProductInput) {
  try {
    return await request<Product>("/admin/products", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) {
      throw error;
    }
    return {
      id: Date.now(),
      category_id: input.category_id,
      category_slug: null,
      category_name_ru: null,
      slug: input.slug,
      title_ru: input.title_ru,
      description_ru: input.description_ru,
      price_kopecks: input.price_kopecks,
      sku: input.sku,
      stock_quantity: input.stock_quantity,
      images: input.images,
      is_active: input.is_active,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
}

export async function updateAdminProduct(
  token: string,
  id: number,
  input: UpsertProductInput
) {
  try {
    return await request<Product>(`/admin/products/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify(input)
    });
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) {
      throw error;
    }
    return {
      id,
      category_id: input.category_id,
      category_slug: null,
      category_name_ru: null,
      slug: input.slug,
      title_ru: input.title_ru,
      description_ru: input.description_ru,
      price_kopecks: input.price_kopecks,
      sku: input.sku,
      stock_quantity: input.stock_quantity,
      images: input.images,
      is_active: input.is_active,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
}

export async function deleteAdminProduct(token: string, id: number) {
  try {
    await request<{ success: true }>(`/admin/products/${id}`, {
      method: "DELETE",
      token
    });
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) {
      throw error;
    }
    return { success: true, id };
  }
  return { success: true, id };
}

export async function listAdminOrders(token: string, status?: OrderStatus) {
  try {
    return await request<Order[]>(
      `/admin/orders${buildQuery({
        status
      })}`,
      { token }
    );
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) {
      throw error;
    }
    return status ? mockOrders.filter((order) => order.status === status) : mockOrders;
  }
}

export async function checkoutInit(payload: CheckoutRequest) {
  try {
    return await request<CheckoutResponse>("/checkout/init", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  } catch (error) {
    if (!ENABLE_DEMO_FALLBACKS) {
      throw error;
    }
    return {
      success: true,
      payment_url: `/checkout/status?status=mock&order=MOCK-${Date.now()}`,
      order_id: `MOCK-${Date.now()}`
    };
  }
}
