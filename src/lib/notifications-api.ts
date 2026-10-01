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
    | "ORDER_CANCELLED";
  title: string;
  body: string;
  orderId?: string;
  isRead: boolean;
  createdAt: string;
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

export async function fetchNotifications(token: string, page = 1): Promise<NotificationPage> {
  const url = `${BASE}?page=${page}&limit=20`;
  const res = await fetch(url, { headers: headers(token) });
  console.log("NOTIFICATIONS", url, res.status);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function markRead(token: string, ids?: string[]) {
  await fetch(`${BASE}/read`, {
    method: "PATCH",
    headers: headers(token),
    body: ids ? JSON.stringify({ notificationIds: ids }) : undefined,
  });
}