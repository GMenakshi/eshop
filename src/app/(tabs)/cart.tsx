import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProductRail } from "@/components/product-rail";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { useCart, type CartItem } from "@/context/cart-context";
import { api, apiImageUrl, type ApiProduct } from "@/lib/api";
import { useStore } from "@/lib/store-context";
import { router } from "expo-router";
import { useEffect, useState } from "react";

const ink = "#17211D";
const mutedInk = "#748078";
const surface = "#E8EFE7";
const border = "#D7E0D6";

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

export default function CartScreen() {
  const { token } = useAuth();
  const { items, changeQuantity, removeItem } = useCart();
  const { storeId } = useStore();
  const [products, setProducts] = useState<ApiProduct[]>([]);
  useEffect(() => {
    if (!storeId) return;
    api
      .products(storeId)
      .then((response) => setProducts(response.products.slice(0, 8)))
      .catch(() => undefined);
  }, [storeId]);
  const itemCount = items.reduce(
    (total, item) => total + (item?.quantity || 0),
    0,
  );
  const subtotal = items.reduce((total, item) => {
    if (!item?.product) return total;
    const price =
      typeof item.product.price === "number" ? item.product.price : 0;
    return total + price * (item.quantity || 1);
  }, 0);

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
            <ThemedText style={styles.emptyTitle}>
              Your cart is empty
            </ThemedText>
            <ThemedText style={styles.muted}>
              Add something useful to get moving.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.itemList}>
            {items.map((item, index) => {
              if (!item || !item.product) return null;
              const { quantity, product } = item;
              const itemKey = item.cartItemId || item.id || `cart-item-${index}`;
              const imageUri = product.image
                ? apiImageUrl(product.image) ?? product.image
                : undefined;
              const price = typeof product.price === "number" ? product.price : 0;

              return (
                <View style={styles.itemCard} key={itemKey}>
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
                    <ThemedText style={styles.muted}>
                      {productVariant(product)}
                    </ThemedText>
                    <View style={styles.itemActions}>
                      <View style={styles.quantityControl}>
                        <Pressable
                          accessibilityLabel={`Decrease ${productName(product)}`}
                          onPress={() => changeQuantity(item, -1)}
                          style={styles.quantityButton}
                        >
                          <ThemedText style={styles.controlText}>-</ThemedText>
                        </Pressable>
                        <ThemedText style={styles.quantity}>
                          {quantity}
                        </ThemedText>
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
                        <SymbolView
                          name="trash"
                          size={20}
                          tintColor="#A6A6AD"
                        />
                      </Pressable>
                    </View>
                  </View>
                  <ThemedText style={styles.price}>
                    ₹{price * quantity}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.summary}>
          <ThemedText style={styles.summaryTitle}>Order summary</ThemedText>
          <View style={styles.summaryLine}>
            <ThemedText style={styles.muted}>Subtotal</ThemedText>
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
          <View style={styles.divider} />
          <View style={styles.summaryLine}>
            <ThemedText style={styles.totalLabel}>Total</ThemedText>
            <ThemedText style={styles.total}>₹{subtotal.toFixed(2)}</ThemedText>
          </View>
          <Pressable
            disabled={!items.length}
            onPress={() => {
              if (!token) return router.push("/sign-in");
              router.push("/checkout");
            }}
            style={[
              styles.checkoutButton,
              !items.length && styles.disabledButton,
            ]}
          >
            <ThemedText style={styles.checkoutText}>
              CONTINUE TO BILLING
            </ThemedText>
          </Pressable>
        </View>
        <ProductRail title="Keep exploring" products={products} />
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
});
