import { ThemedText } from "@/components/themed-text";
import { QuoteActions } from "@/components/quote-actions";
import { useAuth } from "@/context/auth-context";
import { API_BASE_URL, apiImageUrl } from "@/lib/api";
import { goBackOrHome } from "@/lib/navigation";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ShipmentCard } from "@/components/shipment-card";

const ink = "#1A1A1A";
const muted = "#8A8A8A";
const orange = "#F09148";
const orangeDeep = "#E8763A";
const orangeSoft = "#FFF4EB";
const bg = "#FFFAF5";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const fmtDate = (v: unknown) => {
  if (!v) return "";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime())
    ? ""
    : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
const fmtDateTime = (v: unknown) => {
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${h}:${m} ${d.getHours() >= 12 ? "PM" : "AM"}`;
};
const money = (n: unknown) => `₹${Number(n ?? 0).toFixed(2)}`;
const isVideo = (u?: string) =>
  !!u && /\.(mp4|mov|m4v|webm|m3u8)(\?.*)?$/i.test(u);

const getRemarks = (o: any): string => {
  if (!o) return "";
  if (o.status === "CANCELLED") return o.cancelReason?.trim() || "";
  const entry = [...(o.statusHistory ?? [])]
    .reverse()
    .find((h: any) => h.status === "CONFIRMED");
  return entry?.note?.trim() || "";
};

const statusStyle = (status: string, cancelledBy?: string) => {
  switch (status) {
    case "CANCELLED":
      return {
        label:
          cancelledBy === "USER" ? "Cancelled by you" : "Rejected by store",
        color: "#D32F2F",
        bg: "#FFEBEE",
      };
    case "DELIVERED":
      return { label: "Delivered", color: "#22A45D", bg: "#E8F8EF" };
    case "SHIPPED":
      return { label: "Shipped", color: "#2E6ADE", bg: "#EAF2FE" };
    case "CONFIRMED":
      return { label: "Approved", color: "#22A45D", bg: "#E8F8EF" };
    default:
      return { label: "Processing", color: orangeDeep, bg: orangeSoft };
  }
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token || !id) return;
    fetch(`${API_BASE_URL}/order/my-orders/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then((json) => {
        setError(null);
        setOrder(json?.order ?? json);
      })
      .catch((e) => setError(e.message));
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  const baseStyle = statusStyle(order?.status, order?.cancelledBy);
  const st =
    order?.status === "PENDING" && order?.priceStatus === "QUOTED"
      ? { label: "Price received", color: "#2E6ADE", bg: "#EAF2FE" }
      : baseStyle;
  const remarks = getRemarks(order);
  const quoteOpen = order?.status === "PENDING" && order?.priceStatus === "QUOTED";
  const shownTotal =
    Number(order?.totalAmount) > 0
      ? order.totalAmount
      : (order?.quote?.total ?? 0);
  const shownMrp =
    Number(order?.totalMrp) > 0 ? order.totalMrp : shownTotal;
  const addr = order?.deliveryAddress;
  const history: any[] = order?.statusHistory ?? [];
  const eta = fmtDate(order?.expectedDeliveryDate);

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={goBackOrHome} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={ink} />
        </Pressable>
        <ThemedText style={s.headerTitle}>Order Details</ThemedText>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {!order && !error && (
          <ActivityIndicator color={orange} style={{ marginTop: 40 }} />
        )}
        {!!error && (
          <View style={s.card}>
            <ThemedText style={s.cardTitle}>Could not load order</ThemedText>
            <ThemedText style={s.sub}>{error}</ThemedText>
          </View>
        )}

        {order && (
          <>
            {/* Summary */}
            <View style={s.card}>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={s.orderNo}>
                    #{order.orderNumber || order._id}
                  </ThemedText>
                  <ThemedText style={s.sub}>
                    Placed {fmtDateTime(order.createdAt)}
                    {order.storeName ? ` · ${order.storeName}` : ""}
                  </ThemedText>
                </View>
                <View style={[s.badge, { backgroundColor: st.bg }]}>
                  <ThemedText style={[s.badgeText, { color: st.color }]}>
                    {st.label}
                  </ThemedText>
                </View>
              </View>
              {!!eta &&
                order.status !== "CANCELLED" &&
                order.status !== "DELIVERED" && (
                  <View style={s.etaPill}>
                    <Ionicons
                      name="bicycle-outline"
                      size={16}
                      color={orangeDeep}
                    />
                    <ThemedText style={s.etaText}>Delivery by {eta}</ThemedText>
                  </View>
                )}
            </View>

            {/* Price estimate: accept / reject / WhatsApp */}
            {order.status === "PENDING" && order.priceStatus === "QUOTED" && (
              <QuoteActions
                orderId={String(order._id)}
                orderNumber={order.orderNumber}
                total={order.quote?.total}
                onDone={load}
              />
            )}

            {/* Remarks */}
            {!!remarks && ["CONFIRMED", "CANCELLED"].includes(order.status) && (
              <View style={[s.remarks, { backgroundColor: st.bg }]}>
                <ThemedText style={[s.remarksLabel, { color: st.color }]}>
                  {st.label.toUpperCase()}
                </ThemedText>
                <ThemedText style={s.remarksText}>{remarks}</ThemedText>
              </View>
            )}

            {/* Items */}
            <View style={s.card}>
              <ThemedText style={s.cardTitle}>
                Items ({order.totalItems ?? order.items?.length ?? 0})
              </ThemedText>
              {(order.items ?? []).map((it: any, i: number) => {
                const img = apiImageUrl(it.image);
                const label = [it.color, it.size, it.weight, it.height]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <Pressable
                    key={it._id ?? i}
                    style={[s.itemRow, i > 0 && s.itemDivider]}
                    disabled={!it.productId}
                    onPress={() =>
                      router.push({
                        pathname: "/product/[id]",
                        params: { id: String(it.productId) },
                      })
                    }
                  >
                    <View style={s.thumb}>
                      {img && !isVideo(it.image) ? (
                        <Image
                          source={{ uri: img }}
                          style={s.thumbImg}
                          contentFit="contain"
                        />
                      ) : (
                        <Ionicons
                          name="image-outline"
                          size={22}
                          color={muted}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={s.itemName} numberOfLines={2}>
                        {it.name}
                      </ThemedText>
                      {!!label && (
                        <ThemedText style={s.sub}>{label}</ThemedText>
                      )}
                      <ThemedText style={s.sub}>
                        {it.offerPrice != null
                          ? `Qty ${it.quantity} × ₹${it.offerPrice}`
                          : (order.items?.length ?? 0) === 1 &&
                              Number(shownTotal) > 0
                            ? `Qty ${it.quantity} × ₹${(Number(shownTotal) / Number(it.quantity || 1)).toFixed(2)}`
                            : `Qty ${it.quantity} · Price pending`}
                      </ThemedText>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <ThemedText style={s.itemPrice}>
                        {it.lineTotal != null
                          ? money(it.lineTotal)
                          : (order.items?.length ?? 0) === 1 &&
                              Number(shownTotal) > 0
                            ? money(shownTotal)
                            : "—"}
                      </ThemedText>
                      {Number(it.mrp) > Number(it.offerPrice) && (
                        <ThemedText style={s.mrp}>
                          ₹{Number(it.mrp) * Number(it.quantity)}
                        </ThemedText>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Courier & Shipment */}
            <ShipmentCard order={order} />

            {/* Delivery address */}
            {addr && (
              <View style={s.card}>
                <ThemedText style={s.cardTitle}>Delivery address</ThemedText>
                <ThemedText style={s.addrName}>
                  {addr.fullName} · {addr.phone}
                </ThemedText>
                <ThemedText style={s.sub}>
                  {[addr.addressLine, addr.area].filter(Boolean).join(", ")}
                </ThemedText>
                <ThemedText style={s.sub}>
                  {addr.city}, {addr.state} - {addr.pincode}
                </ThemedText>
                {!!order.note && (
                  <ThemedText style={[s.sub, { marginTop: 8 }]}>
                    Note: {order.note}
                  </ThemedText>
                )}
              </View>
            )}

            {/* Payment */}
            <View style={s.card}>
              <ThemedText style={s.cardTitle}>Payment</ThemedText>
              <View style={s.rowBetween}>
                <ThemedText style={s.label}>Total MRP</ThemedText>
                <ThemedText style={s.value}>
                  {Number(shownMrp) > 0 ? money(shownMrp) : "Price pending"}
                </ThemedText>
              </View>
              {Number(order.discount) > 0 && (
                <View style={s.rowBetween}>
                  <ThemedText style={s.label}>Discount</ThemedText>
                  <ThemedText style={[s.value, { color: "#22A45D" }]}>
                    -{money(order.discount)}
                  </ThemedText>
                </View>
              )}
              <View style={s.divider} />
              <View style={s.rowBetween}>
                <ThemedText style={s.totalLabel}>Total</ThemedText>
                <ThemedText style={s.totalValue}>
                  {Number(shownTotal) > 0 ? money(shownTotal) : "Price pending"}
                </ThemedText>
              </View>
              <ThemedText style={[s.sub, { marginTop: 8 }]}>
                {order.paymentMethod === "COD"
                  ? "Cash on Delivery"
                  : order.paymentMethod}
                {order.paymentStatus
                  ? ` · ${String(order.paymentStatus).toLowerCase()}`
                  : ""}
              </ThemedText>
            </View>

            {/* Timeline */}
            {history.length > 0 && (
              <View style={s.card}>
                <ThemedText style={s.cardTitle}>Order timeline</ThemedText>
                {[...history].reverse().map((h, i, arr) => (
                  <View key={i} style={s.tlRow}>
                    <View style={s.tlLeft}>
                      <View style={[s.tlDot, i === 0 && s.tlDotActive]} />
                      {i < arr.length - 1 && <View style={s.tlLine} />}
                    </View>
                    <View style={{ flex: 1, paddingBottom: 14 }}>
                      <ThemedText style={s.tlStatus}>
                        {statusStyle(h.status, order.cancelledBy).label}
                      </ThemedText>
                      <ThemedText style={s.sub}>{fmtDateTime(h.at)}</ThemedText>
                      {!!h.note && (
                        <ThemedText style={s.sub}>{h.note}</ThemedText>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: orange,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  headerTitle: { color: ink, fontSize: 18, fontWeight: "800" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    shadowColor: orange,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTitle: { color: ink, fontSize: 15, fontWeight: "800", marginBottom: 10 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  orderNo: { color: ink, fontSize: 17, fontWeight: "800" },
  sub: { color: muted, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  badgeText: { fontSize: 12, fontWeight: "800" },
  etaPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: orangeSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    marginTop: 12,
  },
  etaText: { color: orangeDeep, fontSize: 13, fontWeight: "700" },
  remarks: { borderRadius: 16, padding: 12, marginBottom: 14 },
  remarksLabel: { fontSize: 11, fontWeight: "800" },
  remarksText: { color: ink, fontSize: 13, marginTop: 4 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  itemDivider: { borderTopWidth: 1, borderTopColor: "#F3EAE0" },
  thumb: {
    width: 62,
    height: 62,
    borderRadius: 14,
    backgroundColor: orangeSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImg: { width: "100%", height: "100%" },
  itemName: { color: ink, fontSize: 14, fontWeight: "700" },
  itemPrice: { color: ink, fontSize: 14, fontWeight: "800" },
  mrp: {
    color: muted,
    fontSize: 11,
    textDecorationLine: "line-through",
    marginTop: 2,
  },
  addrName: { color: ink, fontSize: 14, fontWeight: "800" },
  label: { color: muted, fontSize: 13.5 },
  value: { color: ink, fontSize: 13.5, fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#F3EAE0", marginVertical: 8 },
  totalLabel: { color: ink, fontSize: 15, fontWeight: "800" },
  totalValue: { color: ink, fontSize: 17, fontWeight: "900" },
  tlRow: { flexDirection: "row", gap: 12 },
  tlLeft: { alignItems: "center", width: 14 },
  tlDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E5D5C5",
    marginTop: 3,
  },
  tlDotActive: { backgroundColor: orange },
  tlLine: { flex: 1, width: 2, backgroundColor: "#F3EAE0", marginTop: 2 },
  tlStatus: { color: ink, fontSize: 14, fontWeight: "700" },
});
