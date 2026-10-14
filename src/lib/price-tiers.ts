export type PriceTier = { minQty: number; maxQty: number | null; price: number };

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const pick = (o: any, keys: string[]) => {
  for (const k of keys) if (o?.[k] !== undefined) return o[k];
  return undefined;
};

const normalize = (input: unknown): PriceTier[] => {
  let raw: any = input;
  // allow { enabled, tiers: [...] }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    if (raw.enabled === false) return [];
    raw = raw.tiers ?? raw.priceTiers ?? raw.slabs ?? raw.items;
  }
  if (!Array.isArray(raw)) return [];

  const tiers: PriceTier[] = [];
  let nextMin = 1; // "Min Qty (auto)": previous max + 1
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const price = num(
      pick(t, ["price", "pricePerUnit", "unitPrice", "offerPrice", "amount"]),
    );
    if (price === null) continue;
    const min =
      num(pick(t, ["minQty", "minQuantity", "min", "from", "fromQty"])) ??
      nextMin;
    const maxRaw = num(
      pick(t, ["maxQty", "maxQuantity", "max", "to", "toQty"]),
    );
    const max = maxRaw !== null && maxRaw > 0 ? maxRaw : null; // null = no limit
    tiers.push({ minQty: min, maxQty: max, price });
    nextMin = max !== null ? max + 1 : min;
  }
  return tiers.sort((a, b) => a.minQty - b.minQty);
};

const KNOWN_KEYS = [
  "priceTiers",
  "quantityPricing",
  "quantityTiers",
  "tierPricing",
  "pricingTiers",
  "quantityBasedPricing",
  "bulkPricing",
  "tiers",
];

/** Looks for quantity-based price tiers on the given objects (variant, color variant, product) */
export function getPriceTiers(...sources: any[]): PriceTier[] {
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    for (const key of KNOWN_KEYS) {
      const tiers = normalize(src[key]);
      if (tiers.length) return tiers;
    }
    // fallback: any field whose name looks like tiers / quantity / bulk
    for (const key of Object.keys(src)) {
      if (/tier|quantity|qty|bulk/i.test(key)) {
        const tiers = normalize(src[key]);
        if (tiers.length) return tiers;
      }
    }
  }
  return [];
}