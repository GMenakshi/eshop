import { getPriceTiers, type PriceTier } from "@/lib/price-tiers";
import { buildBill, gstBreakup, gstRate, pickGst } from "@/lib/gst";
import type { ApiGst } from "@/lib/api";

export type { PriceTier };

const idOf = (o: any) => o?._id ?? o?.id;

/** Selected colour group + size variant of a cart item / product. */
const selectionOf = (product: any) => {
  const variants: any[] = Array.isArray(product?.variants) ? product.variants : [];

  const group = product?.colorVariantId
    ? variants.find((g) => idOf(g) === product.colorVariantId)
    : undefined;
  const sizePool: any[] = group
    ? (group.sizeVariants ?? [])
    : variants.flatMap((g) => g.sizeVariants ?? []);
  const size = product?.variantId
    ? sizePool.find((v) => idOf(v) === product.variantId)
    : undefined;
  const groupById =
    group ??
    (product?.variantId
      ? variants.find((g) => idOf(g) === product.variantId)
      : undefined);

  return { variants, size, group: groupById };
};

/** Tiers for this product: selected size / colour first, then the product itself. */
const tiersOf = (product: any): PriceTier[] => {
  if (!product) return [];
  const { variants, size, group } = selectionOf(product);

  return getPriceTiers(
    size,
    group,
    product,
    variants[0]?.sizeVariants?.[0], // default selection on the product page
    variants[0],
  );
};

export const hasTiers = (product: any) => tiersOf(product).length > 0;

/** Tier price for this quantity, or undefined if the product has no tiers. */
export function tierPriceFor(product: any, quantity: number): number | undefined {
  const tiers = tiersOf(product);
  if (!tiers.length) return undefined;
  const match = tiers.filter((t) => quantity >= t.minQty).pop() ?? tiers[0];
  return match.price;
}

/* ---------------------------- GST ---------------------------- */

/**
 * GST for this item: selected size variant -> colour variant -> product.
 * Falls back to the `gst` already saved on the cart item.
 */
export function gstOf(product: any): ApiGst | undefined {
  if (!product) return undefined;
  const { size, group } = selectionOf(product);
  return pickGst(size?.effectiveGst, group?.effectiveGst, product.gst);
}

/** Unit price: tier price if the product has tiers, else the item's own price. */
export function unitPriceFor(product: any, quantity: number): number {
  const tier = tierPriceFor(product, quantity);
  if (tier !== undefined) return tier;
  return Number(product?.price ?? product?.offerPrice ?? 0) || 0;
}

/** GST breakup for one cart line (base, gst, total, rate). */
export function lineBill(product: any, quantity: number) {
  const unitPrice = unitPriceFor(product, quantity);
  const rate = gstRate(gstOf(product));
  return {
    unitPrice,
    ...gstBreakup(unitPrice, quantity, rate, Boolean(product?.gstInclusive)),
  };
}

/** Whole-cart bill: subtotal, CGST, SGST, IGST, totalGst, total. */
export function cartBill(items: { product: any; quantity: number }[]) {
  return buildBill(
    items.map(({ product, quantity }) => ({
      unitPrice: unitPriceFor(product, quantity),
      quantity,
      gst: gstOf(product),
      gstInclusive: Boolean(product?.gstInclusive),
    })),
  );
}