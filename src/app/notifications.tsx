import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { API_BASE_URL, apiImageUrl } from "@/lib/api";
import {
  AppNotification,
  fetchNotifications,
  filterNotificationsForStore,
  markRead,
} from "@/lib/notifications-api";
import { useStore } from "@/lib/store-context";

const iconFor = (type: AppNotification["type"]) => {
  switch (type) {
    case "NEW_ORDER":
    case "ORDER_PLACED":
    case "ORDER_CONFIRMED":
      return {
        ios: "bag.fill",
        android: "shopping_bag",
        web: "shopping_bag",
      } as const;
    case "ORDER_SHIPPED":
      return {
        ios: "shippingbox.fill",
        android: "local_shipping",
        web: "local_shipping",
      } as const;
    case "ORDER_DELIVERED":
      return {
        ios: "checkmark.circle.fill",
        android: "check_circle",
        web: "check_circle",
      } as const;
    case "ORDER_CANCELLED":
      return {
        ios: "xmark.circle.fill",
        android: "cancel",
        web: "cancel",
      } as const;
    default:
      return {
        ios: "bell.fill",
        android: "notifications",
        web: "notifications",
      } as const;
  }
};

export default function NotificationsScreen() {
  const { token } = useAuth();
  const { storeId, activeStore } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeStoreId = activeStore?.mongoId ?? storeId ?? undefined;
  const activeStoreIds = [
    activeStore?.mongoId,
    activeStore?.id,
    storeId,
  ].filter((id): id is string => Boolean(id));
  const [menuOpen, setMenuOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [orderImages, setOrderImages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;
    let active = true;
    fetch(`${API_BASE_URL}/order/my-orders?limit=100`, {
      headers: { "x-access-token": token },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => {
        if (!active) return;
        const map: Record<string, string> = {};
        for (const o of json?.orders ?? []) {
          const img = o?.items?.[0]?.image;
          if (o?._id && typeof img === "string" && img) {
            map[String(o._id)] = img;
          }
        }
        setOrderImages(map);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [token]);

  const notifImage = (n: AppNotification) => {
    const raw: any = (n as any).orderId;
    const id = typeof raw === "object" && raw ? raw._id : raw;
    const img = id ? orderImages[String(id)] : undefined;
    return img ? apiImageUrl(img) : undefined;
  };

  const load = useCallback(
    async (nextPage = 1) => {
      if (!token) return;
      try {
        const data = await fetchNotifications(token, nextPage, activeStoreId);
        const storeNotifications = filterNotificationsForStore(
          data.notifications,
          activeStoreIds,
        );
        setItems((prev) =>
          nextPage === 1
            ? storeNotifications
            : [...prev, ...storeNotifications],
        );
        setPage(data.page ?? 1);
        setTotalPages(data.totalPages ?? 1);
        setUnread(data.unreadCount);
        setError(null);
        setLoaded(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, activeStoreId, activeStore?.id],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const onTap = (n: AppNotification) => {
    if (!n.isRead && token) {
      setItems((prev) =>
        prev.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)),
      );
      setUnread((u) => Math.max(0, u - 1));
      void markRead(token, [n._id], activeStoreId);
    }
    if (n.orderId) {
      router.push("/orders");
    }
  };

  const markAll = async () => {
    setMenuOpen(false);
    if (!token || unread === 0) return;
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
    await markRead(token, undefined, activeStoreId);
  };

  const clearAll = () => {
    setMenuOpen(false);
    if (!token || items.length === 0) return;
    Alert.alert(
      "Clear all notifications?",
      "This will remove all your notifications.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: async () => {
            const previous = items;
            const previousUnread = unread;
            setItems([]);
            setUnread(0);
            setPage(1);
            setTotalPages(1);
            try {
              const storeQuery = activeStoreId
                ? `?storeId=${encodeURIComponent(activeStoreId)}`
                : "";
              const res = await fetch(
                `${API_BASE_URL}/notification/clear-all${storeQuery}`,
                {
                  method: "DELETE",
                  headers: { "x-access-token": token },
                },
              );
              if (!res.ok) throw new Error("Request failed");
            } catch {
              setItems(previous);
              setUnread(previousUnread);
              Alert.alert("Could not clear notifications", "Please try again.");
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(1);
            }}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <ThemedText style={styles.title}>Notifications</ThemedText>
            <Pressable
              style={styles.menuBtn}
              onPress={() => setMenuOpen(true)}
              hitSlop={8}
              accessibilityLabel="More options"
            >
              <SymbolView
                name={{
                  ios: "ellipsis",
                  android: "more_vert",
                  web: "more_vert",
                }}
                size={20}
                tintColor="#17211D"
              />
            </Pressable>
          </View>
          {loaded && (
            <ThemedText
              style={{ color: "#6E786F", fontSize: 13, marginBottom: 6 }}
            >
              {unread} unread · {Math.max(items.length - unread, 0)} read
            </ThemedText>
          )}
        </View>

        {loading && <ActivityIndicator />}
        {error && <ThemedText>{error}</ThemedText>}
        {loaded && !error && items.length === 0 && (
          <ThemedText>No notifications yet.</ThemedText>
        )}

        {items.map((n) => (
          <Pressable key={n._id} style={styles.card} onPress={() => onTap(n)}>
            <View style={styles.iconWrap}>
              {notifImage(n) ? (
                <Image
                  source={{ uri: notifImage(n) }}
                  style={styles.thumb}
                  contentFit="cover"
                />
              ) : (
                <SymbolView
                  name={iconFor(n.type)}
                  size={18}
                  tintColor="#17211D"
                />
              )}
            </View>
            <View style={styles.body}>
              <ThemedText style={styles.notificationTitle}>
                {n.title}
              </ThemedText>
              <ThemedText style={styles.notificationBody}>{n.body}</ThemedText>
              <ThemedText style={styles.notificationTime}>
                {formatDistanceToNow(new Date(n.createdAt), {
                  addSuffix: true,
                })}
              </ThemedText>
            </View>
            {!n.isRead && <View style={styles.dot} />}
          </Pressable>
        ))}

        {page < totalPages && (
          <Pressable onPress={() => load(page + 1)}>
            <ThemedText>Load more</ThemedText>
          </Pressable>
        )}
      </ScrollView>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setMenuOpen(false)}
        >
          <View style={[styles.menu, { top: insets.top + 56 }]}>
            <Pressable
              style={[styles.menuItem, unread === 0 && styles.menuItemDisabled]}
              disabled={unread === 0}
              onPress={() => void markAll()}
            >
              <ThemedText style={styles.menuText}>Mark all as read</ThemedText>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              style={[
                styles.menuItem,
                items.length === 0 && styles.menuItemDisabled,
              ]}
              disabled={items.length === 0}
              onPress={clearAll}
            >
              <ThemedText style={[styles.menuText, styles.menuTextDanger]}>
                Clear all
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F4ED" },
  content: { padding: 16, paddingBottom: 40 },
  header: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E4DC",
    alignItems: "center",
    justifyContent: "center",
  },
  menu: {
    position: "absolute",
    right: 16,
    minWidth: 180,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E0E4DC",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  menuItem: { paddingHorizontal: 16, paddingVertical: 12 },
  menuItemDisabled: { opacity: 0.4 },
  menuDivider: { height: 1, backgroundColor: "#EEF0EA" },
  menuText: { color: "#17211D", fontSize: 14, fontWeight: "600" },
  menuTextDanger: { color: "#D5684A" },
  title: {
    color: "#17211D",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E0E4DC",
    position: "relative",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#E8EFE7",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumb: { width: "100%", height: "100%" },
  body: { flex: 1 },
  notificationTitle: {
    color: "#17211D",
    fontSize: 13,
    fontWeight: "700",
  },
  notificationBody: {
    color: "#526057",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  notificationTime: {
    color: "#6E786F",
    fontSize: 10,
    marginTop: 4,
  },
  dot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D5684A",
  },
});
