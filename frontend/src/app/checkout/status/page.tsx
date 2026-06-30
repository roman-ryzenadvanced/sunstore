import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Статус заказа",
  description: "Результат оформления заказа и оплаты через T-Bank.",
  robots: { index: false, follow: false }
};

export const dynamic = "force-dynamic";

export default async function CheckoutStatusPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "success";
  const orderId =
    typeof params.order === "string" ? params.order : undefined;

  const copy =
    status === "rejected"
      ? {
          eyebrow: "Оплата не завершена",
          title: "Оплата не прошла",
          description:
            "Проверьте данные карты или попробуйте снова. Заказ можно переоформить из корзины — товары уже там.",
          action: "Вернуться к оформлению",
          href: "/checkout" as Route,
          tone: "rejected" as const
        }
      : status === "mock"
      ? {
          eyebrow: "Демо-режим",
          title: "Заказ создан в demo-режиме",
          description:
            "Платёж обработан локальным demo-gateway. Для sandbox или live-режима подключите реальные T-Bank credentials и переключите режим в backend-конфиге.",
          action: "Вернуться в каталог",
          href: "/catalog" as Route,
          tone: "pending" as const
        }
      : {
          eyebrow: "Заказ оформлен",
          title: "Спасибо за заказ!",
          description:
            "Мы отправили подтверждение на почту. Ссылка на оплату через T-Bank уже открыта — если окно не появилось, нажмите кнопку ниже.",
          action: "Вернуться в каталог",
          href: "/catalog" as Route,
          tone: "confirmed" as const
        };

  return (
    <div className="shell page-stack">
      <section
        className={`status-card status-card--${copy.tone}`}
        role="status"
        aria-live="polite"
      >
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
        {orderId ? (
          <p className="muted">
            Номер заказа: <code>{orderId}</code>
          </p>
        ) : null}
        <Link href={copy.href} className="button button--primary">
          {copy.action}
        </Link>
      </section>
    </div>
  );
}
