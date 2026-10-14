import { API_BASE_URL } from "@/lib/api";

export type StoreOwner = {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
};

export type StoreSummary = {
  _id: string;
  storeName: string;
  storeType?: string;
  storeUniqueId?: string;
  userId?: StoreOwner | string;
  images?: string[];
  whatsappNo?: string;
  contactNo?: string;
  qrCodeUrl?: string;
};

// Same public endpoint the app already uses to join a store;
// returns the `store` object from its response.
export async function fetchStoreDetails(
  storeId: string,
): Promise<Partial<StoreSummary> | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/product/store/${encodeURIComponent(storeId)}/products?limit=1`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    // temporary: shows which fields the backend returns (remove when the card looks right)
    console.log("[StoreDetails]", storeId, Object.keys(json?.store ?? {}));
    return json?.store ?? null;
  } catch {
    return null;
  }
}