import type { AdminLoginResponse, Order, Product } from "@/types/api";
import { normalizeMockImages } from "@/lib/mock-images";

const now = new Date().toISOString();

export const mockProducts: Product[] = [
  {
    id: 1,
    category_id: 1,
    category_slug: "panels",
    category_name_ru: "Солнечные панели",
    slug: "panel-monocristalline-450w",
    title_ru: "Солнечная панель Mono 450 Вт",
    description_ru:
      "Монокристаллический модуль 450 Вт, КПД 21.2%. Перламутровое стекло, рама 35 мм, 25-летняя гарантия мощности.",
    price_kopecks: 4990000,
    sku: "PANEL-MONO-450",
    stock_quantity: 120,
    images: [],
    is_active: true,
    created_at: now,
    updated_at: now
  },
  {
    id: 2,
    category_id: 1,
    category_slug: "panels",
    category_name_ru: "Солнечные панели",
    slug: "panel-bifacial-550w",
    title_ru: "Бифациальная панель 550 Вт",
    description_ru:
      "Двусторонняя бифациальная панель 550 Вт. Дополнительная генерация с обратной стороны до +25%. Идеальна для наземных и плоских кровельных установок.",
    price_kopecks: 7490000,
    sku: "PANEL-BIFACIAL-550",
    stock_quantity: 64,
    images: [],
    is_active: true,
    created_at: now,
    updated_at: now
  },
  {
    id: 3,
    category_id: 2,
    category_slug: "inverters",
    category_name_ru: "Инверторы",
    slug: "inverter-hybrid-5kw",
    title_ru: "Гибридный инвертор 5 кВт",
    description_ru:
      "Гибридный инвертор 5 кВА с MPPT-контроллером, поддержкой аккумуляторов 48 В и резервным выходом. Wi-Fi мониторинг в комплекте.",
    price_kopecks: 8990000,
    sku: "INV-HYBRID-5K",
    stock_quantity: 38,
    images: [],
    is_active: true,
    created_at: now,
    updated_at: now
  },
  {
    id: 4,
    category_id: 3,
    category_slug: "batteries",
    category_name_ru: "Аккумуляторы",
    slug: "battery-lifepo4-100ah",
    title_ru: "Аккумулятор LiFePO4 100 А·ч 48 В",
    description_ru:
      "Литий-железо-фосфатный аккумулятор 100 А·ч, 48 В (4.8 кВт·ч). 6000+ циклов, встроенный BMS, защита от глубокого разряда.",
    price_kopecks: 12990000,
    sku: "BAT-LFP-100-48",
    stock_quantity: 22,
    images: [],
    is_active: true,
    created_at: now,
    updated_at: now
  },
  {
    id: 5,
    category_id: 4,
    category_slug: "mounting",
    category_name_ru: "Монтаж и крепёж",
    slug: "mounting-kit-roof-3kw",
    title_ru: "Монтажный комплект для кровли 3 кВт",
    description_ru:
      "Полный комплект алюминиевых профилей и крепежа для установки 6 панелей на скатную кровлю. Совместим с черепицей и профнастилом.",
    price_kopecks: 3490000,
    sku: "MOUNT-ROOF-3KW",
    stock_quantity: 47,
    images: [],
    is_active: true,
    created_at: now,
    updated_at: now
  },
  {
    id: 6,
    category_id: 5,
    category_slug: "services",
    category_name_ru: "Услуги монтажа",
    slug: "installation-service-residential",
    title_ru: "Монтаж солнечной электростанции под ключ (до 5 кВт)",
    description_ru:
      "Услуга монтажа residential-станции до 5 кВт. Включает выезд инженера, проект, монтаж, пусконаладку и сдачу в эксплуатацию. Гарантия на работы 3 года.",
    price_kopecks: 49990000,
    sku: "SVC-INSTALL-5KW",
    stock_quantity: 99,
    images: [],
    is_active: true,
    created_at: now,
    updated_at: now
  }
].map((product) => normalizeMockImages(product, { category: product.category_name_ru }));

export const mockOrders: Order[] = [
  {
    id: 101,
    tbank_order_id: "SUN-MOCK-101",
    tbank_payment_id: "PAY-101",
    customer_name: "Алексей К.",
    customer_email: "alexey@example.com",
    customer_phone: "+7 999 111-22-33",
    total_amount_kopecks: 13980000,
    status: "CONFIRMED",
    items: [
      {
        id: 1,
        order_id: 101,
        product_id: 1,
        product_slug: "panel-monocristalline-450w",
        product_title_ru: "Солнечная панель Mono 450 Вт",
        quantity: 2,
        price_at_purchase_kopecks: 4990000
      },
      {
        id: 2,
        order_id: 101,
        product_id: 5,
        product_slug: "mounting-kit-roof-3kw",
        product_title_ru: "Монтажный комплект для кровли 3 кВт",
        quantity: 1,
        price_at_purchase_kopecks: 3490000
      }
    ],
    created_at: now,
    updated_at: now
  },
  {
    id: 102,
    tbank_order_id: "SUN-MOCK-102",
    tbank_payment_id: "PAY-102",
    customer_name: "Мария С.",
    customer_email: "maria@example.com",
    customer_phone: "+7 999 222-33-44",
    total_amount_kopecks: 8990000,
    status: "PENDING",
    items: [
      {
        id: 3,
        order_id: 102,
        product_id: 3,
        product_slug: "inverter-hybrid-5kw",
        product_title_ru: "Гибридный инвертор 5 кВт",
        quantity: 1,
        price_at_purchase_kopecks: 8990000
      }
    ],
    created_at: now,
    updated_at: now
  }
];

export const mockAdminLogin: AdminLoginResponse = {
  token: "mock-admin-token",
  expires_at: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(),
  username: "admin"
};
