import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { ProductGridSkeleton } from "@/components/skeletons";
import { listStorefrontProducts } from "@/lib/api";

export const metadata: Metadata = {
  title: "Витрина Sun.store",
  description:
    "Витрина Sun.store для multi-store e-commerce: один super admin, несколько магазинов, единый каталог и T-Bank checkout.",
  alternates: { canonical: "/" }
};

// Revalidate storefront every 5 minutes so new products appear without a full rebuild.
export const revalidate = 300;

const CATEGORIES: Array<{ slug: string; label: string; hint: string }> = [
  { slug: "panels", label: "Солнечные панели", hint: "Монокристалл · 400–600 Вт" },
  { slug: "inverters", label: "Инверторы", hint: "Сетевые и гибридные" },
  { slug: "batteries", label: "Аккумуляторы", hint: "LiFePO4 · буфер" },
  { slug: "mounting", label: "Монтаж", hint: "Крепления и профили" }
];

export default async function HomePage() {
  let products: Awaited<ReturnType<typeof listStorefrontProducts>> = [];

  try {
    products = await listStorefrontProducts({ limit: 8, sort: "newest" });
  } catch {
    // fall back to empty state below
  }

  if (products.length === 0) {
    return (
      <div className="shell home-stack">
        <section className="hero-panel hero-panel--ebay">
          <div className="hero-copy">
            <p className="eyebrow">Витрина Sun.store / Тихая роскошь для multi-store e-commerce</p>
            <h1>Управляйте магазинами, каталогами и оплатой из одного центра.</h1>
            <p>
              Sun.store объединяет storefront, super admin, заказы и T-Bank checkout.
              Создавайте новые магазины, разворачивайте каталоги и тестируйте платежи
              в demo или sandbox-сценариях без отдельной сборки.
            </p>
            <div className="hero-actions">
              <Link href={"/catalog" as Route} className="button button--primary">
                Открыть каталог
              </Link>
              <Link href={"/admin/products" as Route} className="button button--ghost">
                Админ-панель
              </Link>
            </div>
          </div>
        </section>
        <ProductGridSkeleton count={8} />
      </div>
    );
  }

  return (
    <div className="shell home-stack">
      {/* Search-first eBay-style hero */}
      <section className="hero-panel hero-panel--ebay">
        <div className="hero-copy">
          <p className="eyebrow">Витрина Sun.store / Тихая роскошь для multi-store e-commerce</p>
          <h1>Управляйте магазинами, каталогами и оплатой из одного центра.</h1>
          <p>
            Sun.store объединяет storefront, super admin, заказы и T-Bank checkout.
            Создавайте новые магазины, разворачивайте каталоги и тестируйте платежи
            в demo или sandbox-сценариях без отдельной сборки.
          </p>
          <div className="hero-actions">
            <Link href={"/catalog" as Route} className="button button--primary">
              Перейти к покупкам
            </Link>
            <Link
              href={"/catalog?sort=price_asc" as Route}
              className="button button--ghost"
            >
              Самые дешёвые
            </Link>
          </div>
        </div>
      </section>

      {/* Category browse tiles */}
      <section className="cat-tiles">
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/catalog?category=${c.slug}` as Route}
            className="cat-tile"
          >
            <span className="cat-tile__label">{c.label}</span>
            <span className="cat-tile__hint">{c.hint}</span>
          </Link>
        ))}
      </section>

      {/* Dense product grid */}
      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Свежие поступления</p>
            <h2>Новые товары</h2>
          </div>
          <Link href={"/catalog" as Route} className="button button--ghost">
            Весь каталог
          </Link>
        </div>
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
