export type ProductSort = "newest" | "price_asc" | "price_desc" | "title_asc";

export type OrderStatus =
  | "NEW"
  | "PENDING"
  | "AUTHORIZED"
  | "CONFIRMED"
  | "REJECTED"
  | "REFUNDED";

export interface Product {
  id: number;
  site_id?: number | null;
  site_slug?: string | null;
  site_name?: string | null;
  category_id?: number | null;
  category_slug?: string | null;
  category_name_ru?: string | null;
  slug: string;
  title_ru: string;
  description_ru: string;
  price_kopecks: number;
  sku: string;
  stock_quantity: number;
  images: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id?: number | null;
  product_slug?: string;
  product_title_ru?: string;
  quantity: number;
  price_at_purchase_kopecks: number;
}

export interface Order {
  id: number;
  tbank_order_id: string;
  tbank_payment_id?: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount_kopecks: number;
  status: OrderStatus;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface AdminLoginResponse {
  token: string;
  expires_at: string;
  username: string;
}

export interface CheckoutItemInput {
  product_id: number;
  quantity: number;
}

export interface CheckoutRequest {
  customer_name: string;
  email: string;
  phone: string;
  site_slug?: string;
  items: CheckoutItemInput[];
}

export interface CheckoutResponse {
  success: boolean;
  payment_url: string;
  order_id: string;
}

export interface UpsertProductInput {
  category_id: number | null;
  slug: string;
  title_ru: string;
  description_ru: string;
  price_kopecks: number;
  sku: string;
  stock_quantity: number;
  images: string[];
  is_active: boolean;
}

export interface ListMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: ListMeta;
  error?: string;
}

export interface CatalogQuery {
  category?: string;
  search?: string;
  sort?: ProductSort;
  limit?: number;
  offset?: number;
}

export interface AdminProductQuery extends CatalogQuery {
  search?: string;
}
