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
import { Alert } from "react-native";

import { type HomeProduct } from "@/app/(tabs)/index";
import { useAuth } from "@/context/auth-context";

import { API_BASE_URL } from "@/lib/api";
export type WishlistItem = HomeProduct & { isAvailable?: boolean };

type WishlistContextValue = {
  items: WishlistItem[];
  loading: boolean;
  toggle: (product: HomeProduct) => Promise<void>;
  isSaved: (id: string) => boolean;
  refresh: () => Promise<void>;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

const idOf = (value: any): string =>
  String(value?._id ?? value?.id ?? value ?? "");

// Accepts both shapes: { stores: [{ store, items }] } and { items: [...] }
function flatten(wishlist: any): WishlistItem[] {
  if (!wishlist) return [];

  const toItem = (item: any, storeName = ""): WishlistItem => {
    const product =
      item.productId && typeof item.productId === "object" ? item.productId : null;
    return {
      id: idOf(item.productId ?? item.product),
      name: item.name ?? product?.title ?? "Product unavailable",
      brand: storeName,
      price: Number(item.minOfferPrice ?? item.price ?? product?.price) || 0,
      category: "",
      image: item.image ?? product?.image ?? product?.images?.[0] ?? "",
      description: "",
      unit: item.unit ?? product?.unit ?? undefined,
      isAvailable: item.isAvailable,
    } as WishlistItem;
  };

  if (Array.isArray(wishlist.stores)) {
    return wishlist.stores.flatMap((group: any) =>
      (group.items ?? []).map((item: any) =>
        toItem(item, group.store?.storeName ?? ""),
      ),
    );
  }
  if (Array.isArray(wishlist.items)) {
    return wishlist.items.map((item: any) => toItem(item));
  }
  return [];
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);

  const request = useCallback(
  async (path: string, init?: RequestInit) => {
    const url = `${API_BASE_URL}/wishlist${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-access-token": token ?? "",
        Authorization: `Bearer ${token}`,
      },
    });
    const body = await res.json().catch(() => null);
    console.log("WISHLIST", init?.method ?? "GET", url, res.status, JSON.stringify(body)?.slice(0, 600));
    if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`);
    return body;
  },
  [token],
);

  const refresh = useCallback(async () => {
    if (!token) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const data = await request("");
      setItems(flatten(data?.wishlist ?? data));
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
        await request("/toggle", {
          method: "POST",
          body: JSON.stringify({ productId: product.id }),
        });
        await refresh();
      } catch (e) {
        console.log("WISHLIST toggle failed:", e);
        setItems(previous);
        Alert.alert(
          "Wishlist",
          e instanceof Error ? e.message : "Could not update wishlist.",
        );
      }
    },
    [token, items, request, refresh],
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
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context)
    throw new Error("useWishlist must be used inside WishlistProvider");
  return context;
}