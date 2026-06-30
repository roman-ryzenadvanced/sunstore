"use client";

import { useMemo, useState } from "react";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { checkoutInit } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { useCartStore } from "@/store/cart";
import { toast } from "@/components/toaster";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Russian phone: +7 XXX XXX-XX-XX, with optional spaces/dashes.
const PHONE_RE = /^\+?\d[\d\s\-()]{9,18}$/;

export function CheckoutForm() {
  const items = useCartStore((state) => state.items);
  const clear = useCartStore((state) => state.clear);
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
  }>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const total = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + item.product.price_kopecks * item.quantity,
        0
      ),
    [items]
  );

  const isEmpty = items.length === 0;
  const siteScope = useMemo(() => {
    const siteSlugs = Array.from(
      new Set(items.map((item) => item.product.site_slug).filter(Boolean))
    ) as string[];
    const hasGlobalItems = items.some((item) => !item.product.site_slug);
    return {
      siteSlug: siteSlugs.length === 1 ? siteSlugs[0] : undefined,
      mixed: siteSlugs.length > 1 || (siteSlugs.length === 1 && hasGlobalItems)
    };
  }, [items]);

  function validateField(field: "name" | "email" | "phone", value: string) {
    setErrors((prev) => {
      const next = { ...prev };
      if (field === "name") {
        next.name = value.trim().length < 2 ? "Минимум 2 символа" : undefined;
      } else if (field === "email") {
        next.email = !EMAIL_RE.test(value) ? "Некорректный email" : undefined;
      } else if (field === "phone") {
        next.phone = !PHONE_RE.test(value) ? "Некорректный телефон" : undefined;
      }
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const newErrors: typeof errors = {};
    if (customerName.trim().length < 2) newErrors.name = "Минимум 2 символа";
    if (!EMAIL_RE.test(email)) newErrors.email = "Некорректный email";
    if (!PHONE_RE.test(phone)) newErrors.phone = "Некорректный телефон";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      toast.error("Проверьте поля формы");
      return;
    }

    if (isEmpty) {
      setError("Добавьте товары в корзину перед оформлением.");
      return;
    }
    if (siteScope.mixed) {
      const message =
        "Нельзя оформить одним заказом товары из разных магазинов и общего каталога.";
      setError(message);
      toast.error("Разделите корзину", message);
      return;
    }

    setLoading(true);

    try {
      const response = await checkoutInit({
        customer_name: customerName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        site_slug: siteScope.siteSlug,
        items: items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity
        }))
      });

      clear();
      toast.success("Заказ создан", `Перенаправляем к оплате…`);
      // Brief delay so the toast is visible.
      setTimeout(() => {
        window.location.assign(response.payment_url);
      }, 400);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Не удалось создать заказ";
      setError(message);
      toast.error("Ошибка оформления", message);
    } finally {
      setLoading(false);
    }
  }

  if (isEmpty) {
    return (
      <div className="checkout-grid">
        <section className="checkout-card checkout-card--empty">
          <p className="eyebrow">Корзина пуста</p>
          <h1>Нечего оформлять</h1>
          <p className="muted">
            Добавьте товары в корзину, чтобы перейти к оформлению заказа.
          </p>
          <Link
            href={"/catalog" as Route}
            className="button button--primary"
          >
            Перейти в каталог
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="checkout-grid">
      <form className="checkout-card" onSubmit={handleSubmit} noValidate>
        <div>
          <p className="eyebrow">Оформление заказа</p>
          <h1>Контактные данные</h1>
          <p className="muted">
            Мы отправим подтверждение и ссылку на оплату через T-Bank.
          </p>
          {siteScope.siteSlug ? (
            <p className="muted">Магазин: <code>{siteScope.siteSlug}</code></p>
          ) : null}
        </div>

        <label className={`field ${errors.name ? "field--error" : ""}`}>
          <span>Имя *</span>
          <input
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value);
              validateField("name", e.target.value);
            }}
            autoComplete="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "err-name" : undefined}
          />
          {errors.name ? (
            <span id="err-name" className="error-text">
              {errors.name}
            </span>
          ) : null}
        </label>

        <label className={`field ${errors.email ? "field--error" : ""}`}>
          <span>Email *</span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              validateField("email", e.target.value);
            }}
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "err-email" : undefined}
          />
          {errors.email ? (
            <span id="err-email" className="error-text">
              {errors.email}
            </span>
          ) : null}
        </label>

        <label className={`field ${errors.phone ? "field--error" : ""}`}>
          <span>Телефон *</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              validateField("phone", e.target.value);
            }}
            autoComplete="tel"
            placeholder="+7 999 123-45-67"
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "err-phone" : undefined}
          />
          {errors.phone ? (
            <span id="err-phone" className="error-text">
              {errors.phone}
            </span>
          ) : null}
        </label>

        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="button button--primary"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="spin" aria-hidden="true" />{" "}
              Создаём заказ…
            </>
          ) : (
            <>
              <Lock size={16} aria-hidden="true" /> Перейти к оплате ·{" "}
              {formatPrice(total)}
            </>
          )}
        </button>

        <p className="muted checkout-card__secure">
          <ShieldCheck size={14} aria-hidden="true" /> Платёж проходит на
          стороне T-Bank. Мы не видим данные карты.
        </p>
      </form>

      <aside className="checkout-card checkout-card--summary">
        <div>
          <p className="eyebrow">Ваш заказ</p>
          <h2>Состав корзины</h2>
        </div>

        <div className="summary-lines">
          {items.map((item) => (
            <div key={item.product.id} className="summary-line">
              <div className="summary-line__media">
                {item.product.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.product.images[0]}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <span aria-hidden="true">◐</span>
                )}
              </div>
              <div className="summary-line__info">
                <strong>{item.product.title_ru}</strong>
                <p>
                  {item.quantity} × {formatPrice(item.product.price_kopecks)}
                </p>
              </div>
              <strong>
                {formatPrice(item.product.price_kopecks * item.quantity)}
              </strong>
            </div>
          ))}
        </div>

        <div className="summary-total">
          <span>Итого</span>
          <strong>{formatPrice(total)}</strong>
        </div>
      </aside>
    </div>
  );
}
