// Pulls a store ID out of whatever the QR (or copied link) contains
export const extractStoreId = (data: string): string | null => {
  const text = data.trim();
  // "STR-..." anywhere: plain ID, or inside a link / query string
  const m = text.match(/STR-[A-Za-z0-9]+/i);
  if (m) return `STR-${m[0].slice(4)}`;
  // fallback: .../store/<id>
  const p = text.match(/\/store\/([^/?#\s]+)/i);
  return p ? decodeURIComponent(p[1]) : null;
};