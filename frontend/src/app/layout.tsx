import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import { CartDrawer } from "@/components/cart-drawer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/toaster";

import "./globals.css";

// Single geometric humanist typeface (close cousin of Yandex "YS Text" and
// Sberbank "SB Sans") with full Cyrillic coverage. Hierarchy is built from
// weight + size rather than a second family, the way both reference sites do.
const manrope = Manrope({
  subsets: ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap'
});

export const metadata: Metadata = {
  title: {
    default: "Витрина Sun.store",
    template: "%s · Sun.store"
  },
  description:
    "Витрина Sun.store: единая платформа для управления магазинами, каталогами, заказами и оплатой через T-Bank.",
  keywords: [
    "Sun.store",
    "Витрина Sun.store",
    "маркетплейс",
    "интернет-магазин",
    "T-Bank",
    "super admin"
  ],
  authors: [{ name: "Sun.store" }],
  openGraph: {
    title: "Витрина Sun.store",
    description:
      "Единая платформа для storefront, multi-store управления и оплат через T-Bank.",
    type: "website",
    locale: "ru_RU"
  },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={manrope.variable}>
      <body>
        <div className="page-chrome" />
        <SiteHeader />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
        <CartDrawer />
        <Toaster />
      </body>
    </html>
  );
}
