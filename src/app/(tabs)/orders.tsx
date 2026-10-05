import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ProductRail } from "@/components/product-rail";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { api, apiImageUrl, type ApiProduct } from "@/lib/api";
import { useStore } from "@/lib/store-context";

const ink = "#211e17";
const muted = "#9AA39B";
const border = "#ECECE6";
const orange = "#F2733B";
const pillBg = "#F1F1EC";
const accent = "rgba(245, 185, 121, 1)";

type OrderRecord = Record<string, unknown>;
type Decision = "APPROVED" | "REJECTED";
type StatusGroup = "PROCESSING" | "APPROVED" | "REJECTED" | "CANCELED";

export type OrderLine = {
  title: string;
  image?: string;
  quantity: number;
  price?: number;
  mrp?: number;
  productCode?: string;
  productId?: string;
  unit?: string;
  size?: string;
  weight?: string | number;
  decision?: Decision;
  remarks?: string;
  cancelledBy?: string;
};
export type OrderView = {
  id: string;
  date: string;
  status: string;
  total: number;
  lines: OrderLine[];
  paymentMethod?: string;
  shippingAddress?: string;
  customerName?: string;
  customerPhone?: string;
  subtotal?: number;
  tax?: number;
  discount?: number;
  deliveryFee?: number;
  orderNumber?: string;
  estimatedDelivery?: string;
  notes?: string;
  cancelledBy?: string;
};

function recordsFromPayload(payload: unknown): OrderRecord[] {
  if (Array.isArray(payload))
    return payload.filter((entry): entry is OrderRecord =>
      Boolean(entry && typeof entry === "object"),
    );
  if (!payload || typeof payload !== "object") return [];
  const object = payload as Record<string, unknown>;
  for (const key of ["orders", "orderList", "order", "data", "results"]) {
    const records = recordsFromPayload(object[key]);
    if (records.length) return records;
  }
  return [object];
}

function textValue(value: unknown, fallback: string) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function readDecision(obj?: Record<string, unknown>): {
  decision?: Decision;
  remarks?: string;
} {
  if (!obj) return {};
  const raw = String(
    obj.approvalStatus ?? obj.decision ?? obj.status ?? "",
  ).toUpperCase();
  const decision =
    raw === "APPROVED" || raw === "REJECTED" ? (raw as Decision) : undefined;
  const remarks = textValue(obj.remarks ?? obj.remark, "");
  return { decision, remarks: remarks || undefined };
}

function lineFromValue(
  value: unknown,
  products: ApiProduct[],
): OrderLine | null {
  if (typeof value === "string") {
    const product = products.find((entry) => entry._id === value);
    return product
      ? {
          title: product.title,
          image: product.image,
          price: product.price,
          quantity: 1,
          productId: product._id,
        }
      : { title: "Product unavailable", quantity: 1, productId: value };
  }
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const productValue = item.product ?? item.productDetails ?? item.productId;
  const product =
    typeof productValue === "string"
      ? products.find((entry) => entry._id === productValue)
      : (productValue as Record<string, unknown> | undefined);
  const productId =
    typeof productValue === "string"
      ? productValue
      : typeof product?._id === "string"
        ? product._id
        : undefined;
  const title = textValue(
    item.title ?? item.name ?? product?.title,
    product ? "Product" : "Product unavailable",
  );
  const image =
    typeof (item.image ?? product?.image) === "string"
      ? String(item.image ?? product?.image)
      : undefined;
  const priceValue = Number(
    item.offerPrice ?? item.price ?? item.productPrice ?? product?.price,
  );
  const mrpValue = Number(item.mrp ?? product?.originalPrice ?? priceValue);
  return {
    title,
    image,
    quantity: Number(item.quantity ?? item.qty ?? 1) || 1,
    price: Number.isFinite(priceValue) ? priceValue : undefined,
    mrp: Number.isFinite(mrpValue) ? mrpValue : undefined,
    productCode:
      typeof item.productCode === "string" ? item.productCode : undefined,
    productId,
    unit: typeof item.unit === "string" ? item.unit : undefined,
    size: typeof item.size === "string" ? item.size : undefined,
    weight:
      typeof item.weight === "string" || typeof item.weight === "number"
        ? item.weight
        : undefined,
    ...readDecision(item),
  };
}

function toOrderView(
  record: OrderRecord,
  index: number,
  products: ApiProduct[],
): OrderView {
  const rawItems =
    record.items ?? record.products ?? record.orderItems ?? record.cartItems;
  const rawLines = (
    Array.isArray(rawItems) ? rawItems : [record.product ?? rawItems]
  )
    .map((value) => lineFromValue(value, products))
    .filter((line): line is OrderLine => Boolean(line));
  const orderDecision = readDecision(record);
  const orderStatus = String(record.status ?? "").toUpperCase();
  const history = Array.isArray(record.statusHistory)
    ? (record.statusHistory as Record<string, unknown>[])
    : [];
  const confirmedNote = [...history]
    .reverse()
    .find((h) => String(h?.status).toUpperCase() === "CONFIRMED")?.note;
  const backendRemarks =
    orderStatus === "CANCELLED"
      ? textValue(record.cancelReason, "").trim()
      : orderStatus === "CONFIRMED"
        ? textValue(confirmedNote, "").trim()
        : "";
  const cancelledBy =
    typeof record.cancelledBy === "string" ? record.cancelledBy : undefined;
  const lines = rawLines.map((line) => ({
    ...line,
    decision: line.decision ?? orderDecision.decision,
    remarks:
      line.remarks ?? orderDecision.remarks ?? (backendRemarks || undefined),
    cancelledBy,
  }));
  const dateValue = record.createdAt ?? record.orderDate ?? record.date;
  const date = dateValue
    ? new Date(String(dateValue))
        .toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        })
        .toUpperCase()
    : "RECENT ORDER";
  const totalValue = Number(
    record.totalAmount ??
      record.totalPrice ??
      record.total ??
      record.grandTotal ??
      lines.reduce((sum, line) => sum + (line.price ?? 0) * line.quantity, 0),
  );
  return {
    id: textValue(
      record._id ?? record.orderId ?? record.orderNumber,
      `ORDER-${index + 1}`,
    ),
    date,
    status: textValue(
      record.status ?? record.orderStatus,
      "PROCESSING",
    ).toUpperCase(),
    total: Number.isFinite(totalValue) ? totalValue : 0,
    lines,
    paymentMethod: textValue(
      record.paymentMethod ??
        record.paymentType ??
        (typeof record.payment === "object" && record.payment
          ? (record.payment as Record<string, unknown>).method
          : undefined),
      "",
    ),
    shippingAddress: textValue(
      record.shippingAddress ??
        record.address ??
        record.deliveryAddress,
      "",
    ),
    customerName: textValue(
      record.customerName ??
        record.name ??
        (typeof record.customer === "object" && record.customer
          ? (record.customer as Record<string, unknown>).name
          : undefined),
      "",
    ),
    customerPhone: textValue(
      record.customerPhone ??
        record.phone ??
        (typeof record.customer === "object" && record.customer
          ? (record.customer as Record<string, unknown>).phone
          : undefined),
      "",
    ),
    subtotal: Number.isFinite(
      Number(record.subtotal ?? record.subTotal ?? record.subtotalPrice),
    )
      ? Number(record.subtotal ?? record.subTotal ?? record.subtotalPrice)
      : undefined,
    tax: Number.isFinite(Number(record.tax ?? record.taxAmount))
      ? Number(record.tax ?? record.taxAmount)
      : undefined,
    discount: Number.isFinite(
      Number(record.discount ?? record.discountAmount),
    )
      ? Number(record.discount ?? record.discountAmount)
      : undefined,
    deliveryFee: Number.isFinite(
      Number(record.deliveryFee ?? record.shippingCost ?? record.deliveryCharge),
    )
      ? Number(record.deliveryFee ?? record.shippingCost ?? record.deliveryCharge)
      : undefined,
    orderNumber: textValue(
      record.orderNumber ?? record.orderId ?? record._id,
      "",
    ),
    estimatedDelivery: textValue(
      record.estimatedDelivery ?? record.deliveryDate ?? record.estimatedDate,
      "",
    ),
    notes: textValue(record.notes ?? record.remarks ?? record?.orderNotes, ""),
    cancelledBy,
  };
}

// Maps the raw backend order status into one of the three tabs shown in the UI.
function statusGroup(status: string, cancelledBy?: string): StatusGroup {
  const s = status.toUpperCase();
  if (s === "APPROVED" || s === "CONFIRMED") return "APPROVED";
  if (s === "REJECTED") return "REJECTED";
  if (s === "CANCELLED" || s === "CANCELED")
    return cancelledBy === "STORE" ? "REJECTED" : "CANCELED";
  return "PROCESSING";
}

const lineGroup = (order: OrderView, line: OrderLine): StatusGroup =>
  line.decision ?? statusGroup(order.status, order.cancelledBy);

const TABS: { key: StatusGroup; label: string }[] = [
  { key: "PROCESSING", label: "Processing" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELED", label: "Canceled" },
];

export default function OrdersScreen() {
  const { token } = useAuth();
  const { storeId } = useStore();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [orders, setOrders] = useState<OrderView[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<StatusGroup>("PROCESSING");

  const load = () => {
    if (!storeId) {
      setProducts([]);
      setOrders([]);
      setLoading(false);
      return;
    }
    api
      .allProducts(storeId)
      .then(setProducts)
      .catch(() => undefined);
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    Promise.all([api.orders(token), api.allProducts(storeId)])
      .then(([payload, catalog]) => {
        setProducts(catalog);
        setOrders(
          recordsFromPayload(payload).map((record, index) =>
            toOrderView(record, index, catalog),
          ),
        );
      })
      .catch((requestError) =>
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load orders.",
        ),
      )
      .finally(() => setLoading(false));
  };

  const handleCancel = (orderId: string) => {
    if (!token) return;
    Alert.alert(
      "Cancel order",
      "Are you sure you want to cancel this order?",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel order",
          style: "destructive",
          onPress: async () => {
            try {
              await api.cancelOrder(token, orderId, "Changed my mind");
              load();
            } catch (error) {
              Alert.alert(
                "Could not cancel",
                error instanceof Error
                  ? error.message
                  : "Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  useEffect(load, [token, storeId]);

  useEffect(() => {
  if (!id || !orders.length) return;

  const targetOrder = orders.find(
    (order) =>
      order.id === String(id) ||
      order.orderNumber === String(id),
  );

  if (!targetOrder) return;

  setActiveTab(statusGroup(targetOrder.status, targetOrder.cancelledBy));
}, [id, orders]);

  const filteredOrders = useMemo(
    () =>
      orders
        .map((order) => ({
          ...order,
          lines: order.lines.filter((l) => lineGroup(order, l) === activeTab),
        }))
        .filter((order) => order.lines.length > 0),
    [orders, activeTab],
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.headerIconButton}
        >
          <Ionicons name="chevron-back" size={22} color={ink} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>My Orders</ThemedText>
        <Pressable hitSlop={12} style={styles.headerIconButton}>
          <Ionicons name="search" size={20} color={ink} />
        </Pressable>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabPill, isActive && styles.tabPillActive]}
            >
              <ThemedText
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
              >
                {tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!token && (
          <View style={styles.signInPanel}>
            <ThemedText style={styles.panelTitle}>
              Your orders live here
            </ThemedText>
            <ThemedText style={styles.panelText}>
              Sign in to see orders created with your account.
            </ThemedText>
            <Pressable
              onPress={() => router.push("/sign-in")}
              style={styles.primary}
            >
              <ThemedText style={styles.primaryText}>SIGN IN</ThemedText>
            </Pressable>
          </View>
        )}
        {loading && (
          <View style={styles.state}>
            <ActivityIndicator color={ink} />
            <ThemedText style={styles.panelText}>
              Loading your orders...
            </ThemedText>
          </View>
        )}
        {Boolean(error) && (
          <View style={styles.signInPanel}>
            <ThemedText style={styles.panelTitle}>
              Orders could not load
            </ThemedText>
            <ThemedText style={styles.panelText}>{error}</ThemedText>
            <Pressable onPress={load} style={styles.outline}>
              <ThemedText style={styles.outlineText}>TRY AGAIN</ThemedText>
            </Pressable>
          </View>
        )}
        {!loading && !error && token && !filteredOrders.length && (
          <View style={styles.state}>
            <ThemedText style={styles.panelTitle}>
              No {activeTab.toLowerCase()} orders
            </ThemedText>
            <ThemedText style={styles.panelText}>
              Orders in this category will appear here.
            </ThemedText>
          </View>
        )}
        <View style={styles.orderList}>
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onCancel={handleCancel}
            />
          ))}
        </View>
        <ProductRail title="For You" products={products} showArrow={false} />
      </ScrollView>
    </SafeAreaView>
  );
}

function OrderCard({
  order,
  onCancel,
}: {
  order: OrderView;
  onCancel: (id: string) => void;
}) {
  return (
    <View style={styles.orderList}>
      {order.lines.map((line, idx) => {
        const lineImage = apiImageUrl(line.image);
        const group = lineGroup(order, line);
        const canCancel = group === "PROCESSING";
        return (
          <Pressable
            key={`${order.id}-line-${idx}`}
            style={styles.card}
            disabled={!line.productId}
            onPress={() =>
              line.productId &&
              router.push({
                pathname: "/product/[id]",
                params: { id: line.productId },
              })
            }
          >
            <View style={styles.cardRow}>
              <View style={styles.thumbFrame}>
                {lineImage ? (
                  <Image
                    source={{ uri: lineImage }}
                    style={styles.thumb}
                    contentFit="cover"
                  />
                ) : (
                  <ThemedText style={styles.thumbPlaceholder}>—</ThemedText>
                )}
              </View>
                            <View style={styles.cardBody}>
                <ThemedText style={styles.cardTitle} numberOfLines={1}>
                  {line.title}
                  {line.quantity > 1 ? ` × ${line.quantity}` : ""}
                </ThemedText>
                <ThemedText style={styles.cardOrderId}>
                  Order ID - {order.orderNumber || order.id}
                </ThemedText>
                {(line.size || line.weight || line.unit) && (
                  <ThemedText style={styles.cardMeta}>
                    {[line.size, line.weight, line.unit]
                      .filter(Boolean)
                      .join(" · ")}
                  </ThemedText>
                )}
                {line.productCode && (
                  <ThemedText style={styles.cardMeta}>
                    Code: {line.productCode}
                  </ThemedText>
                )}
              </View>
              <View style={styles.cardPriceGroup}>
                <ThemedText style={styles.cardPrice}>
                  ₹{(line.price ?? 0).toFixed(2)}
                </ThemedText>
                {line.mrp !== undefined && line.mrp > (line.price ?? 0) && (
                  <ThemedText style={styles.cardMrp}>
                    ₹{line.mrp.toFixed(2)}
                  </ThemedText>
                )}
              </View>
            </View>

            {(group === "APPROVED" || group === "REJECTED") &&
              !!line.remarks && (
              <View
                style={[
                  styles.remarksBox,
                  group === "APPROVED"
                    ? styles.remarksApproved
                    : styles.remarksRejected,
                ]}
              >
                <ThemedText
                  style={[
                    styles.remarksStatus,
                    { color: group === "APPROVED" ? "#2E7D4F" : "#B84A36" },
                  ]}
                >
                  {group === "APPROVED"
                    ? "Approved"
                    : line.cancelledBy === "USER"
                      ? "Cancelled by you"
                      : "Rejected"}
                </ThemedText>
                <ThemedText style={styles.remarksText}>
                  Remarks: {line.remarks}
                </ThemedText>
              </View>
            )}

            {group === "PROCESSING" && (
              <View style={styles.reviewRow}>
                <ThemedText style={styles.reviewText}>
                  We're getting your order ready.
                </ThemedText>
                {canCancel && (
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => onCancel(order.id)}
                  >
                    <ThemedText style={styles.cancelButtonText}>
                      Cancel Order
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            )}

            {group === "CANCELED" && (
              <View style={styles.reviewRow}>
                <ThemedText style={styles.reviewText}>
                  This order was canceled.
                </ThemedText>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  headerIconButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: ink,
    fontSize: 17,
    fontWeight: "700",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: pillBg,
    borderRadius: 24,
    marginHorizontal: 16,
    padding: 4,
    gap: 4,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tabPillActive: {
    backgroundColor: accent,
  },
  tabLabel: {
    color: muted,
    fontSize: 12,
    fontWeight: "700",
  },
  tabLabelActive: {
    color: ink,
  },
  content: { padding: 16, paddingBottom: 130 },
  orderList: { gap: 12 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: "#FFFFFF",
    padding: 12,
    gap: 10,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  thumbFrame: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: pillBg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumb: { width: "100%", height: "100%" },
  thumbPlaceholder: { color: muted, fontSize: 12 },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: {
    color: ink,
    fontSize: 14,
    fontWeight: "700",
  },
  cardOrderId: {
    color: muted,
    fontSize: 11,
    fontWeight: "600",
  },
  cardPrice: {
    color: ink,
    fontSize: 14,
    fontWeight: "800",
  },
  cardPriceGroup: {
    alignItems: "flex-end",
    gap: 2,
  },
  cardMrp: {
    color: muted,
    fontSize: 11,
    fontWeight: "600",
    textDecorationLine: "line-through",
  },
  cardMeta: {
    color: muted,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  reviewText: {
    flex: 1,
    color: muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500",
  },
  reviewButton: {
    backgroundColor: orange,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  reviewButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  cancelButton: {
    backgroundColor: "#B84A36",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  remarksBox: { borderRadius: 10, padding: 10, gap: 3 },
  remarksApproved: { backgroundColor: "#E9F5EE" },
  remarksRejected: { backgroundColor: "#FBEAE6" },
  remarksStatus: { fontSize: 12, fontWeight: "800" },
  remarksText: { color: ink, fontSize: 12, lineHeight: 17, fontWeight: "500" },
  signInPanel: {
    backgroundColor: pillBg,
    borderRadius: 14,
    padding: 20,
    marginTop: 12,
  },
  panelTitle: { color: ink, fontSize: 18, fontWeight: "800" },
  panelText: { color: muted, fontSize: 14, lineHeight: 21, marginTop: 7 },
  primary: {
    backgroundColor: accent,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  primaryText: {
    color: ink,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "900",
  },
  outline: {
    height: 44,
    borderWidth: 1,
    borderColor: ink,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  outlineText: {
    color: ink,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "900",
  },
  state: { alignItems: "center", paddingVertical: 38 },
});