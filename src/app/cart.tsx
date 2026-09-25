import { Image } from "expo-image";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import {
  cartItemStoreId,
  useCart,
  type CartItem,
} from "@/context/cart-context";
import { apiImageUrl } from "@/lib/api";

const ink = "#17211D";
const mutedInk = "#748078";
const surface = "#E8EFE7";
const border = "#D7E0D6";
const danger = "#B3261E";

const productName = (product?: CartItem["product"]) => {
  if (!product) return "Product";
  if ("title" in product && product.title) return product.title;
  if ("name" in product && product.name) return product.name;
  return "Product";
};

const productVariant = (product?: CartItem["product"]) => {
  if (!product) return "Available now";
  if ("variant" in product && product.variant) return product.variant;
  if ("unit" in product && product.unit) return product.unit;
  if ("weight" in product && product.weight) return product.weight;
  if ("size" in product && product.size) return product.size;
  return "Available now";
};

const isAvailable = (item: CartItem) => item.isAvailable !== false;
const unitPrice = (item: CartItem) =>
  typeof item.product?.price === "number" ? item.product.price : 0;

type StoreGroup = {
  storeId: string;
  name: string;
  items: CartItem[];
  count: number; // every unit in this store's section
  subtotal: number; // available items only
  hasAvailable: boolean;
  hasUnavailable: boolean;
};

export default function CartScreen() {
  const { token } = useAuth();
  const { items, changeQuantity, removeItem } = useCart();

  const itemCount = items.reduce(
    (total, item) => total + (item?.quantity || 0),
    0,
  );

  // One section per store, in the order the stores first appear in the cart.
  const groups = useMemo(() => {
    const map = new Map<string, StoreGroup>();
    for (const item of items) {
      if (!item?.product) continue;
      const key = cartItemStoreId(item);
      let group = map.get(key);
      if (!group) {
        group = {
          storeId: key,
          name:
            item.storeName ||
            (key === "unknown" ? "Other items" : `Store ${map.size + 1}`),
          items: [],
          count: 0,
          subtotal: 0,
          hasAvailable: false,
          hasUnavailable: false,
        };
        map.set(key, group);
      } else if (item.storeName) {
        group.name = item.storeName;
      }
      group.items.push(item);
      group.count += item.quantity || 0;
      if (isAvailable(item)) {
        group.hasAvailable = true;
        group.subtotal += unitPrice(item) * (item.quantity || 1);
      } else {
        group.hasUnavailable = true;
      }
    }
    return [...map.values()];
  }, [items]);

  // Totals only count items that can actually be ordered.
  const subtotal = groups.reduce((sum, group) => sum + group.subtotal, 0);
  const canCheckoutAll = groups.some((group) => group.hasAvailable);
  const hasUnavailable = groups.some((group) => group.hasUnavailable);

  const goCheckout = (storeId?: string) => {
    if (!token) return router.push("/sign-in");
    router.push(
      storeId ? { pathname: "/checkout", params: { storeId } } : "/checkout",
    );
  };

  const renderItem = (item: CartItem, index: number) => {
    const { quantity, product } = item;
    const itemKey = item.cartItemId || item.id || `cart-item-${index}`;
    const imageUri = product.image
      ? apiImageUrl(product.image) ?? product.image
      : undefined;
    const available = isAvailable(item);

    return (
      <View
        style={[styles.itemCard, !available && styles.itemCardUnavailable]}
        key={itemKey}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.itemImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.itemImage} />
        )}
        <View style={styles.itemInfo}>
          <ThemedText style={styles.productName}>
            {productName(product)}
          </ThemedText>
          <ThemedText style={styles.muted}>{productVariant(product)}</ThemedText>
          {!available && (
            <ThemedText style={styles.unavailableText}>
              Currently unavailable
            </ThemedText>
          )}
          <View style={styles.itemActions}>
            <View style={styles.quantityControl}>
              <Pressable
                accessibilityLabel={`Decrease ${productName(product)}`}
                onPress={() => changeQuantity(item, -1)}
                style={styles.quantityButton}
              >
                <ThemedText style={styles.controlText}>-</ThemedText>
              </Pressable>
              <ThemedText style={styles.quantity}>{quantity}</ThemedText>
              <Pressable
                accessibilityLabel={`Increase ${productName(product)}`}
                onPress={() => changeQuantity(item, 1)}
                style={styles.quantityButton}
              >
                <ThemedText style={styles.controlText}>+</ThemedText>
              </Pressable>
            </View>
            <Pressable
              accessibilityLabel={`Remove ${productName(product)}`}
              onPress={() => removeItem(item)}
              style={styles.deleteButton}
            >
              <SymbolView name="trash" size={20} tintColor="#A6A6AD" />
            </Pressable>
          </View>
        </View>
        {available && (
          <ThemedText style={styles.price}>
            ₹{unitPrice(item) * quantity}
          </ThemedText>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headingRow}>
          <ThemedText style={styles.heading}>Your cart</ThemedText>
          <ThemedText style={styles.itemCount}>({itemCount} items)</ThemedText>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyTitle}>Your cart is empty</ThemedText>
            <ThemedText style={styles.muted}>
              Add something useful to get moving.
            </ThemedText>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.storeId} style={styles.storeSection}>
              <View style={styles.storeHeader}>
                <ThemedText style={styles.storeName}>{group.name}</ThemedText>
                <ThemedText style={styles.storeCount}>
                  {group.count} {group.count === 1 ? "item" : "items"}
                </ThemedText>
              </View>

              <View style={styles.itemList}>
                {group.items.map((item, index) => renderItem(item, index))}
              </View>

              <View style={styles.storeFooter}>
                <View style={styles.summaryLine}>
                  <ThemedText style={styles.muted}>Store subtotal</ThemedText>
                  <ThemedText style={styles.summaryValue}>
                    ₹{group.subtotal.toFixed(2)}
                  </ThemedText>
                </View>
                {group.hasUnavailable && (
                  <ThemedText style={styles.unavailableText}>
                    Unavailable items aren't included in the subtotal.
                  </ThemedText>
                )}
                {group.storeId !== "unknown" && (
                  <Pressable
                    disabled={!group.hasAvailable}
                    onPress={() => goCheckout(group.storeId)}
                    style={[
                      styles.storeCheckoutButton,
                      !group.hasAvailable && styles.disabledButton,
                    ]}
                  >
                    <ThemedText style={styles.storeCheckoutText}>
                      CHECKOUT THIS STORE
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}

        <View style={styles.summary}>
          <ThemedText style={styles.summaryTitle}>Order summary</ThemedText>
          <View style={styles.summaryLine}>
            <ThemedText style={styles.muted}>
              Subtotal ({groups.length} {groups.length === 1 ? "store" : "stores"})
            </ThemedText>
            <ThemedText style={styles.summaryValue}>
              ₹{subtotal.toFixed(2)}
            </ThemedText>
          </View>
          <View style={styles.summaryLine}>
            <ThemedText style={styles.muted}>Shipping</ThemedText>
            <ThemedText style={styles.summaryValue}>
              Calculated next step
            </ThemedText>
          </View>
          {hasUnavailable && (
            <ThemedText style={styles.unavailableText}>
              Unavailable items aren't included in this order.
            </ThemedText>
          )}
          <View style={styles.divider} />
          <View style={styles.summaryLine}>
            <ThemedText style={styles.totalLabel}>Total</ThemedText>
            <ThemedText style={styles.total}>₹{subtotal.toFixed(2)}</ThemedText>
          </View>
          <Pressable
            disabled={!canCheckoutAll}
            onPress={() => goCheckout()}
            style={[styles.checkoutButton, !canCheckoutAll && styles.disabledButton]}
          >
            <ThemedText style={styles.checkoutText}>CHECKOUT ALL STORES</ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F4ED" },
  content: { paddingHorizontal: 24, paddingBottom: 130, gap: 24 },
  headingRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    paddingTop: 14,
  },
  heading: {
    color: ink,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "800",
    letterSpacing: -1.2,
  },
  itemCount: { color: mutedInk, fontSize: 16 },
  itemList: { gap: 16 },
  itemCard: {
    minHeight: 158,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: surface,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  itemCardUnavailable: { opacity: 0.6 },
  itemImage: {
    width: 132,
    height: 132,
    borderRadius: 10,
    backgroundColor: "#E1E9E0",
  },
  itemInfo: {
    flex: 1,
    alignSelf: "stretch",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  productName: { color: ink, fontSize: 16, lineHeight: 21, fontWeight: "700" },
  muted: { color: mutedInk, fontSize: 14, lineHeight: 20 },
  unavailableText: { color: danger, fontSize: 12, fontWeight: "700" },
  itemActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  quantityControl: { flexDirection: "row", alignItems: "center", gap: 8 },
  quantityButton: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  controlText: { color: ink, fontSize: 21, fontWeight: "300", lineHeight: 23 },
  quantity: { color: ink, fontSize: 16, minWidth: 18, textAlign: "center" },
  deleteButton: { padding: 6 },
  price: { color: ink, fontSize: 16, fontWeight: "700", alignSelf: "center" },
  summary: { backgroundColor: surface, borderRadius: 16, padding: 24, gap: 18 },
  summaryTitle: {
    color: ink,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  summaryValue: { color: ink, fontSize: 15, textAlign: "right" },
  divider: { height: 1, backgroundColor: border, marginVertical: 2 },
  totalLabel: { color: ink, fontSize: 21, fontWeight: "800" },
  total: { color: ink, fontSize: 23, fontWeight: "800" },
  checkoutButton: {
    backgroundColor: ink,
    borderRadius: 3,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  checkoutText: {
    color: "#F4F4ED",
    fontSize: 13,
    letterSpacing: 3,
    fontWeight: "900",
  },
  disabledButton: { opacity: 0.35 },
  emptyState: { paddingVertical: 60, alignItems: "center", gap: 8 },
  emptyTitle: { color: ink, fontSize: 22, fontWeight: "700" },
  storeSection: { gap: 14 },
  storeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  storeName: {
    color: ink,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  storeCount: { color: mutedInk, fontSize: 13, fontWeight: "700" },
  storeFooter: {
    backgroundColor: surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: border,
    padding: 14,
    gap: 12,
  },
  storeCheckoutButton: {
    height: 46,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: ink,
    alignItems: "center",
    justifyContent: "center",
  },
  storeCheckoutText: {
    color: ink,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "900",
  },
});