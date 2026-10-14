import { useEffect, useRef } from "react";

import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store-context";

export function VisitTracker() {
  const { token, user } = useAuth();
  const { storeId, activeStore } = useStore();
  const sentKey = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      sentKey.current = null;
      return;
    }
    const raw = activeStore?.id ?? storeId;
    if (!raw) return;

    const key = `${user?._id ?? user?.id ?? token}:${raw}`;
    if (sentKey.current === key) return;
    sentKey.current = key;

    const body = activeStore?.mongoId
      ? { storeId: activeStore.mongoId }
      : { storeUniqueId: raw };

    api
      .registerStoreVisit(token, body)
      .then(() => console.log("[Visit] saved", body))
      .catch((e) => {
        console.warn("[Visit] failed", e);
        sentKey.current = null;
      });
  }, [token, user, storeId, activeStore?.id, activeStore?.mongoId]);

  return null;
}