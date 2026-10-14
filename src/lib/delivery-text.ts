import type { ApiDelivery } from "@/lib/api";
import { formatDeliveryDate } from "@/lib/delivery";

const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const IST_MS = 5.5 * 60 * 60 * 1000;
const dayNumber = (ms: number) => Math.floor(ms / 86400000);

// backend dates are T00:00Z values that represent the IST calendar date -> read with UTC getters
function dayText(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = dayNumber(d.getTime()) - dayNumber(Date.now() + IST_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${DAY[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}

export function deliveryDateText(delivery?: ApiDelivery | null, fallback?: string) {
  if (delivery && delivery.deliverable === false) return "— not deliverable here";

  const max = delivery?.maxMinutes;
  if (typeof max === "number" && max < 1440) {
    if (max === 0) return "Today";
    if (max < 60) return `Today, within ${max} min`;
    const h = Math.round((max / 60) * 10) / 10;
    return `Today, within ${h} hr${h === 1 ? "" : "s"}`;
  }

  const maxDay = dayText(delivery?.estimatedMaxDate);
  if (maxDay) {
    const minDay = dayText(delivery?.estimatedMinDate);
    if (!minDay || minDay === maxDay) return maxDay;
    const a = new Date(delivery!.estimatedMinDate!);
    const b = new Date(delivery!.estimatedMaxDate!);
    return a.getUTCMonth() === b.getUTCMonth()
      ? `${a.getUTCDate()} – ${b.getUTCDate()} ${MON[b.getUTCMonth()]}`
      : `${a.getUTCDate()} ${MON[a.getUTCMonth()]} – ${b.getUTCDate()} ${MON[b.getUTCMonth()]}`;
  }

  return formatDeliveryDate(fallback);
}

export function shippingChargeText(d?: ApiDelivery | null): string {
  if (!d || d.deliverable === false || d.shippingCharge == null) return "";
  return d.shippingCharge === 0 ? "Free delivery" : `Delivery ₹${d.shippingCharge}`;
}