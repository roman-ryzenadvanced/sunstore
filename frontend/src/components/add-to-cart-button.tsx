"use client";

import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";

import { useCartStore } from "@/store/cart";
import { toast } from "@/components/toaster";
import { cn } from "@/lib/format";
import type { Product } from "@/types/api";

interface AddToCartButtonProps {
  product: Product;
  className?: string;
  label?: string;
  /** Show full label vs icon-only. */
  variant?: "default" | "compact";
}

export function AddToCartButton({
  product,
  className,
  label = "Добавить в корзину",
  variant = "default"
}: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [justAdded, setJustAdded] = useState(false);

  const outOfStock =
    product.stock_quantity !== undefined && product.stock_quantity <= 0;
  const effectiveLabel = variant === "compact" ? "В корзину" : label;

  async function handleAdd() {
    if (outOfStock) {
      toast.warning("Нет в наличии", product.title_ru);
      return;
    }
    addItem(product);
    toast.success("Добавлено в корзину", product.title_ru);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
  }

  return (
    <button
      type="button"
      className={cn(
        "button",
        outOfStock ? "button--disabled" : "button--primary",
        variant === "compact" && "button--compact",
        justAdded && "button--success",
        className
      )}
      onClick={handleAdd}
      disabled={outOfStock || justAdded}
      aria-label={`Добавить в корзину: ${product.title_ru}`}
    >
      {justAdded ? (
        <>
          <Check size={16} aria-hidden="true" /> {variant === "compact" ? "Готово" : "Добавлено"}
        </>
      ) : outOfStock ? (
        <>
          <ShoppingBag size={16} aria-hidden="true" /> Нет в наличии
        </>
      ) : (
        <>
          <ShoppingBag size={16} aria-hidden="true" /> {effectiveLabel}
        </>
      )}
    </button>
  );
}
