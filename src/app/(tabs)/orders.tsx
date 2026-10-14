import { ProductRail } from "@/components/product-rail";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { api, apiImageUrl, type ApiProduct } from "@/lib/api";
import { useStore } from "@/lib/store-context";
import { usePincode } from "@/lib/use-pincode";
import { usePayuPayment } from "@/lib/use-payu-payment";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ink = "#211e17";
const muted = "#9AA39B";
const border = "#ECECE6";
const orange = "#F2733B";
const pillBg = "#F1F1EC";
const accent = "rgba(245, 185, 121, 1)";

type OrderRecord = Record<string, unknown>;
type Decision = "APPROVED" | "REJECTED";
type StatusGroup =
  | "PROCESSING"
  | "APPROVED"
  | "DELIVERED"
  | "REJECTED"
  | "CANCELED";

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
  lineId?: string;
  cancelled?: boolean;
};
export type OrderView = {
  id: string;
  date: string;
  createdAtMs?: number;
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
  shippedAt?: string;
  deliveredAt?: string;
  steps?: { label: string; date: string }[];
  notes?: string;
  cancelledBy?: string;
  paymentStatus?: string;
  priceStatus?: string;
  paymentExpiresAt?: string;
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

// "08 Oct 2026", or "" when the value is missing or not a date
function fmtDate(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// date of the latest status-history entry with this status
function historyDate(
  history: Record<string, unknown>[],
  status: string,
): string {
  const entry = [...history]
    .reverse()
    .find((h) => String(h?.status).toUpperCase() === status);
  if (!entry) return "";
  return fmtDate(
    entry.date ??
      entry.changedAt ??
      entry.updatedAt ??
      entry.createdAt ??
      entry.timestamp ??
      entry.at,
  );
}

const STEP_FLOW = [
  { status: "PENDING", label: "Order placed" },
  { status: "CONFIRMED", label: "Confirmed" },
  { status: "SHIPPED", label: "Shipped" },
  { status: "DELIVERED", label: "Delivered" },
];

// the steps an order has reached so far, each with its date
function buildSteps(
  orderStatus: string,
  history: Record<string, unknown>[],
  placedValue: unknown,
): { label: string; date: string }[] {
  const reached =
    orderStatus === "APPROVED"
      ? 1
      : STEP_FLOW.findIndex((s) => s.status === orderStatus);
  if (reached < 0) return []; // cancelled / rejected / unknown
  return STEP_FLOW.slice(0, reached + 1).map((s) => ({
    label: s.label,
    date:
      historyDate(history, s.status) ||
      (s.status === "PENDING" ? fmtDate(placedValue) : ""),
  }));
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
    lineId: typeof item._id === "string" ? item._id : undefined,
    cancelled: ["CANCELLED", "CANCELED"].includes(
      String(item.status ?? item.itemStatus ?? "").toUpperCase(),
    ),
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
      : ["CONFIRMED", "SHIPPED", "DELIVERED"].includes(orderStatus)
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
    ? (() => {
        const d = new Date(String(dateValue));
        const p = (n: number) => String(n).padStart(2, "0");
        return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
      })()
    : "RECENT ORDER";
  const totalValue =
    [
      record.totalAmount,
      record.totalPrice,
      record.total,
      record.grandTotal,
      (record.quote as Record<string, unknown> | undefined)?.total,
    ]
      .map(Number)
      .find((n) => Number.isFinite(n) && n > 0) ??
    lines.reduce((sum, line) => sum + (line.price ?? 0) * line.quantity, 0);
  // single-item orders: the quoted total is the item's price
  const pricedLines =
    lines.length === 1 && !((lines[0].price ?? 0) > 0) && totalValue > 0
      ? [{ ...lines[0], price: totalValue / lines[0].quantity, mrp: undefined }]
      : lines;
  return {
    id: textValue(
      record._id ?? record.orderId ?? record.orderNumber,
      `ORDER-${index + 1}`,
    ),
    date,
    createdAtMs: dateValue ? new Date(String(dateValue)).getTime() : undefined,
    status: textValue(
      record.status ?? record.orderStatus,
      "PROCESSING",
    ).toUpperCase(),
    total: Number.isFinite(totalValue) ? totalValue : 0,
    lines: pricedLines,
    paymentMethod: textValue(
      record.paymentMethod ??
        record.paymentType ??
        (typeof record.payment === "object" && record.payment
          ? (record.payment as Record<string, unknown>).method
          : undefined),
      "",
    ),
    shippingAddress: textValue(
      record.shippingAddress ?? record.address ?? record.deliveryAddress,
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
    discount: Number.isFinite(Number(record.discount ?? record.discountAmount))
      ? Number(record.discount ?? record.discountAmount)
      : undefined,
    deliveryFee: Number.isFinite(
      Number(
        record.deliveryFee ?? record.shippingCost ?? record.deliveryCharge,
      ),
    )
      ? Number(
          record.deliveryFee ?? record.shippingCost ?? record.deliveryCharge,
        )
      : undefined,
    orderNumber: textValue(
      record.orderNumber ?? record.orderId ?? record._id,
      "",
    ),
    estimatedDelivery: fmtDate(
      record.expectedDelivery ??
        record.expectedDeliveryDate ??
        record.estimatedDelivery ??
        record.estimatedDeliveryDate ??
        record.deliveryDate ??
        record.estimatedDate,
    ),
    steps: buildSteps(orderStatus, history, dateValue),
    shippedAt:
      historyDate(history, "SHIPPED") ||
      fmtDate(record.shippedAt ?? record.shippedDate),
    deliveredAt:
      historyDate(history, "DELIVERED") ||
      fmtDate(record.deliveredAt ?? record.deliveredDate),
    notes: textValue(record.notes ?? record.remarks ?? record?.orderNotes, ""),
    cancelledBy,
    paymentStatus: textValue(record.paymentStatus, ""),
    priceStatus: textValue(record.priceStatus, ""),
    paymentExpiresAt: textValue(record.paymentExpiresAt, ""),
  };
}

// Maps the raw backend order status into one of the dropdown options.
// PENDING -> Processing, CONFIRMED / SHIPPED -> Approved, DELIVERED -> Delivered
function statusGroup(status: string, cancelledBy?: string): StatusGroup {
  const s = status.toUpperCase();
  if (s === "DELIVERED") return "DELIVERED";
  if (s === "APPROVED" || s === "CONFIRMED" || s === "SHIPPED")
    return "APPROVED";
  if (s === "REJECTED") return "REJECTED";
  if (s === "CANCELLED" || s === "CANCELED")
    return cancelledBy === "STORE" ? "REJECTED" : "CANCELED";
  return "PROCESSING";
}

const lineGroup = (order: OrderView, line: OrderLine): StatusGroup => {
  if (line.cancelled) return "CANCELED";
  const orderGroup = statusGroup(order.status, order.cancelledBy);
  if (orderGroup === "DELIVERED") return "DELIVERED";
  return line.decision ?? orderGroup;
};

const TABS: { key: StatusGroup; label: string }[] = [
  { key: "PROCESSING", label: "Processing" },
  { key: "APPROVED", label: "Approved" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELED", label: "Canceled" },
];

const navy = "#0B1F6B";
const screenBg = "#F6F7FC";
const fieldBorder = "#D9DCE6";
const PASTELS = ["#FBE4EA", "#DCEBFA", "#D8F3F1", "#FDEBD3"];


const CANCEL_WINDOW_DAYS = 10;
// true while the order is within 10 days of being placed
// (if the date is missing, allow it and let the backend decide)
const cancelWindowOpen = (order: { createdAtMs?: number }) => {
  const t = order.createdAtMs;
  if (t === undefined || Number.isNaN(t)) return true;
  return Date.now() - t <= CANCEL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
};

const FAILED_TIMEOUT_SECONDS = 20;
const isPaymentFailed = (order: OrderView) =>
  (order.paymentStatus ?? "").toUpperCase() === "FAILED" &&
  order.status === "PENDING";

export default function OrdersScreen() {
  const { token } = useAuth();
  const { storeId } = useStore();
  const pincode = usePincode();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [orders, setOrders] = useState<OrderView[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<StatusGroup>("PROCESSING");
  const [orderIdQuery, setOrderIdQuery] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const payu = usePayuPayment();
  const deadlines = useRef<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());
  const [cancelTarget, setCancelTarget] = useState<{
    orderId: string;
    line: OrderLine;
  } | null>(null);

  // start a 20s countdown for each failed-payment order, and tick every second
  useEffect(() => {
    const failed = orders.filter(isPaymentFailed);
    if (!failed.length) return;
    failed.forEach((o) => {
      if (!deadlines.current[o.id]) {
        deadlines.current[o.id] = Date.now() + FAILED_TIMEOUT_SECONDS * 1000;
      }
    });
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [orders]);

  const load = () => {
    if (!storeId) {
      setProducts([]);
      setOrders([]);
      setLoading(false);
      return;
    }
    api
      .allProducts(storeId, pincode)
      .then(setProducts)
      .catch(() => undefined);
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    Promise.all([api.orders(token), api.allProducts(storeId, pincode)])
      .then(([payload, catalog]) => {
        console.log(
          "ORDERS RAW:",
          JSON.stringify(recordsFromPayload(payload).slice(0, 2)).slice(
            0,
            2500,
          ),
        );
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
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  const onRefresh = () => {
    if (!token || !storeId) return;
    setRefreshing(true);
    load();
  };

  const handleCancel = (orderId: string, line: OrderLine) => {
    if (!token) return;
    const target = orders.find((o) => o.id === orderId);
    if (target && !cancelWindowOpen(target)) {
      Alert.alert(
        "Cannot cancel",
        `Orders can only be cancelled within ${CANCEL_WINDOW_DAYS} days of ordering.`,
      );
      return;
    }
    setCancelTarget({ orderId, line });
  };

  const confirmCancel = async () => {
    if (!token || !cancelTarget) return;
    const { orderId, line } = cancelTarget;
    setCancelTarget(null);
    try {
      await api.cancelOrder(token, orderId, "Changed my mind", {
        itemId: line.lineId,
        productId: line.productId,
      });
      load();
    } catch (error) {
      Alert.alert(
        "Could not cancel",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  useEffect(load, [token, storeId]);

  useEffect(() => {
    if (!id || !orders.length) return;

    const targetOrder = orders.find(
      (order) => order.id === String(id) || order.orderNumber === String(id),
    );

    if (!targetOrder) return;

    setActiveTab(statusGroup(targetOrder.status, targetOrder.cancelledBy));
  }, [id, orders]);

  const filteredOrders = useMemo(() => {
    const q = orderIdQuery.trim().toLowerCase();
    return orders
      .filter(
        (order) =>
          !q ||
          order.id.toLowerCase().includes(q) ||
          (order.orderNumber ?? "").toLowerCase().includes(q),
      )
      .filter((order) => {
        if (!isPaymentFailed(order)) return true;
        const deadline = deadlines.current[order.id];
        return !deadline || deadline > now;
      })
      .map((order) => ({
        ...order,
        lines: order.lines.filter((l) => lineGroup(order, l) === activeTab),
      }))
      .filter((order) => order.lines.length > 0);
  }, [orders, activeTab, orderIdQuery, now]);

  const activeLabel =
    TABS.find((tab) => tab.key === activeTab)?.label ?? "Select Any";

  // cards get a pastel thumbnail colour in turn, across all orders
  let cardOffset = 0;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={ink} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Order History</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >


        {/* Filters */}
        <View style={styles.filterRow}>
          <View style={styles.filterCol}>
            <ThemedText style={styles.filterLabel}>Order ID</ThemedText>
            <TextInput
              value={orderIdQuery}
              onChangeText={setOrderIdQuery}
              placeholder="Enter Order ID"
              placeholderTextColor="#8A8FA3"
              autoCapitalize="none"
              style={styles.filterInput}
            />
          </View>
          <View style={styles.filterCol}>
            <ThemedText style={styles.filterLabel}>Order Status</ThemedText>
            <Pressable
              style={styles.filterSelect}
              onPress={() => setStatusOpen((v) => !v)}
            >
              <ThemedText style={styles.filterSelectText} numberOfLines={1}>
                {activeLabel}
              </ThemedText>
              <Ionicons
                name={statusOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={ink}
              />
            </Pressable>
          </View>
        </View>

        {statusOpen && (
          <View style={styles.menu}>
            {TABS.map((tab, i) => {
              const selected = tab.key === activeTab;
              return (
                <Pressable
                  key={tab.key}
                  style={[styles.menuItem, i > 0 && styles.menuItemDivider]}
                  onPress={() => {
                    setActiveTab(tab.key);
                    setStatusOpen(false);
                  }}
                >
                  <ThemedText
                    style={[
                      styles.menuText,
                      selected && styles.menuTextSelected,
                    ]}
                  >
                    {tab.label}
                  </ThemedText>
                  {selected && (
                    <Ionicons name="checkmark" size={18} color={navy} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

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
        {loading && !refreshing && (
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
            <Pressable onPress={() => load()} style={styles.outline}>
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
          {filteredOrders.map((order) => {
            const offset = cardOffset;
            cardOffset += order.lines.length;
            return (
              <OrderCard
                key={order.id}
                order={order}
                offset={offset}
                products={products}
                secondsLeft={
                  deadlines.current[order.id]
                    ? Math.max(
                        0,
                        Math.ceil((deadlines.current[order.id] - now) / 1000),
                      )
                    : undefined
                }
                onCancel={handleCancel}
                onPay={(o, title) => {
                  delete deadlines.current[o.id]; // don't remove it mid-payment
                  void payu.start(o.id, String(o.total), title);
                }}
              />
            );
          })}
        </View>
        <ProductRail title="For You" products={products} showArrow={false} />
      </ScrollView>
      {payu.element}
      <ConfirmDialog
        visible={!!cancelTarget}
        title="Cancel Order"
        message={`Cancel "${cancelTarget?.line.title ?? ""}" from this order?`}
        confirmText="Cancel Order"
        destructive
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => void confirmCancel()}
      />
    </SafeAreaView>
  );
}

function OrderCard({
  order,
  offset,
  products,
  secondsLeft,
  onCancel,
  onPay,
}: {
  order: OrderView;
  offset: number;
  products: ApiProduct[];
  secondsLeft?: number;
  onCancel: (id: string, line: OrderLine) => void;
  onPay: (order: OrderView, title: string) => void;
}) {
  const payStatus = (order.paymentStatus ?? "").toUpperCase();
  const orderGroup = statusGroup(order.status, order.cancelledBy);
  const alreadyPaid = [
    "PAID",
    "SUCCESS",
    "SUCCESSFUL",
    "COMPLETED",
    "CAPTURED",
  ].includes(payStatus);
  const canPay =
    !alreadyPaid &&
    (orderGroup === "PROCESSING" || orderGroup === "APPROVED") &&
    order.total > 0;
  const payFailed = payStatus === "FAILED";

  return (
    <View style={styles.orderList}>
      {order.lines.map((line, idx) => {
        const lineImage = apiImageUrl(line.image);
        const group = lineGroup(order, line);
        const windowOpen = cancelWindowOpen(order);
        const canCancel = group === "PROCESSING" && windowOpen;
        const steps = order.steps ?? [];
        const tint = PASTELS[(offset + idx) % PASTELS.length];
        return (
          <Pressable
            key={`${order.id}-line-${idx}`}
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: "/order/[id]",
                params: { id: order.id },
              })
            }
          >
            <View style={styles.cardRow}>
              <View style={styles.thumbFrame}>
                {lineImage ? (
                  <Image
                    source={{ uri: lineImage }}
                    style={styles.thumb}
                    contentFit="contain"
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
                <ThemedText style={styles.cardMeta} numberOfLines={1}>
                  ID: {order.orderNumber || order.id}
                </ThemedText>
                <ThemedText style={styles.cardMeta}>{order.date}</ThemedText>

              </View>

              <View style={styles.cardRight}>
                <View style={styles.cardPriceGroup}>
                  <ThemedText style={styles.cardPrice}>
                    {(line.price ?? 0) > 0
                      ? `₹${((line.price ?? 0) * line.quantity).toFixed(2)}`
                      : "Price pending"}
                  </ThemedText>
                  {(line.price ?? 0) > 0 && line.quantity > 1 && (
                    <ThemedText style={styles.cardEach}>
                      ₹{(line.price ?? 0).toFixed(2)} each
                    </ThemedText>
                  )}
                  {line.mrp !== undefined && line.mrp > (line.price ?? 0) && (
                    <ThemedText style={styles.cardMrp}>
                      ₹{(line.mrp * line.quantity).toFixed(2)}
                    </ThemedText>
                  )}
                </View>
                <ThemedText style={styles.viewDetails}>View details</ThemedText>
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

            {(group === "PROCESSING" ||
              group === "APPROVED" ||
              group === "DELIVERED") &&
              steps.length > 0 && (
                <View style={styles.stepsBox}>
                  {steps.map((step, i) => {
                    const last = i === steps.length - 1;
                    return (
                      <View key={step.label} style={styles.stepRow}>
                        <View style={styles.stepRail}>
                          <View
                            style={[
                              styles.stepDot,
                              last && styles.stepDotCurrent,
                            ]}
                          />
                          {!last && <View style={styles.stepLine} />}
                        </View>
                        <View
                          style={[
                            styles.stepBody,
                            last && { paddingBottom: 0 },
                          ]}
                        >
                          <View style={styles.stepTop}>
                            <ThemedText
                              style={[
                                styles.stepLabel,
                                last && styles.stepLabelCurrent,
                              ]}
                            >
                              {step.label}
                            </ThemedText>
                            {!!step.date && (
                              <ThemedText style={styles.stepDate}>
                                {step.date}
                              </ThemedText>
                            )}
                          </View>
                          {last &&
                            step.label === "Shipped" &&
                            !!order.estimatedDelivery && (
                              <ThemedText style={styles.stepMeta}>
                                Expected delivery: {order.estimatedDelivery}
                              </ThemedText>
                            )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            {(((canPay || alreadyPaid) && idx === 0) || canCancel) && (
              <View style={styles.actionRow}>
                {canPay && idx === 0 ? (
                  <View style={{ gap: 4 }}>
                    <Pressable
                      hitSlop={8}
                      onPress={() => onPay(order, line.title)}
                      style={payFailed ? styles.retryBtn : styles.payBtn}
                    >
                      <ThemedText style={styles.payBtnText}>
                        {payFailed ? "Retry payment" : "Pay now"}
                      </ThemedText>
                    </Pressable>
                    {payFailed && secondsLeft !== undefined && (
                      <ThemedText style={styles.retryTimer}>
                        Payment failed. Removing in {secondsLeft}s
                      </ThemedText>
                    )}
                  </View>
                ) : alreadyPaid && idx === 0 ? (
                  <View style={styles.paidBadge}>
                    <Ionicons name="checkmark-circle" size={12} color="#2E7D4F" />
                    <ThemedText style={styles.paidBadgeText}>Paid</ThemedText>
                  </View>
                ) : (
                  <View />
                )}
                {canCancel && (
                  <Pressable
                    accessibilityLabel={`Cancel ${line.title}`}
                    hitSlop={8}
                    onPress={() => onCancel(order.id, line)}
                    style={styles.cancelBtn}
                  >
                    <ThemedText style={styles.cancelBtnText}>
                      Cancel Order
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            )}

            {group === "PROCESSING" && !windowOpen && (
              <ThemedText style={styles.cancelExpired}>
                Orders can only be cancelled within {CANCEL_WINDOW_DAYS} days.
              </ThemedText>
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
  screen: { flex: 1, backgroundColor: screenBg },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  headerTitle: { color: ink, fontSize: 18, fontWeight: "700" },
  headerSpacer: { width: 40, height: 40 },

  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 130 },

  /* Totals pill */
  statPill: {
    flexDirection: "row",
    backgroundColor: "#ECEEF7",
    borderRadius: 30,
    padding: 4,
  },
  statActive: {
    flex: 1.25,
    height: 48,
    borderRadius: 26,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
  },
  statActiveText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  statIdle: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  statIdleText: { color: "#4A4F63", fontSize: 14, fontWeight: "600" },

  /* Dashed divider */
  dashWrap: { height: 1, overflow: "hidden", marginTop: 18, marginBottom: 18 },
  dash: {
    height: 2,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#C9CDDA",
  },

  /* Filters */
  filterRow: { flexDirection: "row", gap: 12 },
  filterCol: { flex: 1 },
  filterLabel: {
    color: ink,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  filterInput: {
    height: 48,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: fieldBorder,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    color: ink,
    fontSize: 14,
  },
  filterSelect: {
    height: 48,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: fieldBorder,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  filterSelectText: { flex: 1, color: ink, fontSize: 14 },

  menu: {
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: fieldBorder,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  menuItemDivider: { borderTopWidth: 1, borderTopColor: "#EEF0F6" },
  menuText: { color: ink, fontSize: 14, fontWeight: "500" },
  menuTextSelected: { fontWeight: "800", color: navy },

  /* Cards */
  orderList: { gap: 14, marginTop: 18 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 12,
    gap: 10,
    shadowColor: "#1B2559",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  thumbFrame: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  thumb: { width: "100%", height: "100%" },
  thumbPlaceholder: { color: muted, fontSize: 12 },
  cardBody: { flex: 1, minWidth: 0, gap: 3, justifyContent: "center" },
  cardTitle: { color: ink, fontSize: 15, fontWeight: "700" },
  cardMeta: { color: "#7B8094", fontSize: 12, fontWeight: "500" },
  cardRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  cardPriceGroup: { alignItems: "flex-end", gap: 2 },
  cardPrice: { color: ink, fontSize: 15, fontWeight: "800" },
  cardMrp: {
    color: "#9AA0B4",
    fontSize: 11,
    fontWeight: "600",
    textDecorationLine: "line-through",
  },
  viewDetails: { color: "#7B8094", fontSize: 12, fontWeight: "500" },
  cardEach: { color: "#7B8094", fontSize: 11, fontWeight: "500" },
  paidBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    backgroundColor: "#E9F5EE",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  paidBadgeText: { color: "#2E7D4F", fontSize: 11, fontWeight: "800" },

  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  reviewText: {
    flex: 1,
    color: "#7B8094",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500",
  },
  // plain small text, no button styling
  cancelText: { color: "#ff0000", fontSize: 11, fontWeight: "600" },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cancelBtn: {},
  cancelBtnText: { color: "#ff0000", fontSize: 10, fontWeight: "500" },
  cancelExpired: { color: "#7B8094", fontSize: 11, fontWeight: "500" },
  payBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    padding: 10,
  },
  payBoxFailed: { backgroundColor: "#FBEAE6" },
  payBoxPending: { backgroundColor: "#FFF4DC" },
  payTitle: { fontSize: 12, fontWeight: "800" },
  payHint: { color: "#4A4F63", fontSize: 11, marginTop: 2 },
  payBtn: {
    backgroundColor: navy,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
  },
  payBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  retryBtn: {
    backgroundColor: "#E53935",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
  },
  retryTimer: { color: "#E53935", fontSize: 10, fontWeight: "600" },
  remarksBox: { borderRadius: 10, padding: 10, gap: 3 },
  remarksApproved: { backgroundColor: "#E9F5EE" },
  remarksRejected: { backgroundColor: "#FBEAE6" },
  remarksStatus: { fontSize: 12, fontWeight: "800" },
  remarksText: { color: ink, fontSize: 12, lineHeight: 17, fontWeight: "500" },
  stepsBox: { borderRadius: 10, padding: 10, backgroundColor: "#F3F5FB" },
  stepRow: { flexDirection: "row", gap: 10 },
  stepRail: { alignItems: "center", width: 12 },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#9AA0B4",
    marginTop: 3,
  },
  stepDotCurrent: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 2,
    backgroundColor: navy,
  },
  stepLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#C9CDDA",
    marginVertical: 2,
  },
  stepBody: { flex: 1, paddingBottom: 8 },
  stepTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  stepLabel: { color: "#7B8094", fontSize: 12, fontWeight: "600" },
  stepLabelCurrent: { color: navy, fontWeight: "800" },
  stepDate: { color: "#7B8094", fontSize: 11, fontWeight: "600" },
  stepMeta: { color: "#4A4F63", fontSize: 11, fontWeight: "500", marginTop: 2 },
  shipBox: {
    borderRadius: 10,
    padding: 10,
    gap: 4,
    backgroundColor: "#E8EEFC",
  },
  shipHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  shipTitle: { flex: 1, color: navy, fontSize: 12, fontWeight: "800" },
  shipDate: { color: navy, fontSize: 12, fontWeight: "700" },
  shipMeta: { color: "#4A4F63", fontSize: 12, fontWeight: "500" },
  deliveredBox: {
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#E9F5EE",
  },
  deliveredTitle: {
    flex: 1,
    color: "#2E7D4F",
    fontSize: 12,
    fontWeight: "800",
  },
  deliveredDate: { color: "#2E7D4F", fontSize: 12, fontWeight: "700" },

  /* States */
  signInPanel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginTop: 18,
  },
  panelTitle: { color: ink, fontSize: 18, fontWeight: "800" },
  panelText: { color: muted, fontSize: 14, lineHeight: 21, marginTop: 7 },
  primary: {
    backgroundColor: accent,
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
  outline: {
    height: 44,
    borderWidth: 1,
    borderColor: ink,
    borderRadius: 22,
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
