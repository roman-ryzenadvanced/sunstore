"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ShoppingBag, Store, ArrowLeft, PackageOpen } from "lucide-react";

import { getSiteBySlug, CentralSite, listSiteProducts } from "@/lib/multi-site/api";
import { useCartStore } from "@/store/cart";
import { TEMPLATES } from "@/lib/templates/templates";
import type { Template } from "@/lib/templates/types";
import { formatPrice } from "@/lib/format";
import { toast } from "@/components/toaster";
import { Skeleton } from "@/components/skeletons";
import type { Product } from "@/types/api";

import "./storefront.css";

export default function PerSiteStorefront() {
  const params = useParams();
  const slug = String(params?.siteSlug || "");
  const [site, setSite] = useState<CentralSite | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.open);
  const cartCount = useCartStore((s) =>
    s.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    Promise.all([getSiteBySlug(slug), listSiteProducts(slug)])
      .then(([s, p]) => {
        setSite(s);
        // Hydrate products from localStorage if backend returned nothing.
        if ((!p || p.length === 0) && typeof window !== "undefined") {
          const raw = window.localStorage.getItem(`sunstore-site-products-${slug}`);
          if (raw) {
            try {
              setProducts(JSON.parse(raw));
              return;
            } catch {
              // ignore
            }
          }
        }
        setProducts(p || []);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const template = useMemo(
    () => TEMPLATES.find((t) => t.id === site?.template_id),
    [site]
  );

  // Inject template tokens as CSS variables on this subtree.
  const themeVars = useMemo(() => {
    if (!template) return {};
    const c = template.colors;
    const t = template.typography;
    const s = template.spacing;
    return {
      ["--site-bg" as string]: c.background,
      ["--site-surface" as string]: c.surface,
      ["--site-surface-alt" as string]: c.surfaceAlt,
      ["--site-text" as string]: c.text,
      ["--site-text-muted" as string]: c.textMuted,
      ["--site-accent" as string]: c.accent,
      ["--site-accent-text" as string]: c.accentText,
      ["--site-border" as string]: c.border,
      ["--site-success" as string]: c.success,
      ["--site-warning" as string]: c.warning,
      ["--site-danger" as string]: c.danger,
      ["--site-display-font" as string]: t.displayFont,
      ["--site-body-font" as string]: t.bodyFont,
      ["--site-display-weight" as string]: String(t.displayWeight),
      ["--site-shell" as string]: s.shellMaxWidth,
      ["--site-radius-card" as string]: s.cardRadius,
      ["--site-radius-button" as string]: s.buttonRadius
    } as React.CSSProperties;
  }, [template]);

  if (loading) {
    return (
      <main className="site-storefront site-storefront--loading">
        <div className="site-storefront__loading">
          <Skeleton style={{ height: 60, width: 200 }} />
          <Skeleton style={{ height: 30, width: "60%" }} />
          <Skeleton style={{ height: 200, width: "100%" }} />
        </div>
      </main>
    );
  }

  if (!site || !template) {
    return (
      <main className="site-storefront site-storefront--notfound">
        <div className="site-storefront__notfound">
          <PackageOpen size={48} aria-hidden="true" />
          <h1>Сайт не найден</h1>
          <p className="muted">Магазин с адресом /{slug} не существует.</p>
          <Link href="/central/setup" className="button button--primary">
            Создать магазин
          </Link>
        </div>
      </main>
    );
  }

  // Solar panels theme uses an enhanced storefront layout.
  if (template.id === "solar-panels") {
    return (
      <SolarStorefront
        site={site}
        template={template}
        products={products}
        addItem={addItem}
        openCart={openCart}
        cartCount={cartCount}
      />
    );
  }

  const c = template.colors;
  const t = template.typography;
  const b = template.branding;

  return (
    <main
      className="site-storefront"
      style={themeVars}
      data-template={template.id}
    >
      <header className="site-storefront__header">
        <Link href={`/sites/${slug}`} className="site-storefront__brand">
          <span
            className="site-storefront__logo"
            aria-hidden="true"
            style={{ color: c.accent }}
          >
            {b.logoMark}
          </span>
          <div>
            <p className="site-storefront__brand-name">{b.storeName}</p>
            <p className="site-storefront__brand-tagline">{b.tagline}</p>
          </div>
        </Link>
        <div className="site-storefront__actions">
          <button
            onClick={openCart}
            className="site-storefront__cart"
            aria-label={`Корзина, ${cartCount} товаров`}
          >
            <ShoppingBag size={16} aria-hidden="true" />
            <span>Корзина</span>
            <span className="site-storefront__cart-count">{cartCount}</span>
          </button>
          <Link
            href="/central/dashboard"
            className="site-storefront__admin-link"
          >
            <Store size={14} aria-hidden="true" /> Super Admin
          </Link>
        </div>
      </header>

      <section className="site-storefront__hero">
        <p className="site-storefront__hero-eyebrow">
          {template.heroCopy.eyebrow}
        </p>
        <h1 className="site-storefront__hero-title">
          {template.heroCopy.headline}
        </h1>
        <p className="site-storefront__hero-subhead">
          {template.heroCopy.subhead}
        </p>
        <button
          onClick={() =>
            document
              .getElementById("site-products")
              ?.scrollIntoView({ behavior: "smooth" })
          }
          className="site-storefront__cta"
        >
          {template.heroCopy.ctaPrimary}
        </button>
      </section>

      <section id="site-products" className="site-storefront__catalog">
        <h2 className="site-storefront__section-title">Каталог</h2>
        {products.length === 0 ? (
          <div className="site-storefront__empty">
            <PackageOpen size={32} aria-hidden="true" />
            <p>Пока нет товаров. Добавьте их через супер-админ панель.</p>
            <Link
              href="/central/dashboard"
              className="site-storefront__cta"
            >
              Открыть супер-админ панель
            </Link>
          </div>
        ) : (
          <div className="site-storefront__grid">
            {products.map((p) => {
              const outOfStock = p.stock_quantity <= 0;
              return (
                <article key={p.id} className="site-storefront__product">
                  <div className="site-storefront__product-media">
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.images[0]}
                        alt={p.title_ru || p.slug}
                        loading="lazy"
                      />
                    ) : (
                      <div className="site-storefront__product-placeholder">
                        {b.logoMark}
                      </div>
                    )}
                    {outOfStock ? (
                      <span className="site-storefront__product-badge site-storefront__product-badge--out">
                        Нет в наличии
                      </span>
                    ) : null}
                  </div>
                  <div className="site-storefront__product-body">
                    <p className="site-storefront__product-title">
                      {p.title_ru || p.slug}
                    </p>
                    {p.description_ru ? (
                      <p className="site-storefront__product-desc">
                        {p.description_ru}
                      </p>
                    ) : null}
                    <div className="site-storefront__product-foot">
                      <span className="site-storefront__product-price">
                        {formatPrice(p.price_kopecks)}
                      </span>
                      <button
                        onClick={() => {
                          if (outOfStock) {
                            toast.warning("Нет в наличии");
                            return;
                          }
                          addItem(p);
                          toast.success("Добавлено в корзину", p.title_ru);
                        }}
                        disabled={outOfStock}
                        className="site-storefront__product-buy"
                        aria-label={`Добавить в корзину: ${p.title_ru}`}
                      >
                        {outOfStock ? "Нет" : "В корзину"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="site-storefront__footer">
        <div>
          <Link href={`/sites/${slug}`} className="site-storefront__footer-brand">
            {b.logoMark} {b.storeName}
          </Link>
          <p className="muted">{b.tagline}</p>
        </div>
        <p className="muted site-storefront__footer-powered">
          Powered by <Link href="/">Sun.store</Link> ·{" "}
          <Link href="/central/dashboard">Super Admin</Link>
        </p>
      </footer>
    </main>
  );
}

// ===========================================================================
// SolarStorefront — flagship solar panels theme (amber-on-charcoal)
// ===========================================================================

function SolarStorefront({
  site, template, products, addItem, openCart, cartCount
}: {
  site: CentralSite;
  template: Template;
  products: Product[];
  addItem: (p: Product) => void;
  openCart: () => void;
  cartCount: number;
}) {
  const c = template.colors;
  const b = template.branding;
  const hero = template.heroCopy;

  // Group products by category for the catalog section.
  const byCategory = (products.length > 0 ? products : template.products.map((p) => ({
    id: Number(p.id.replace(/\D/g, "") || 0),
    slug: p.slug,
    title_ru: p.title,
    description_ru: p.description,
    price_kopecks: p.price_kopecks,
    sku: p.sku,
    stock_quantity: p.stock_quantity,
    images: p.images,
    category_name_ru: p.category_id,
    is_active: p.is_active
  }) as unknown as Product)).reduce((acc, p) => {
    const cat = (p as any).category_name_ru || (p as any).category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {} as Record<string, Product[]>);

  const themeVars = {
    ["--site-bg"]: c.background,
    ["--site-surface"]: c.surface,
    ["--site-surface-alt"]: c.surfaceAlt,
    ["--site-text"]: c.text,
    ["--site-text-muted"]: c.textMuted,
    ["--site-accent"]: c.accent,
    ["--site-accent-text"]: c.accentText,
    ["--site-border"]: c.border,
  } as React.CSSProperties;

  return (
    <main
      className="site-storefront solar-storefront"
      style={themeVars}
      data-template={template.id}
    >
      <header className="solar-header">
        <Link href={`/sites/${site.slug}`} className="solar-brand">
          <span className="solar-brand__mark" aria-hidden="true" style={{ color: c.accent }}>
            {b.logoMark}
          </span>
          <div>
            <p className="solar-brand__name">{b.storeName}</p>
            <p className="solar-brand__tagline">{b.tagline}</p>
          </div>
        </Link>
        <nav className="solar-nav">
          <a href="#catalog">Каталог</a>
          <a href="#benefits">Преимущества</a>
          <a href="#calculator">Калькулятор</a>
          <a href="#contact">Контакты</a>
        </nav>
        <div className="solar-actions">
          <button onClick={openCart} className="solar-cart" aria-label={`Корзина, ${cartCount} товаров`}>
            <ShoppingBag size={16} /> <span>Корзина</span>
            <span className="solar-cart__count">{cartCount}</span>
          </button>
          <Link href="/central/dashboard" className="solar-admin-link">
            Super Admin
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="solar-hero">
        <div className="solar-hero__bg" aria-hidden="true" />
        <div className="solar-hero__copy">
          <p className="solar-hero__eyebrow">{hero.eyebrow}</p>
          <h1 className="solar-hero__title">{hero.headline}</h1>
          <p className="solar-hero__subhead">{hero.subhead}</p>
          <div className="solar-hero__actions">
            <a href="#catalog" className="solar-btn solar-btn--primary">{hero.ctaPrimary}</a>
            <a href="#calculator" className="solar-btn solar-btn--ghost">{hero.ctaSecondary}</a>
          </div>
          <div className="solar-hero__stats">
            <div><strong>25 лет</strong><span>гарантия на панели</span></div>
            <div><strong>3 года</strong><span>гарантия на монтаж</span></div>
            <div><strong>90%</strong><span>экономия на счетах</span></div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section id="benefits" className="solar-section">
        <h2 className="solar-section__title">Почему выбирают нас</h2>
        <div className="solar-benefits">
          <article className="solar-benefit">
            <div className="solar-benefit__icon" style={{ color: c.accent }}>☀</div>
            <h3>Высокий КПД</h3>
            <p>Монокристаллические панели с КПД до 21.2% — максимум энергии с каждого квадратного метра кровли.</p>
          </article>
          <article className="solar-benefit">
            <div className="solar-benefit__icon" style={{ color: c.accent }}>⚙</div>
            <h3>Под ключ</h3>
            <p>Проектирование, поставка оборудования, монтаж и пусконаладка. Без скрытых платежей.</p>
          </article>
          <article className="solar-benefit">
            <div className="solar-benefit__icon" style={{ color: c.accent }}>⚡</div>
            <h3>Резервное питание</h3>
            <p>Гибридные инверторы с аккумуляторами — ваш дом не останется без электричества при отключениях.</p>
          </article>
          <article className="solar-benefit">
            <div className="solar-benefit__icon" style={{ color: c.accent }}>🔧</div>
            <h3>Сервис 24/7</h3>
            <p>Удалённый мониторинг генерации через Wi-Fi, выезд сервисной бригады в течение 48 часов.</p>
          </article>
        </div>
      </section>

      {/* CATALOG */}
      <section id="catalog" className="solar-section">
        <h2 className="solar-section__title">Каталог оборудования</h2>
        {Object.keys(byCategory).length === 0 ? (
          <div className="solar-empty">
            <PackageOpen size={32} aria-hidden="true" />
            <p>Каталог скоро будет наполнен. Загляните позже или откройте супер-админ панель, чтобы добавить товары.</p>
          </div>
        ) : (
          Object.entries(byCategory).map(([cat, items]) => {
            const catMeta = template.categories.find((x) => x.id === cat);
            return (
              <div key={cat} className="solar-cat">
                <h3 className="solar-cat__title">
                  {catMeta?.name || cat}
                  <span className="solar-cat__count">{items.length} тов.</span>
                </h3>
                <div className="solar-grid">
                  {items.map((p) => {
                    const outOfStock = (p as any).stock_quantity <= 0;
                    const img = p.images?.[0];
                    return (
                      <article key={p.id} className="solar-product">
                        <div className="solar-product__media">
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img} alt={p.title_ru || p.slug} loading="lazy" />
                          ) : (
                            <div className="solar-product__placeholder">{b.logoMark}</div>
                          )}
                          {outOfStock && (
                            <span className="solar-product__badge">Нет в наличии</span>
                          )}
                        </div>
                        <div className="solar-product__body">
                          <p className="solar-product__title">{p.title_ru || p.slug}</p>
                          {p.description_ru && (
                            <p className="solar-product__desc">{p.description_ru}</p>
                          )}
                          <div className="solar-product__foot">
                            <span className="solar-product__price">
                              {formatPrice(p.price_kopecks)}
                            </span>
                            <button
                              onClick={() => {
                                if (outOfStock) { toast.warning("Нет в наличии"); return; }
                                addItem(p);
                                toast.success("Добавлено в корзину", p.title_ru);
                              }}
                              disabled={outOfStock}
                              className="solar-btn solar-btn--primary solar-btn--sm"
                            >
                              {outOfStock ? "Нет" : "В корзину"}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* CALCULATOR CTA */}
      <section id="calculator" className="solar-section solar-section--cta">
        <div className="solar-cta-card">
          <h2>Рассчитайте окупаемость за 60 секунд</h2>
          <p>Введите ежемесячный счёт за электричество — покажем, за сколько лет окупится солнечная станция.</p>
          <Link href="/central/dashboard" className="solar-btn solar-btn--primary">
            Оставить заявку
          </Link>
        </div>
      </section>

      {/* CONTACT FOOTER */}
      <footer id="contact" className="solar-footer">
        <div>
          <p className="solar-footer__brand">{b.logoMark} {b.storeName}</p>
          <p className="solar-footer__tagline">{b.tagline}</p>
        </div>
        <div className="solar-footer__contact">
          <p>Тел: <a href="tel:+78001234567">8 800 123-45-67</a></p>
          <p>Email: <a href="mailto:hello@sunvolt.ru">hello@sunvolt.ru</a></p>
          <p>Пн–Вс: 9:00 — 21:00</p>
        </div>
        <p className="solar-footer__powered">
          Powered by <Link href="/">Sun.store</Link> ·{" "}
          <Link href="/central/dashboard">Super Admin</Link>
        </p>
      </footer>
    </main>
  );
}
