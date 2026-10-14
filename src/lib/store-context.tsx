import { api } from "@/lib/api";
import { resolveInstallStore } from "@/lib/install-claim";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

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
  storeUnavailable: boolean;
  setStoreUnavailable: (v: boolean) => void;
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
  const [storeUnavailable, setStoreUnavailable] = useState(false);

  useEffect(() => {
    (async () => {
      let list: SavedStore[] = [];
      let active: string | null = null;
      try {
        const [rawList, savedActive] = await Promise.all([
          AsyncStorage.getItem(STORES_KEY),
          AsyncStorage.getItem(ACTIVE_KEY),
        ]);
        list = rawList ? JSON.parse(rawList) : [];
        active =
          savedActive && list.some((s) => s.id === savedActive)
            ? savedActive
            : (list[0]?.id ?? null);
      } catch {
        list = [];
        active = null;
      }

      // First launch after install: claim the store from the install token
      try {
        const claimedId = await resolveInstallStore();
        if (claimedId) {
          const info = await api.storeInfo(claimedId);
          if (info) {
            const entry: SavedStore = {
              id: info.id,
              mongoId: info.mongoId,
              name: info.name,
              phone: info.phone,
            };
            list = [...list.filter((s) => s.id !== entry.id), entry];
            active = entry.id;
            await AsyncStorage.setItem(STORES_KEY, JSON.stringify(list));
            await AsyncStorage.setItem(ACTIVE_KEY, entry.id);
          }
        }
      } catch {
        // ignore: the app still opens with the saved stores
      }

      setStores(list);
      setActiveId(active);
      setReady(true);
    })();
  }, []);

  // Re-check the active store whenever it changes (and on app start)
  useEffect(() => {
    setStoreUnavailable(false);
    if (!ready || !storeId) return;
    let active = true;
    api
      .storeInfo(storeId)
      .then((info) => {
        if (!active) return;
        if (!info || (info as any).isActive === false) {
          setStoreUnavailable(true);
        }
      })
      .catch(() => {
        // network error: don't claim the store is gone
      });
    return () => {
      active = false;
    };
  }, [ready, storeId]);

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
      await persist(
        [...stores.filter((s) => s.id !== entry.id), entry],
        entry.id,
      );
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
        storeUnavailable,
        setStoreUnavailable,
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