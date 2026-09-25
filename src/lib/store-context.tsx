import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { api, DEFAULT_STORE_ID } from "@/lib/api";

const LEGACY_STORE_IDS = new Set(["STR-1781626861400"]);

export const resolveStoreIdFromUrl = (url?: string | null) => {
  if (!url) return null;

  try {
    const parsed = Linking.parse(url);
    const queryId =
      typeof parsed.queryParams?.storeId === "string"
        ? parsed.queryParams.storeId
        : typeof parsed.queryParams?.id === "string"
          ? parsed.queryParams.id
          : undefined;

    const pathSegments = parsed.path?.split("/").filter(Boolean) ?? [];
    const storeIndex = pathSegments.findIndex((segment) => segment === "store");
    const pathStoreId =
      storeIndex >= 0 ? pathSegments[storeIndex + 1] : undefined;
    const schemeStoreId =
      parsed.hostname === "store" ? pathSegments[0] : undefined;

    // Only accept explicit store links. This prevents an Expo LAN host such
    // as 192.168.1.20 from being treated as a store ID during startup.
    const candidate = queryId ?? pathStoreId ?? schemeStoreId;

    const cleaned = String(candidate ?? "").trim();
    return cleaned && cleaned !== "store" ? cleaned : null;
  } catch {
    return null;
  }
};

export const buildStoreDeepLink = (storeId: string) => {
  const scheme = process.env.EXPO_PUBLIC_DEEP_LINK_SCHEME ?? "eshop";
  return `${scheme}://store/${encodeURIComponent(storeId)}`;
};

type StoreContextValue = {
  storeId: string | null;
  ready: boolean;
  hasStoreError: boolean;
  setStoreId: (id: string) => Promise<boolean>;
};

const StoreContext = createContext<StoreContextValue>({
  storeId: null,
  ready: false,
  hasStoreError: false,
  setStoreId: async () => false,
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const [storeId, setId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [hasStoreError, setHasStoreError] = useState(false);

  const applyStoreId = async (id: string) => {
    const trimmed = id?.trim();
    if (!trimmed) {
      await AsyncStorage.removeItem("activeStoreId");
      setId(null);
      setHasStoreError(true);
      return false;
    }

    const exists = await api.storeExists(trimmed);
    if (!exists) {
      await AsyncStorage.removeItem("activeStoreId");
      setId(null);
      setHasStoreError(true);
      return false;
    }

    await AsyncStorage.setItem("activeStoreId", trimmed);
    setId(trimmed);
    setHasStoreError(false);
    return true;
  };

  useEffect(() => {
    const hydrate = async () => {
      try {
        const saved = await AsyncStorage.getItem("activeStoreId");
        if (saved && !LEGACY_STORE_IDS.has(saved)) {
          const applied = await applyStoreId(saved);
          if (!applied && DEFAULT_STORE_ID?.trim()) {
            await applyStoreId(DEFAULT_STORE_ID.trim());
          }
        } else {
          await AsyncStorage.removeItem("activeStoreId");
          const fallback = DEFAULT_STORE_ID?.trim();
          if (fallback) {
            await applyStoreId(fallback);
          } else {
            setId(null);
            setHasStoreError(false);
          }
        }
      } catch {
        // Backend unavailable; fall back gracefully
        const fallback = DEFAULT_STORE_ID?.trim();
        if (fallback) {
          setId(fallback);
          setHasStoreError(false);
        } else {
          setId(null);
          setHasStoreError(false);
        }
      } finally {
        setReady(true);
      }
    };

    const handleDeepLink = async (url?: string | null) => {
      const resolvedId = resolveStoreIdFromUrl(url);
      if (!resolvedId) return;
      await applyStoreId(resolvedId);
    };

    void hydrate();
    void Linking.getInitialURL().then(handleDeepLink);
    const subscription = Linking.addEventListener("url", (event) => {
      void handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const setStoreId = async (id: string) => applyStoreId(id);

  return (
    <StoreContext.Provider
      value={{ storeId, ready, hasStoreError, setStoreId }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
