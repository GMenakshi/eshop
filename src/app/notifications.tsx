import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
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
  clearAllNotifications,
  deleteNotification,
  fetchNotifications,
  filterNotificationsForStore,
  markRead,
  notificationOrderId,
} from "@/lib/notifications-api";
import { useStore } from "@/lib/store-context";
import { useBanner, type BannerKind } from "@/components/top-banner";

const bannerKindFor = (type: AppNotification["type"]): BannerKind => {
  switch (type) {
    case "ORDER_CANCELLED":
      return "error";
    case "ORDER_DELIVERED":
    case "ORDER_CONFIRMED":
    case "ORDER_PLACED":
    case "NEW_ORDER":
      return "success";
    case "PRICE_QUOTED":
      return "warning";
    default:
      return "info";
  }
};

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
    case "PRICE_QUOTED":
      return {
        ios: "tag.fill",
        android: "sell",
        web: "sell",
      } as const;
    default:
      return {
        ios: "bell.fill",
        android: "notifications",
        web: "notifications",
      } as const;
  }
};

function SwipeToDelete({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const widthRef = useRef(300);
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  const springBack = () =>
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -100 || g.vx < -0.8) {
          Animated.timing(translateX, {
            toValue: -widthRef.current,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onDeleteRef.current());
        } else {
          springBack();
        }
      },
      onPanResponderTerminate: springBack,
    }),
  ).current;

  const bgOpacity = translateX.interpolate({
    inputRange: [-120, -20, 0],
    outputRange: [1, 0.6, 0],
    extrapolate: "clamp",
  });

  return (
    <View onLayout={(e) => (widthRef.current = e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.swipeBg, { opacity: bgOpacity }]}>
        <SymbolView
          name={{ ios: "trash.fill", android: "delete", web: "delete" }}
          size={22}
          tintColor="#FFFFFF"
        />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

function FadeInView({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay: Math.min(index, 8) * 70, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, delay: Math.min(index, 8) * 70, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

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
  const [orderNames, setOrderNames] = useState<Record<string, string>>({});
  const [orderGallery, setOrderGallery] = useState<Record<string, string[]>>({});
  const banner = useBanner();
  
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
        const names: Record<string, string> = {};
        const gallery: Record<string, string[]> = {};
        for (const o of json?.orders ?? []) {
          const all: string[] = [];
          for (const it of o?.items ?? []) {
            if (Array.isArray(it?.images)) all.push(...it.images);
            if (typeof it?.image === "string") all.push(it.image);
          }
          const unique = Array.from(new Set(all.filter(Boolean)));
          if (o?._id && unique.length > 1) gallery[String(o._id)] = unique;
          const img = o?.items?.[0]?.image;
          if (o?._id && typeof img === "string" && img) {
            map[String(o._id)] = img;
          }
          const first = o?.items?.[0]?.name;
          if (o?._id && typeof first === "string" && first) {
            const extra = (o.items?.length ?? 1) - 1;
            names[String(o._id)] = extra > 0 ? `${first} +${extra} more` : first;
          }
        }
        setOrderImages(map);
        setOrderNames(names);
        setOrderGallery(gallery);
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

  const notifGallery = (n: AppNotification) => {
    const raw: any = (n as any).orderId;
    const id = typeof raw === "object" && raw ? raw._id : raw;
    return id ? (orderGallery[String(id)] ?? []) : [];
  };

  const notifName = (n: AppNotification) => {
    const raw: any = (n as any).orderId;
    const id = typeof raw === "object" && raw ? raw._id : raw;
    return id ? orderNames[String(id)] : undefined;
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
    const orderId = notificationOrderId(n);
    if (orderId)
      router.push({ pathname: "/order/[id]", params: { id: orderId } });
  };

  const markAll = async () => {
    setMenuOpen(false);
    if (!token || unread === 0) return;
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
    await markRead(token, undefined, activeStoreId);
  };

  const deleteOne = async (n: AppNotification) => {
    if (!token) return;
    const previous = items;
    const previousUnread = unread;
    setItems((prev) => prev.filter((x) => x._id !== n._id));
    if (!n.isRead) setUnread((u) => Math.max(0, u - 1));
    try {
      await deleteNotification(token, n._id);
    } catch (e) {
      setItems(previous);
      setUnread(previousUnread);
      banner.show({
        kind: "error",
        title: "Could not delete notification",
        message: e instanceof Error ? e.message : "Please try again.",
      });
    }
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
              await clearAllNotifications(token, activeStoreId);
            } catch (e) {
              setItems(previous);
              setUnread(previousUnread);
              banner.show({
                kind: "error",
                title: "Could not clear notifications",
                message: e instanceof Error ? e.message : "Please try again.",
              });
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
          {token && loaded && (
            <ThemedText
              style={{ color: "#6E786F", fontSize: 13, marginBottom: 6 }}
            >
              {unread} unread · {Math.max(items.length - unread, 0)} read
            </ThemedText>
          )}
        </View>

        {!token && (
          <View style={styles.signInPanel}>
            <ThemedText style={styles.panelTitle}>
              Your notifications live here
            </ThemedText>
            <ThemedText style={styles.panelText}>
              Sign in to see updates about your orders.
            </ThemedText>
            <Pressable
              onPress={() => router.push("/sign-in")}
              style={styles.primary}
            >
              <ThemedText style={styles.primaryText}>SIGN IN</ThemedText>
            </Pressable>
          </View>
        )}

        {token && loading && <ActivityIndicator />}
        {token && error && <ThemedText>{error}</ThemedText>}
        {token && loaded && !error && items.length === 0 && (
          <ThemedText>No notifications yet.</ThemedText>
        )}

        {items.map((n, idx) => (
          <FadeInView key={n._id} index={idx}>
          <SwipeToDelete onDelete={() => void deleteOne(n)}>
          <Pressable style={styles.card} onPress={() => onTap(n)}>
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
              {!!notifName(n) && (
                <ThemedText
                  style={[styles.notificationBody, { fontWeight: "700" }]}
                  numberOfLines={1}
                >
                  {notifName(n)}
                </ThemedText>
              )}
              {notifGallery(n).length > 1 && (
                <View style={styles.galleryRow}>
                  {notifGallery(n).slice(0, 4).map((img, i, arr) => (
                    <View key={img + i} style={styles.galleryThumbWrap}>
                      <Image source={{ uri: apiImageUrl(img) }} style={styles.galleryThumb} contentFit="cover" transition={300} />
                      {i === 3 && notifGallery(n).length > 4 && (
                        <View style={styles.galleryMore}>
                          <ThemedText style={styles.galleryMoreText}>+{notifGallery(n).length - 4}</ThemedText>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
              <ThemedText style={styles.notificationTime}>
                {formatDistanceToNow(new Date(n.createdAt), {
                  addSuffix: true,
                })}
              </ThemedText>
            </View>
            {!n.isRead && <View style={styles.dot} />}

          </Pressable>
          </SwipeToDelete>
          </FadeInView>
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
  safeArea: { flex: 1, backgroundColor: "#FDF1E6" },
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
    borderColor: "#F3DFCB",
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
    borderColor: "#F3DFCB",
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
    borderColor: "#F3DFCB",
    position: "relative",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FBE3CC",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumb: { width: "100%", height: "100%" },
  swipeBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 8,
    borderRadius: 12,
    backgroundColor: "#D5684A",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 24,
  },
  galleryRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  galleryThumbWrap: { width: 44, height: 44, borderRadius: 10, overflow: "hidden", backgroundColor: "#FBE3CC", borderWidth: 1, borderColor: "#F3DFCB" },
  galleryThumb: { width: "100%", height: "100%" },
  galleryMore: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  galleryMoreText: { color: "#fff", fontSize: 12, fontWeight: "800" },
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
  deleteBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D5684A",
  },
  signInPanel: {
  backgroundColor: "#FFFFFF",
  borderRadius: 16,
  padding: 20,
  borderWidth: 1,
  borderColor: "#F3DFCB",
},
panelTitle: { color: "#17211D", fontSize: 18, fontWeight: "800" },
panelText: { color: "#6E786F", fontSize: 14, lineHeight: 21, marginTop: 7 },
primary: {
  backgroundColor: "rgba(245, 185, 121, 1)",
  height: 48,
  borderRadius: 24,
  alignItems: "center",
  justifyContent: "center",
  marginTop: 16,
},
primaryText: {
  color: "#FFFFFF",
  fontSize: 11,
  letterSpacing: 2,
  fontWeight: "900",
},
});
