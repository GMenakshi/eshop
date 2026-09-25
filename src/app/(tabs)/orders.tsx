import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProductRail } from "@/components/product-rail";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { api, apiImageUrl, type ApiProduct } from "@/lib/api";
import { useStore } from "@/lib/store-context";

const ink = "#17211D";
const muted = "#748078";
const surface = "#E8EFE7";
const border = "#D7E0D6";

type OrderRecord = Record<string, unknown>;
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
  };
}

function toOrderView(
  record: OrderRecord,
  index: number,
  products: ApiProduct[],
): OrderView {
  const rawItems =
    record.items ?? record.products ?? record.orderItems ?? record.cartItems;
  const lines = (
    Array.isArray(rawItems) ? rawItems : [record.product ?? rawItems]
  )
    .map((value) => lineFromValue(value, products))
    .filter((line): line is OrderLine => Boolean(line));
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
  };
}

export default function OrdersScreen() {
  const { token } = useAuth();
  const { storeId } = useStore();
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");

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

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <ThemedText style={styles.eyebrow}>ESHOP / HISTORY</ThemedText>
            <ThemedText style={styles.heading}>Orders</ThemedText>
          </View>
          <ThemedText style={styles.count}>{orders.length} ORDERS</ThemedText>
        </View>
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
        {!loading && !error && token && !orders.length && (
          <View style={styles.state}>
            <ThemedText style={styles.panelTitle}>No orders yet</ThemedText>
            <ThemedText style={styles.panelText}>
              Your completed purchases will appear here.
            </ThemedText>
          </View>
        )}
        <View style={styles.orderList}>
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onCancel={handleCancel}
            />
          ))}
        </View>
        <ProductRail title="For You" products={products} />
      </ScrollView>
    </SafeAreaView>
  );
}

function OrderCard({ order, onCancel }: { order: OrderView; onCancel: (id: string) => void }) {
  const canCancel =
    order.status === "PENDING" || order.status === "CONFIRMED";
  const subtotalValue = order.subtotal ?? 0;
  const taxValue = order.tax ?? 0;
  const discountValue = order.discount ?? 0;
  const deliveryFeeValue = order.deliveryFee ?? 0;
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View>
          <ThemedText style={styles.meta}>
            {order.orderNumber || order.id} · {order.date}
          </ThemedText>
          <ThemedText style={styles.orderTitle}>
            {order.lines.length} ITEM
            {order.lines.length === 1 ? "" : "S"}
          </ThemedText>
        </View>
        <ThemedText
          style={[
            styles.status,
            order.status === "DELIVERED" && styles.delivered,
            order.status === "CANCELLED" && styles.cancelled,
          ]}
        >
          {order.status}
        </ThemedText>
      </View>

      <View style={styles.lineItems}>
        {order.lines.map((line, idx) => {
          const lineImage = apiImageUrl(line.image);
          return (
            <View key={`${order.id}-line-${idx}`} style={styles.lineItem}>
              <View style={styles.lineImageFrame}>
                {lineImage ? (
                  <Image
                    source={{ uri: lineImage }}
                    style={styles.lineImage}
                    contentFit="cover"
                  />
                ) : (
                  <ThemedText style={styles.lineImagePlaceholder}>
                    NO IMAGE
                  </ThemedText>
                )}
              </View>
              <View style={styles.lineDetails}>
                <ThemedText style={styles.lineTitle} numberOfLines={2}>
                  {line.title}
                </ThemedText>
                {line.productCode ? (
                  <ThemedText style={styles.lineMeta}>
                    Code: {line.productCode}
                  </ThemedText>
                ) : null}
                {line.unit ? (
                  <ThemedText style={styles.lineMeta}>Unit: {line.unit}</ThemedText>
                ) : null}
                {line.size ? (
                  <ThemedText style={styles.lineMeta}>Size: {line.size}</ThemedText>
                ) : null}
                {line.weight ? (
                  <ThemedText style={styles.lineMeta}>
                    Weight: {line.weight}
                  </ThemedText>
                ) : null}
                <ThemedText style={styles.lineQty}>
                  Qty: {line.quantity}
                </ThemedText>
              </View>
              <View style={styles.linePricing}>
                {line.mrp && line.mrp > (line.price ?? 0) ? (
                  <ThemedText style={styles.lineMrp}>
                    ₹{line.mrp}
                  </ThemedText>
                ) : null}
                <ThemedText style={styles.linePrice}>
                  ₹{line.price ?? 0}
                </ThemedText>
              </View>
            </View>
          );
        })}
      </View>

      {order.customerName || order.customerPhone ? (
        <View style={styles.detailRow}>
          <ThemedText style={styles.detailLabel}>Customer</ThemedText>
          <ThemedText style={styles.detailValue}>
            {order.customerName}
            {order.customerName && order.customerPhone
              ? ` · ${order.customerPhone}`
              : order.customerPhone}
          </ThemedText>
        </View>
      ) : null}
      {order.paymentMethod ? (
        <View style={styles.detailRow}>
          <ThemedText style={styles.detailLabel}>Payment</ThemedText>
          <ThemedText style={styles.detailValue}>
            {order.paymentMethod}
          </ThemedText>
        </View>
      ) : null}
      {order.shippingAddress ? (
        <View style={styles.detailRow}>
          <ThemedText style={styles.detailLabel}>Shipping Address</ThemedText>
          <ThemedText style={styles.detailValue}>
            {order.shippingAddress}
          </ThemedText>
        </View>
      ) : null}
      {order.estimatedDelivery ? (
        <View style={styles.detailRow}>
          <ThemedText style={styles.detailLabel}>Estimated Delivery</ThemedText>
          <ThemedText style={styles.detailValue}>
            {order.estimatedDelivery}
          </ThemedText>
        </View>
      ) : null}
      {order.notes ? (
        <View style={styles.detailRow}>
          <ThemedText style={styles.detailLabel}>Notes</ThemedText>
          <ThemedText style={styles.detailValue}>{order.notes}</ThemedText>
        </View>
      ) : null}

      <View style={styles.priceBreakdown}>
        {order.subtotal !== undefined && (
          <View style={styles.breakdownRow}>
            <ThemedText style={styles.breakdownLabel}>Subtotal</ThemedText>
            <ThemedText style={styles.breakdownValue}>
              ₹{subtotalValue.toFixed(2)}
            </ThemedText>
          </View>
        )}
        {order.tax !== undefined && (
          <View style={styles.breakdownRow}>
            <ThemedText style={styles.breakdownLabel}>Tax</ThemedText>
            <ThemedText style={styles.breakdownValue}>
              ₹{taxValue.toFixed(2)}
            </ThemedText>
          </View>
        )}
        {order.discount !== undefined && (
          <View style={styles.breakdownRow}>
            <ThemedText style={styles.breakdownLabel}>Discount</ThemedText>
            <ThemedText style={styles.breakdownValue}>
              -₹{discountValue.toFixed(2)}
            </ThemedText>
          </View>
        )}
        {order.deliveryFee !== undefined && (
          <View style={styles.breakdownRow}>
            <ThemedText style={styles.breakdownLabel}>Delivery Fee</ThemedText>
            <ThemedText style={styles.breakdownValue}>
              ₹{deliveryFeeValue.toFixed(2)}
            </ThemedText>
          </View>
        )}
        <View style={[styles.breakdownRow, styles.breakdownTotal]}>
          <ThemedText style={styles.breakdownTotalLabel}>Total</ThemedText>
          <ThemedText style={styles.breakdownTotalValue}>
            ₹{order.total.toFixed(2)}
          </ThemedText>
        </View>
      </View>

      {canCancel && (
        <Pressable
          accessibilityLabel="Cancel order"
          onPress={() => onCancel(order.id)}
          style={styles.cancelButton}
        >
          <ThemedText style={styles.cancelText}>CANCEL ORDER</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F4ED" },
  content: { padding: 24, paddingBottom: 130 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  eyebrow: {
    color: muted,
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: "800",
    marginBottom: 12,
  },
  heading: {
    color: ink,
    fontSize: 40,
    lineHeight: 42,
    fontWeight: "800",
    letterSpacing: -1.2,
  },
  count: {
    color: muted,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "800",
    marginBottom: 4,
  },
  orderList: { gap: 14, marginTop: 28 },
  orderCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: surface,
    padding: 14,
    gap: 12,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  orderTitle: {
    color: ink,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
  },
  meta: {
    color: muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  status: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  delivered: {
    color: ink,
    backgroundColor: "#D4E8D2",
    borderColor: "#D4E8D2",
  },
  cancelled: {
    color: "#FFFFFF",
    backgroundColor: "#B84A36",
    borderColor: "#B84A36",
  },
  lineItems: { gap: 10 },
  lineItem: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  lineImageFrame: {
    width: 64,
    height: 64,
    borderRadius: 6,
    backgroundColor: "#E1E9E0",
    alignItems: "center",
    justifyContent: "center",
  },
  lineImage: { width: "100%", height: "100%", borderRadius: 6 },
  lineImagePlaceholder: {
    color: muted,
    fontSize: 7,
    letterSpacing: 1,
    fontWeight: "800",
  },
  lineDetails: {
    flex: 1,
    gap: 2,
  },
  lineTitle: {
    color: ink,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
  },
  lineMeta: {
    color: muted,
    fontSize: 10,
    fontWeight: "600",
  },
  lineQty: {
    color: ink,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  linePricing: {
    alignItems: "flex-end",
    gap: 2,
  },
  linePrice: {
    color: ink,
    fontSize: 13,
    fontWeight: "800",
  },
  lineMrp: {
    color: muted,
    fontSize: 11,
    textDecorationLine: "line-through",
    fontWeight: "600",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E0",
  },
  detailLabel: {
    color: muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  detailValue: {
    color: ink,
    fontSize: 12,
    fontWeight: "700",
    maxWidth: "60%",
    textAlign: "right",
  },
  priceBreakdown: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownLabel: {
    color: muted,
    fontSize: 11,
    fontWeight: "700",
  },
  breakdownValue: {
    color: ink,
    fontSize: 11,
    fontWeight: "800",
  },
  breakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: "#E8E8E0",
    paddingTop: 8,
    marginTop: 4,
  },
  breakdownTotalLabel: {
    color: ink,
    fontSize: 12,
    fontWeight: "900",
  },
  breakdownTotalValue: {
    color: ink,
    fontSize: 14,
    fontWeight: "900",
  },
  cancelButton: {
    alignSelf: "stretch",
    backgroundColor: "#B84A36",
    borderRadius: 3,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: "#F4F4ED",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  signInPanel: {
    backgroundColor: surface,
    borderRadius: 14,
    padding: 20,
    marginTop: 28,
  },
  panelTitle: { color: ink, fontSize: 18, fontWeight: "800" },
  panelText: { color: muted, fontSize: 14, lineHeight: 21, marginTop: 7 },
  primary: {
    backgroundColor: ink,
    height: 48,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  primaryText: {
    color: "#F4F4ED",
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
