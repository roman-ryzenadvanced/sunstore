import type { Route } from "next";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell site-footer__inner">
        <div className="site-footer__brand">
          <p className="eyebrow">Sun.store marketplace</p>
          <h3>Мульти-магазинная e-commerce платформа с единым супер-админом.</h3>
          <p>
            Каталоги, storefront, заказы, подписчики и T-Bank checkout в одной
            retail-системе.
          </p>
        </div>
        <div className="site-footer__columns">
          <div className="site-footer__group">
            <strong>Покупателям</strong>
            <nav className="site-footer__nav" aria-label="Покупателям">
              <Link href={"/catalog" as Route}>Все товары</Link>
              <Link href={"/checkout" as Route}>Checkout</Link>
              <Link href={"/admin/orders" as Route}>Статусы заказов</Link>
            </nav>
          </div>
          <div className="site-footer__group">
            <strong>Управление</strong>
            <nav className="site-footer__nav" aria-label="Управление">
              <Link href={"/central/login" as Route}>Central platform</Link>
              <Link href={"/central/setup" as Route}>Создать магазин</Link>
              <Link href={"/admin/login" as Route}>Store admin</Link>
            </nav>
          </div>
          <div className="site-footer__group">
            <strong>Платежи</strong>
            <nav className="site-footer__nav" aria-label="Платежи">
              <Link href={"/checkout/status?status=mock" as Route}>Demo flow</Link>
              <Link href={"/central/orders" as Route}>Order desk</Link>
              <Link href={"/central/dashboard" as Route}>Super admin dashboard</Link>
            </nav>
          </div>
        </div>
      </div>
      <div className="shell site-footer__bottom">
        <p className="site-footer__copyright">
          © {new Date().getFullYear()} Sun.store
        </p>
        <p className="site-footer__legal">
          Marketplace-style storefront for preview, catalog orchestration and payment testing.
        </p>
      </div>
    </footer>
  );
}
