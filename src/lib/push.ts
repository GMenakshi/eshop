import { API_BASE_URL } from "@/lib/api";
import { getApp } from "@react-native-firebase/app";
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
} from "@react-native-firebase/messaging";
import { Alert, PermissionsAndroid, Platform } from "react-native";

const messaging = () => getMessaging(getApp());
const TOKEN_URL = `${API_BASE_URL}/notifications/fcm-token`;
const callToken = (
  action: "register" | "remove",
  authToken: string,
  fcmToken: string,
) =>
  fetch(action === "register" ? TOKEN_URL : `${TOKEN_URL}/remove`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-access-token": authToken,
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ token: fcmToken }),
  }).catch(() => undefined);

export async function registerForPush(authToken: string) {
  try {
    if (Platform.OS === "android" && Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (result !== PermissionsAndroid.RESULTS.GRANTED) return undefined;
    } else {
      const status = await requestPermission(messaging());
      const allowed =
        status === AuthorizationStatus.AUTHORIZED ||
        status === AuthorizationStatus.PROVISIONAL;
      if (!allowed) return undefined;
    }

    const fcmToken = await getToken(messaging());
    if (fcmToken) await callToken("register", authToken, fcmToken);

    return onTokenRefresh(messaging(), (newToken) => {
      void callToken("register", authToken, newToken);
    });
  } catch (error) {
    console.warn("Push registration failed", error);
    return undefined;
  }
}

// Call this BEFORE clearing the auth token on logout
export async function unregisterPush(authToken: string) {
  try {
    const fcmToken = await getToken(messaging());
    if (fcmToken) await callToken("remove", authToken, fcmToken);
  } catch (error) {
    console.warn("Push unregister failed", error);
  }
}

const normalizeStoreId = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return undefined;
  const store = value as { _id?: unknown; id?: unknown };
  if (typeof store._id === "string") return store._id;
  return typeof store.id === "string" ? store.id : undefined;
};

const belongsToActiveStore = (
  messageStore: unknown,
  activeStoreIds: string[],
) => {
  const messageStoreId = normalizeStoreId(messageStore);
  return !messageStoreId || activeStoreIds.includes(messageStoreId);
};

// App open: show active-store alerts, except for the order-placed popup.
export function listenForeground(
  onReceive?: () => void,
  activeStoreIds: string[] = [],
) {
  return onMessage(messaging(), async (message) => {
    console.log("FCM foreground", JSON.stringify(message));

    if (!belongsToActiveStore(message.data?.storeId, activeStoreIds)) return;

    onReceive?.();

    const title = message.notification?.title ?? "";
    if (/order placed/i.test(title)) return;

    Alert.alert(title || "Notification", message.notification?.body ?? "");
  });
}

// Tap handling: background -> foreground, and cold start
export function listenNotificationTap(
  onOrder: (orderId: string) => void,
  activeStoreIds: string[] = [],
) {
  const unsubscribe = onNotificationOpenedApp(messaging(), (message) => {
    if (!belongsToActiveStore(message.data?.storeId, activeStoreIds)) return;
    const orderId = message.data?.orderId;
    if (typeof orderId === "string") onOrder(orderId);
  });

  getInitialNotification(messaging()).then((message) => {
    if (
      !message ||
      !belongsToActiveStore(message.data?.storeId, activeStoreIds)
    ) {
      return;
    }
    const orderId = message.data?.orderId;
    if (typeof orderId === "string") onOrder(orderId);
  });

  return unsubscribe;
}
