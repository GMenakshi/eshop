import type { ApiGst } from "@/lib/api";

export const roundMoney = (n: number) => Math.round(n * 100) / 100;

// IGST if present, otherwise CGST + SGST
export const gstRate = (gst?: ApiGst | null) => {
  if (!gst) return 0;
  const igst = Number(gst.igst) || 0;
  if (igst > 0) return igst;
  return (Number(gst.cgst) || 0) + (Number(gst.sgst) || 0);
};

// first GST object that actually has a rate (size variant, then colour variant, then product)
export const pickGst = (...list: (ApiGst | null | undefined)[]) =>
  list.find((g) => gstRate(g) > 0) ?? undefined;

export function gstBreakup(
  unitPrice: number,
  quantity: number,
  rate: number,
  inclusive: boolean,
) {
  const lineTotal = unitPrice * quantity;
  if (!(rate > 0)) {
    return { base: roundMoney(lineTotal), gst: 0, total: roundMoney(lineTotal), rate: 0 };
  }
  if (inclusive) {
    const base = lineTotal / (1 + rate / 100);
    return {
      base: roundMoney(base),
      gst: roundMoney(lineTotal - base),
      total: roundMoney(lineTotal),
      rate,
    };
  }
  const gst = (lineTotal * rate) / 100;
  return {
    base: roundMoney(lineTotal),
    gst: roundMoney(gst),
    total: roundMoney(lineTotal + gst),
    rate,
  };
}

// For the bill: one entry per cart line
export function buildBill(
  lines: {
    unitPrice: number;
    quantity: number;
    gst?: ApiGst | null;
    gstInclusive?: boolean;
  }[],
) {
  let subtotal = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let total = 0;
  for (const l of lines) {
    const rate = gstRate(l.gst);
    const b = gstBreakup(l.unitPrice, l.quantity, rate, Boolean(l.gstInclusive));
    subtotal += b.base;
    total += b.total;
    const igstRate = Number(l.gst?.igst) || 0;
    if (igstRate > 0) {
      igst += b.gst;
    } else if (rate > 0) {
      const c = Number(l.gst?.cgst) || 0;
      cgst += (b.gst * c) / rate;
      sgst += (b.gst * (rate - c)) / rate;
    }
  }
  return {
    subtotal: roundMoney(subtotal),
    cgst: roundMoney(cgst),
    sgst: roundMoney(sgst),
    igst: roundMoney(igst),
    totalGst: roundMoney(cgst + sgst + igst),
    total: roundMoney(total),
  };
}