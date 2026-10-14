const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export const formatDeliveryDate = (value: unknown, fallback = "Same day") => {
  if (!value) return fallback;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value); // e.g. "Same day" stays as is
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};