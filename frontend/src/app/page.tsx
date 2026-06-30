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

const PROMOS = [
  { title: "Outlet недели", detail: "До -18% на гибридные инверторы" },
  { title: "Для интеграторов", detail: "Оптовые прайсы и multi-store rollout" },
  { title: "T-Bank demo", detail: "Проверка checkout без live terminal" }
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
          <div className="hero-marketplace">
            <div className="hero-marketplace__main">
              <p className="eyebrow">Sun.store marketplace platform</p>
              <h1>Покупайте как на маркетплейсе. Управляйте как супер-админ.</h1>
              <p className="hero-marketplace__lead">
                Один storefront для покупателей, одна центральная панель для магазинов,
                каталогов, заказов и T-Bank checkout в demo, sandbox и live режиме.
              </p>
              <div className="hero-actions">
                <Link href={"/catalog" as Route} className="button button--primary">
                  Shop all deals
                </Link>
                <Link href={"/central/dashboard" as Route} className="button button--ghost">
                  Open super admin
                </Link>
              </div>
              <div className="hero-marketplace__trust">
                <div>
                  <strong>24/7</strong>
                  <span>Заказы и статусы в одном центре</span>
                </div>
                <div>
                  <strong>Demo + Sandbox</strong>
                  <span>Безопасная проверка платежного сценария</span>
                </div>
                <div>
                  <strong>Multi-store</strong>
                  <span>Магазины, витрины и каталоги из одной админки</span>
                </div>
              </div>
            </div>

            <aside className="hero-marketplace__rail" aria-label="Marketplace offers">
              <div className="hero-offer hero-offer--accent">
                <span className="hero-offer__tag">Featured launch</span>
                <strong>Переходите к готовому каталогу оборудования</strong>
                <p>Панели, инверторы, батареи и монтажные комплекты с плотной retail-витриной.</p>
                <Link href={"/catalog" as Route}>Смотреть каталог</Link>
              </div>
              <div className="hero-promo-grid">
                {PROMOS.map((promo) => (
                  <article key={promo.title} className="hero-promo-card">
                    <span>{promo.title}</span>
                    <strong>{promo.detail}</strong>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        </section>
        <ProductGridSkeleton count={8} />
      </div>
    );
  }

  return (
    <div className="shell home-stack">
      <section className="hero-panel hero-panel--ebay">
        <div className="hero-marketplace">
          <div className="hero-marketplace__main">
            <p className="eyebrow">Sun.store marketplace platform</p>
            <h1>Покупайте как на маркетплейсе. Управляйте как супер-админ.</h1>
            <p className="hero-marketplace__lead">
              Sun.store объединяет storefront, super admin, заказы и T-Bank checkout.
              Создавайте новые магазины, разворачивайте каталоги и тестируйте платежи
              в demo или sandbox-сценариях без отдельной сборки.
            </p>
            <div className="hero-actions">
              <Link href={"/catalog" as Route} className="button button--primary">
                Shop all deals
              </Link>
              <Link
                href={"/catalog?sort=price_asc" as Route}
                className="button button--ghost"
              >
                Лучшие цены
              </Link>
            </div>
            <div className="hero-marketplace__trust">
              <div>
                <strong>3 surfaces</strong>
                <span>Storefront, checkout и super admin</span>
              </div>
              <div>
                <strong>1 dashboard</strong>
                <span>Управление всеми магазинами и каталогами</span>
              </div>
              <div>
                <strong>T-Bank ready</strong>
                <span>Demo, sandbox и live без новой витрины</span>
              </div>
            </div>
          </div>

          <aside className="hero-marketplace__rail" aria-label="Marketplace offers">
            <div className="hero-offer hero-offer--accent">
              <span className="hero-offer__tag">Marketplace picks</span>
              <strong>Новый retail-hero в духе Amazon / eBay</strong>
              <p>Крупный value proposition слева, плотные offer cards справа и быстрый вход в каталог.</p>
              <Link href={"/central/dashboard" as Route}>Перейти в central dashboard</Link>
            </div>
            <div className="hero-promo-grid">
              {PROMOS.map((promo) => (
                <article key={promo.title} className="hero-promo-card">
                  <span>{promo.title}</span>
                  <strong>{promo.detail}</strong>
                </article>
              ))}
            </div>
          </aside>
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
