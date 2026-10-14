import { API_BASE_URL } from "@/lib/api";

const BASE = `${API_BASE_URL}/notifications`;

export type AppNotification = {
  _id: string;
  type:
    | "NEW_ORDER"
    | "ORDER_PLACED"
    | "ORDER_CONFIRMED"
    | "ORDER_SHIPPED"
    | "ORDER_DELIVERED"
    | "ORDER_CANCELLED"
    | "PRICE_QUOTED"
    | "NEW_OFFER";
  title: string;
  body: string;
  storeId?: string | { _id?: string; id?: string } | null;
  orderId?: string | { _id?: string } | null;
  isRead: boolean;
  createdAt: string;
};

export const notificationOrderId = (n: AppNotification): string | undefined => {
  const raw = n.orderId;
  const id = typeof raw === "object" && raw ? raw._id : raw;
  return id ? String(id) : undefined;
};

export type NotificationPage = {
  page?: number;
  totalPages?: number;
  unreadCount: number;
  notifications: AppNotification[];
};

const headers = (token: string) => ({
  "Content-Type": "application/json",
  "x-access-token": token,
  Authorization: `Bearer ${token}`,
});

export function filterNotificationsForStore(
  notifications: AppNotification[],
  storeIds: string[],
) {
  return notifications.filter((notification) => {
    const store = notification.storeId;
    if (!store) return true;
    const notificationStoreId =
      typeof store === "string" ? store : (store._id ?? store.id);
    return !notificationStoreId || storeIds.includes(notificationStoreId);
  });
}

export async function fetchNotifications(
  token: string,
  page = 1,
  storeId?: string,
): Promise<NotificationPage> {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (storeId) params.set("storeId", storeId);
  const url = `${BASE}?${params.toString()}`;
  const res = await fetch(url, { headers: headers(token) });
  console.log("NOTIFICATIONS", url, res.status);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function markRead(token: string, ids?: string[], storeId?: string) {
  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
  const res = await fetch(`${BASE}/read${query}`, {
    method: "PATCH",
    headers: headers(token),
    body: ids ? JSON.stringify({ notificationIds: ids }) : undefined,
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
}

export async function deleteNotification(token: string, id: string) {
  const res = await fetch(`${BASE}/clear-single/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers(token),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[Notifications] delete failed", res.status, res.url, body);
    throw new Error(`Request failed (${res.status})`);
  }
}

export async function clearAllNotifications(token: string, storeId?: string) {
  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
  const res = await fetch(`${BASE}/clear-all${query}`, {
    method: "DELETE",
    headers: headers(token),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[Notifications] clear-all failed", res.status, res.url, body);
    throw new Error(`Request failed (${res.status})`);
  }
}