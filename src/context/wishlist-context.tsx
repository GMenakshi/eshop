import { router } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { type HomeProduct } from "@/app/(tabs)/index";
import { useAuth } from "@/context/auth-context";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;

export type WishlistItem = HomeProduct & { isAvailable?: boolean };

type WishlistContextValue = {
  items: WishlistItem[];
  loading: boolean;
  toggle: (product: HomeProduct) => Promise<void>;
  isSaved: (id: string) => boolean;
  refresh: () => Promise<void>;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

// server response -> flat list shaped like HomeProduct
function flatten(wishlist: any): WishlistItem[] {
  const stores = wishlist?.stores ?? [];
  return stores.flatMap((group: any) =>
    (group.items ?? []).map(
      (item: any) =>
        ({
          id: String(item.productId),
          name: item.name ?? "Product unavailable",
          brand: group.store?.storeName ?? "",
          price: Number(item.minOfferPrice) || 0,
          category: "",
          image: item.image ?? "",
          description: "",
          unit: item.unit ?? undefined,
          isAvailable: item.isAvailable,
        }) as WishlistItem,
    ),
  );
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);


  
const request = useCallback(
  async (path: string, init?: RequestInit) => {
    const url = `${API_BASE}/wishlist${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const body = await res.json().catch(() => null);
    console.log("WISHLIST", init?.method ?? "GET", url, res.status, body);
    if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`);
    return body;
  },
  [token],
);

const refresh = useCallback(async () => {
  console.log("WISHLIST refresh, token present:", Boolean(token));
  if (!token) {
    setItems([]);
    return;
  }
  setLoading(true);
  try {
    const data = await request("");
    setItems(flatten(data.wishlist));
  } catch (e) {
    console.log("WISHLIST refresh failed:", e);
  } finally {
    setLoading(false);
  }
}, [token, request]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (product: HomeProduct) => {
      if (!token) {
        router.push("/sign-in");
        return;
      }
      const previous = items;
      setItems((current) =>
        current.some((entry) => entry.id === product.id)
          ? current.filter((entry) => entry.id !== product.id)
          : [product, ...current],
      );
      try {
        const data = await request("/toggle", {
          method: "POST",
          body: JSON.stringify({ productId: product.id }),
        });
        setItems(flatten(data.wishlist));
      } catch {
        setItems(previous);
      }
    },
    [token, items, request],
  );

  const value = useMemo(
    () => ({
      items,
      loading,
      toggle,
      refresh,
      isSaved: (id: string) => items.some((entry) => entry.id === id),
    }),
    [items, loading, toggle, refresh],
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context)
    throw new Error("useWishlist must be used inside WishlistProvider");
  return context;
}