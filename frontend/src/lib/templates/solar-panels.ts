/**
 * Solar Panels theme — the flagship "main shop" theme for Sun.store.
 *
 * Designed for selling solar panels, inverters, batteries, mounting kits
 * and related installation services. Bold amber-on-charcoal palette evokes
 * sunlight harvesting, technical credibility, and residential trust.
 */

import type { Template } from "./types";

const baseTypography = {
  bodyFont: "'Manrope', system-ui, sans-serif",
  bodyWeight: 400,
  baseSize: "16px",
  scaleRatio: 1.25,
};

const baseSpacing = {
  shellMaxWidth: "1280px",
  sectionPadding: "6rem",
  cardRadius: "12px",
  buttonRadius: "8px",
};

export const SOLAR_PANELS_TEMPLATE: Template = {
  id: "solar-panels",
  name: "Солнечные панели",
  niche: "Солнечная энергетика",
  description:
    "Солнечные панели, инверторы, аккумуляторы и монтажные комплекты для дома и бизнеса",
  colors: {
    background: "#0E0F12",
    surface: "#15171C",
    surfaceAlt: "#1B1E25",
    text: "#F5F6F7",
    textMuted: "#9AA0AB",
    accent: "#F59E0B",
    accentText: "#0E0F12",
    border: "#262A33",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444"
  },
  typography: {
    ...baseTypography,
    displayFont: "'Space Grotesk', 'Manrope', system-ui, sans-serif",
    displayWeight: 700
  },
  spacing: baseSpacing,
  branding: {
    storeName: "SunVolt",
    tagline: "Энергия солнца — в каждый дом",
    description:
      "Солнечные электростанции под ключ: панели, инверторы, аккумуляторы и монтаж.",
    logoMark: "☀",
    iconColor: "#F59E0B"
  },
  categories: [
    { id: "panels", name: "Солнечные панели", description: "Mono/Poly модули 100–600 Вт" },
    { id: "inverters", name: "Инверторы", description: "Сетевые, гибридные, автономные" },
    { id: "batteries", name: "Аккумуляторы", description: "LiFePO4, AGM, GEL" },
    { id: "mounting", name: "Монтаж и крепёж", description: "Профили, кронштейны, кабель" },
    { id: "services", name: "Услуги монтажа", description: "Проектирование и установка под ключ" }
  ],
  products: [
    {
      id: "sp-001",
      slug: "panel-monocristalline-450w",
      title: "Солнечная панель Mono 450 Вт",
      description:
        "Монокристаллический модуль 450 Вт, КПД 21.2%. Перламутровое стекло, рама 35 мм, 25-летняя гарантия мощности.",
      price_kopecks: 4990000,
      sku: "PANEL-MONO-450",
      stock_quantity: 120,
      images: [
        "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80",
        "https://images.unsplash.com/photo-1543385366-9c6e8c3a7f95?w=800&q=80"
      ],
      category_id: "panels",
      is_active: true
    },
    {
      id: "sp-002",
      slug: "panel-bifacial-550w",
      title: "Бифациальная панель 550 Вт",
      description:
        "Двусторонняя бифациальная панель 550 Вт. Дополнительная генерация с обратной стороны до +25%. Идеальна для наземных и плоских кровельных установок.",
      price_kopecks: 7490000,
      sku: "PANEL-BIFACIAL-550",
      stock_quantity: 64,
      images: [
        "https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&q=80"
      ],
      category_id: "panels",
      is_active: true
    },
    {
      id: "sp-003",
      slug: "inverter-hybrid-5kw",
      title: "Гибридный инвертор 5 кВт",
      description:
        "Гибридный инвертор 5 кВА с MPPT-контроллером, поддержкой аккумуляторов 48 В и резервным выходом. Wi-Fi мониторинг в комплекте.",
      price_kopecks: 8990000,
      sku: "INV-HYBRID-5K",
      stock_quantity: 38,
      images: [
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80"
      ],
      category_id: "inverters",
      is_active: true
    },
    {
      id: "sp-004",
      slug: "battery-lifepo4-100ah",
      title: "Аккумулятор LiFePO4 100 А·ч 48 В",
      description:
        "Литий-железо-фосфатный аккумулятор 100 А·ч, 48 В (4.8 кВт·ч). 6000+ циклов, встроенный BMS, защита от глубокого разряда.",
      price_kopecks: 12990000,
      sku: "BAT-LFP-100-48",
      stock_quantity: 22,
      images: [
        "https://images.unsplash.com/photo-1620283085439-39620a1e21c4?w=800&q=80"
      ],
      category_id: "batteries",
      is_active: true
    },
    {
      id: "sp-005",
      slug: "mounting-kit-roof-3kw",
      title: "Монтажный комплект для кровли 3 кВт",
      description:
        "Полный комплект алюминиевых профилей и крепежа для установки 6 панелей на скатную кровлю. Совместим с черепицей и профнастилом.",
      price_kopecks: 3490000,
      sku: "MOUNT-ROOF-3KW",
      stock_quantity: 47,
      images: [
        "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800&q=80"
      ],
      category_id: "mounting",
      is_active: true
    },
    {
      id: "sp-006",
      slug: "installation-service-residential",
      title: "Монтаж солнечной электростанции под ключ (до 5 кВт)",
      description:
        "Услуга монтажа residential-станции до 5 кВт. Включает выезд инженера, проект, монтаж, пусконаладку и сдачу в эксплуатацию. Гарантия на работы 3 года.",
      price_kopecks: 49990000,
      sku: "SVC-INSTALL-5KW",
      stock_quantity: 99,
      images: [
        "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?w=800&q=80"
      ],
      category_id: "services",
      is_active: true
    }
  ],
  heroCopy: {
    eyebrow: "SunVolt / Solar Energy",
    headline: "Солнечная электростанция под ключ — экономия на счетах до 90%",
    subhead:
      "Солнечные панели, инверторы и аккумуляторы с гарантией 25 лет. Проектирование, монтаж и сервис по всей России.",
    ctaPrimary: "Выбрать комплект",
    ctaSecondary: "Рассчитать окупаемость"
  },
  sections: {
    showFeatured: true,
    showCollections: true,
    showTestimonials: true,
    showNewsletter: true
  }
};
