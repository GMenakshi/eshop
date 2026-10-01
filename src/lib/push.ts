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
import { API_BASE_URL } from "@/lib/api";

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

// App open: show an alert (Firebase shows nothing in the foreground)
export function listenForeground(onReceive?: () => void) {
  return onMessage(messaging(), async (message) => {
    onReceive?.();
    Alert.alert(
      message.notification?.title ?? "Notification",
      message.notification?.body ?? "",
    );
  });
}

// Tap handling: background -> foreground, and cold start
export function listenNotificationTap(onOrder: (orderId: string) => void) {
  const unsubscribe = onNotificationOpenedApp(messaging(), (message) => {
    const orderId = message.data?.orderId;
    if (typeof orderId === "string") onOrder(orderId);
  });

  getInitialNotification(messaging()).then((message) => {
    const orderId = message?.data?.orderId;
    if (typeof orderId === "string") onOrder(orderId);
  });

  return unsubscribe;
}