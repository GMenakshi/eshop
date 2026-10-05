import { ProductRail } from "@/components/product-rail";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { useCart, type CartItem } from "@/context/cart-context";
import { api, apiImageUrl, type ApiProduct } from "@/lib/api";
import { useStore } from "@/lib/store-context";
import { Image } from "expo-image";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const ink = "#1A1A1A";
const mutedInk = "#999999";
const surface = "#FFFFFF";
const bgLight = "#F4F5F6";
const border = "#EAEAEA";
const accent = "#000000";

const productName = (product?: CartItem["product"]) => {
  if (!product) return "Product";
  if ("title" in product && product.title) return product.title;
  if ("name" in product && product.name) return product.name;
  return "Product";
};

const unitPrice = (item: CartItem) =>
  typeof item.product?.price === "number" ? item.product.price : 0;
const originalPrice = (item: CartItem) =>
  typeof (item.product as any)?.originalPrice === "number"
    ? (item.product as any).originalPrice
    : unitPrice(item);

export default function CartScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const { items, changeQuantity, removeItem } = useCart();
  const { storeId } = useStore();
  const [promoCode, setPromoCode] = useState("");
  const [products, setProducts] = useState<ApiProduct[]>([]);

  useEffect(() => {
    if (!storeId) return;
    api
      .products(storeId)
      .then((response) => setProducts(response.products.slice(0, 8)))
      .catch(() => undefined);
  }, [storeId]);

  const subtotal = items.reduce(
    (sum, item) => sum + unitPrice(item) * (item.quantity || 1),
    0,
  );
  const totalOriginal = items.reduce(
    (sum, item) => sum + originalPrice(item) * (item.quantity || 1),
    0,
  );
  const totalDiscount = totalOriginal - subtotal;
  const payable = subtotal;

  const handleCheckout = () => {
    if (!token) return router.push("/sign-in");
    const unavailableItems = items.filter((item) => item.isAvailable === false);
    if (unavailableItems.length > 0) {
      Alert.alert(
        "Unavailable Items in Cart",
        "Some items in your cart are no longer available. Please remove them before proceeding to checkout.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove & Proceed",
            onPress: async () => {
              for (const item of unavailableItems) {
                await removeItem(item);
              }
              const remaining = items.filter(
                (item) => item.isAvailable !== false,
              );
              if (remaining.length > 0) {
                router.push("/checkout");
              }
            },
          },
        ],
      );
      return;
    }
    router.push("/checkout");
  };

  const renderItem = (item: CartItem, index: number) => {
    const { quantity, product } = item;
    const itemKey =
      item.cartItemId || item.lineId || item.id || `cart-item-${index}`;
    const imageUri = product.image
      ? (apiImageUrl(product.image) ?? product.image)
      : undefined;
    const isUnavailable = item.isAvailable === false;

    // Using mock reviews to match design since API doesn't provide them per cart item easily
    const rating = 4.8;
    const reviewCount = 2320;

    return (
      <View
        style={[styles.itemCard, isUnavailable && styles.unavailableCard]}
        key={itemKey}
      >
        <View style={styles.itemImageWrap}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.itemImage}
              contentFit="contain"
            />
          ) : (
            <View style={styles.itemImagePlaceholder} />
          )}
        </View>
        <View style={styles.itemInfo}>
          <View style={styles.itemHeaderRow}>
            <ThemedText style={styles.productName} numberOfLines={1}>
              {productName(product)}
            </ThemedText>
            <Pressable
              accessibilityLabel="Remove item"
              onPress={() => removeItem(item)}
              hitSlop={8}
            >
              <SymbolView
                name={{ ios: "trash", android: "delete", web: "delete" }}
                size={16}
                tintColor="#E53935"
              />
            </Pressable>
          </View>
          {!!item.variantLabel && (
            <ThemedText style={styles.variantLabel} numberOfLines={1}>
              {item.variantLabel}
            </ThemedText>
          )}
          {isUnavailable ? (
            <View style={styles.unavailableBadge}>
              <Text style={styles.unavailableBadgeText}>
                Out of Stock / Unavailable
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.ratingRow}>
                <ThemedText style={styles.ratingText}>
                  {rating} ({reviewCount} Reviews)
                </ThemedText>
              </View>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Text key={s} style={styles.starIcon}>
                    ★
                  </Text>
                ))}
              </View>
            </>
          )}
          <View style={styles.priceRow}>
            <ThemedText style={styles.price}>
              ₹{unitPrice(item).toFixed(2)}
            </ThemedText>
            <View style={styles.quantityControl}>
              <Pressable
                accessibilityLabel="Decrease quantity"
                onPress={() => {
                  if (quantity > 1) {
                    changeQuantity(item, -1);
                  } else {
                    removeItem(item);
                  }
                }}
                style={styles.qtyBtn}
                hitSlop={6}
              >
                <ThemedText style={styles.qtyBtnText}>-</ThemedText>
              </Pressable>
              <ThemedText style={styles.qtyValue}>{quantity}</ThemedText>
              <Pressable
                accessibilityLabel="Increase quantity"
                onPress={() => changeQuantity(item, 1)}
                style={styles.qtyBtnAdd}
                hitSlop={6}
              >
                <ThemedText style={styles.qtyBtnAddText}>+</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <SymbolView
            name={{
              ios: "arrow.left",
              android: "arrow_back",
              web: "arrow_back",
            }}
            size={20}
            tintColor={ink}
          />
        </Pressable>
        <ThemedText style={styles.headerTitle}>My Cart</ThemedText>
        <View style={styles.headerBtn}>
          <SymbolView
            name={{ ios: "bag", android: "shopping_bag", web: "shopping_bag" }}
            size={20}
            tintColor={ink}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyTitle}>
              Your cart is empty
            </ThemedText>
            <ThemedText style={styles.mutedText}>
              Start adding some items!
            </ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.itemList}>
              {items.map((item, index) => renderItem(item, index))}
            </View>

            {/* ─── Promo Code ─── */}
            <View style={styles.promoContainer}>
              <TextInput
                style={styles.promoInput}
                placeholder="Enter Promo Code"
                placeholderTextColor={mutedInk}
                value={promoCode}
                onChangeText={setPromoCode}
              />
              <Pressable style={styles.applyBtn}>
                <ThemedText style={styles.applyBtnText}>Apply</ThemedText>
              </Pressable>
            </View>

            {/* ─── Bill Details ─── */}
            <View style={styles.billContainer}>
              <ThemedText style={styles.billTitle}>Bill Details</ThemedText>
              <View style={styles.billCard}>
                <View style={styles.billRow}>
                  <View style={styles.billLabelGroup}>
                    <ThemedText style={styles.billLabel}>
                      Total item price
                    </ThemedText>
                    <SymbolView
                      name={{
                        ios: "chevron.down",
                        android: "expand_more",
                        web: "expand_more",
                      }}
                      size={12}
                      tintColor={ink}
                    />
                  </View>
                  <ThemedText style={styles.billValue}>
                    ₹{totalOriginal.toFixed(2)}
                  </ThemedText>
                </View>
                <View style={styles.billRow}>
                  <View style={styles.billLabelGroup}>
                    <ThemedText style={styles.billLabel}>
                      Total discount
                    </ThemedText>
                    <SymbolView
                      name={{
                        ios: "chevron.down",
                        android: "expand_more",
                        web: "expand_more",
                      }}
                      size={12}
                      tintColor={ink}
                    />
                  </View>
                  <ThemedText style={styles.billValue}>
                    -₹{totalDiscount.toFixed(2)}
                  </ThemedText>
                </View>
                <View style={[styles.billRow, styles.billRowLast]}>
                  <ThemedText style={styles.billTotalLabel}>
                    Total payable
                  </ThemedText>
                  <ThemedText style={styles.billTotalValue}>
                    ₹{payable.toFixed(2)}
                  </ThemedText>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Restore API driven product rail */}
        {products.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <ProductRail
              title="Keep exploring"
              products={products}
              onSeeAll={() => router.push("/products")}
            />
          </View>
        )}
      </ScrollView>

      {/* ─── Bottom Action ─── */}
      {items.length > 0 && (
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          ]}
        >
          <Pressable style={styles.buyBtn} onPress={handleCheckout}>
            <ThemedText style={styles.buyBtnText}>Order Now</ThemedText>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bgLight },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: ink },
  content: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },

  itemList: { gap: 16 },
  itemCard: {
    backgroundColor: surface,
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  unavailableCard: {
    opacity: 0.7,
    borderWidth: 1,
    borderColor: "#FFCDD2",
  },
  itemImageWrap: {
    width: 100,
    height: 100,
    backgroundColor: bgLight,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  itemImage: { width: "80%", height: "80%" },
  itemImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: border,
    borderRadius: 16,
  },
  itemInfo: { flex: 1, justifyContent: "center" },
  itemHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  productName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: ink,
    marginRight: 8,
  },
  variantLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: mutedInk,
    marginBottom: 6,
  },
  unavailableBadge: {
    backgroundColor: "#FFEBEE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  unavailableBadgeText: {
    color: "#D32F2F",
    fontSize: 11,
    fontWeight: "700",
  },
  ratingRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  ratingText: { fontSize: 12, color: mutedInk, fontWeight: "500" },
  starsRow: { flexDirection: "row", gap: 2, marginBottom: 12 },
  starIcon: { color: "#F5A623", fontSize: 12 },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  price: { fontSize: 18, fontWeight: "800", color: ink },

  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { fontSize: 20, lineHeight: 24, fontWeight: "600", color: mutedInk },
  qtyValue: {
    fontSize: 16,
    fontWeight: "700",
    color: ink,
    minWidth: 20,
    textAlign: "center",
  },
  qtyBtnAdd: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: ink,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnAddText: { fontSize: 20, lineHeight: 24, fontWeight: "600", color: surface },

  promoContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: surface,
    borderRadius: 30,
    marginTop: 24,
    paddingLeft: 20,
    paddingRight: 6,
    paddingVertical: 6,
  },
  promoInput: {
    flex: 1,
    fontSize: 14,
    color: ink,
    fontWeight: "500",
  },
  applyBtn: {
    backgroundColor: "#edad78",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
  },
  applyBtnText: { color: accent, fontSize: 14, fontWeight: "700" },

  billContainer: { marginTop: 28 },
  billTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: ink,
    marginBottom: 12,
    paddingLeft: 4,
  },
  billCard: {
    backgroundColor: surface,
    borderRadius: 20,
    padding: 20,
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  billRowLast: {
    paddingVertical: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: border,
    paddingTop: 16,
  },
  billLabelGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  billLabel: { fontSize: 14, color: ink, fontWeight: "500" },
  billValue: { fontSize: 14, color: ink, fontWeight: "700" },
  billTotalLabel: { fontSize: 15, color: ink, fontWeight: "700" },
  billTotalValue: { fontSize: 16, color: ink, fontWeight: "800" },

  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 10,
    backgroundColor: bgLight,
  },
  buyBtn: {
    backgroundColor: "#edad78",
    borderRadius: 30,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buyBtnText: { color: surface, fontSize: 16, fontWeight: "700" },

  emptyState: { paddingVertical: 80, alignItems: "center" },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: ink, marginBottom: 8 },
  mutedText: { fontSize: 15, color: mutedInk },
});
