import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { api } from "@/lib/api";

export type SavedStore = {
  id: string;
  mongoId?: string;
  name?: string;
  phone?: string;
};

const STORES_KEY = "savedStores";
const ACTIVE_KEY = "activeStoreId";

export const buildStoreDeepLink = (storeId: string) => {
  const scheme = process.env.EXPO_PUBLIC_DEEP_LINK_SCHEME ?? "eshop";
  return `${scheme}://store/${encodeURIComponent(storeId)}`;
};

type StoreContextValue = {
  stores: SavedStore[];
  storeId: string | null;
  activeStore: SavedStore | null;
  ready: boolean;
  joinStore: (id: string) => Promise<boolean>;
  setStoreId: (id: string) => Promise<boolean>;
  switchStore: (id: string) => Promise<void>;
  removeStore: (id: string) => Promise<void>;
};

const StoreContext = createContext<StoreContextValue>(null as any);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<SavedStore[]>([]);
  const [storeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [rawList, savedActive] = await Promise.all([
          AsyncStorage.getItem(STORES_KEY),
          AsyncStorage.getItem(ACTIVE_KEY),
        ]);
        const list: SavedStore[] = rawList ? JSON.parse(rawList) : [];
        setStores(list);
        setActiveId(
          savedActive && list.some((s) => s.id === savedActive)
            ? savedActive
            : (list[0]?.id ?? null),
        );
      } catch {
        setStores([]);
        setActiveId(null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = async (list: SavedStore[], active: string | null) => {
    setStores(list);
    setActiveId(active);
    await AsyncStorage.setItem(STORES_KEY, JSON.stringify(list));
    if (active) await AsyncStorage.setItem(ACTIVE_KEY, active);
    else await AsyncStorage.removeItem(ACTIVE_KEY);
  };

  const joinStore = useCallback(
    async (id: string) => {
      const info = await api.storeInfo(id);
      if (!info) return false;
      const entry: SavedStore = {
        id: info.id,
        mongoId: info.mongoId,
        name: info.name,
        phone: info.phone,
      };
      await persist([...stores.filter((s) => s.id !== entry.id), entry], entry.id);
      return true;
    },
    [stores],
  );

  const switchStore = useCallback(
    async (id: string) => {
      if (stores.some((s) => s.id === id)) await persist(stores, id);
    },
    [stores],
  );

  const removeStore = useCallback(
    async (id: string) => {
      const list = stores.filter((s) => s.id !== id);
      await persist(list, storeId === id ? (list[0]?.id ?? null) : storeId);
    },
    [stores, storeId],
  );

  const activeStore = stores.find((s) => s.id === storeId) ?? null;

  return (
    <StoreContext.Provider
      value={{
        stores,
        storeId,
        activeStore,
        ready,
        joinStore,
        setStoreId: joinStore,
        switchStore,
        removeStore,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);