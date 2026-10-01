import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatDistanceToNow } from "date-fns";

import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import {
  AppNotification,
  fetchNotifications,
  markRead,
} from "@/lib/notifications-api";

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
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(
    async (nextPage = 1) => {
      if (!token) return;
      try {
        const data = await fetchNotifications(token, nextPage);
        setItems((prev) =>
          nextPage === 1
            ? data.notifications
            : [...prev, ...data.notifications],
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
    [token],
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
      void markRead(token, [n._id]);
    }
    if (n.orderId) {
      router.push("/orders");
    }
  };

  const markAll = async () => {
    if (!token) return;
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
    await markRead(token);
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
          <ThemedText style={styles.title}>Notifications</ThemedText>
          {loaded && (
            <ThemedText
              style={{ color: "#6E786F", fontSize: 13, marginBottom: 6 }}
            >
              {unread} unread · {Math.max(items.length - unread, 0)} read
            </ThemedText>
          )}
          {unread > 0 && (
            <Pressable onPress={markAll}>
              <ThemedText>Mark all as read</ThemedText>
            </Pressable>
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
              <SymbolView
                name={iconFor(n.type)}
                size={22}
                tintColor="#17211D"
              />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F4ED" },
  content: { padding: 20, paddingBottom: 40 },
  header: {
    marginBottom: 20,
  },
  title: {
    color: "#17211D",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -1.2,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0E4DC",
    position: "relative",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E8EFE7",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  notificationTitle: {
    color: "#17211D",
    fontSize: 16,
    fontWeight: "700",
  },
  notificationBody: {
    color: "#526057",
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4,
  },
  notificationTime: {
    color: "#6E786F",
    fontSize: 12,
    marginTop: 6,
  },
  dot: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#D5684A",
  },
});
