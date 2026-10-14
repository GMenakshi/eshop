import { ProductRail } from "@/components/product-rail";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { useCart, type CartItem } from "@/context/cart-context";
import { api, apiImageUrl, type ApiProduct } from "@/lib/api";
import { buildBill } from "@/lib/gst";
import { hasTiers, tierPriceFor } from "@/lib/pricing";
import { useStore } from "@/lib/store-context";
import { Ionicons } from "@expo/vector-icons";
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
  useWindowDimensions,
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
  tierPriceFor(item.product, item.quantity || 1) ??
  (typeof item.product?.price === "number" ? item.product.price : 0);
const originalPrice = (item: CartItem) =>
  unitPrice(item) <= 0
    ? 0
    : hasTiers(item.product)
      ? unitPrice(item) // tiered products have no real MRP discount
      : typeof (item.product as any)?.originalPrice === "number"
        ? (item.product as any).originalPrice
        : unitPrice(item);

export default function CartScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const compact = screenW < 400;
  const imgSize = compact ? 76 : 100;
  const { items, changeQuantity, removeItem, addItem } = useCart();
  const { storeId } = useStore();
  const [promoCode, setPromoCode] = useState("");
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [billOpen, setBillOpen] = useState(false);
  const [suggestionIds, setSuggestionIds] = useState<string[]>([]);

  useEffect(() => {
    if (!storeId) return;
    api
      .products(storeId)
      .then((response) => setProducts(response.products))
      .catch(() => undefined);
  }, [storeId]);

  useEffect(() => {
    if (suggestionIds.length > 0 || products.length === 0) return;
    const inCart = new Set(items.map((i) => i.id));
    setSuggestionIds(
      products
        .filter((p) => !inCart.has(p._id))
        .slice(0, 3)
        .map((p) => p._id),
    );
  }, [products]);

  // products not already in the cart; 3 of them, or 2 when fewer are available
  const suggestions = suggestionIds
    .map((id) => products.find((p) => p._id === id))
    .filter((p): p is ApiProduct => !!p);

  const subtotal = items.reduce(
    (sum, item) => sum + unitPrice(item) * (item.quantity || 1),
    0,
  );
  const totalOriginal = items.reduce(
    (sum, item) => sum + originalPrice(item) * (item.quantity || 1),
    0,
  );
  const totalDiscount = totalOriginal - subtotal;
  // GST for a cart line: use the item's own GST, else look the product up in the store list
  const gstOf = (item: CartItem) => {
    const p: any = item.product;
    const listed = products.find((x) => x._id === item.id);
    return {
      gst: p?.gst ?? listed?.gst,
      gstInclusive: Boolean(p?.gstInclusive ?? listed?.gstInclusive),
    };
  };
  const bill = buildBill(
    items.map((item) => ({
      unitPrice: unitPrice(item),
      quantity: item.quantity || 1,
      ...gstOf(item),
    })),
  );
  const payable = bill.total;
  const hasPending = items.some((i) => unitPrice(i) <= 0);
  const splitOrders = items.length > 1 && items.some((i) => unitPrice(i) <= 0);
  const payableText =
    payable > 0
      ? `₹${payable.toFixed(2)}${hasPending ? " + quote" : ""}`
      : "Price pending";

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
        style={[
          styles.itemCard,
          compact && { padding: 10, gap: 10 },
          isUnavailable && styles.unavailableCard,
        ]}
        key={itemKey}
      >
        <View
          style={[styles.itemImageWrap, { width: imgSize, height: imgSize }]}
        >
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
              {unitPrice(item) > 0
                ? `₹${unitPrice(item).toFixed(2)}`
                : "Order to know Price"}
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
            {splitOrders && (
              <View style={styles.splitNotice}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color="#B26A00"
                />
                <ThemedText style={styles.splitNoticeText}>
                  Your cart has a "CLICK ORDER FOR PRICE" item, so each product
                  will be ordered separately (Cash on Delivery).
                </ThemedText>
              </View>
            )}
            <View style={styles.itemList}>
              {items.map((item, index) => renderItem(item, index))}
            </View>

            {/* ─── You might also like this ─── */}
            {suggestions.length > 0 && (
              <View style={styles.sgSection}>
                <ThemedText style={styles.sgTitle}>
                  You might also like this
                </ThemedText>
                {suggestions.map((p, i) => {
                  const off =
                    typeof p.originalPrice === "number" &&
                    p.originalPrice > p.price
                      ? Math.round(
                          ((p.originalPrice - p.price) / p.originalPrice) * 100,
                        )
                      : null;
                  const cartItem = items.find((it) => it.id === p._id);

                  return (
                    <Pressable
                      key={p._id}
                      style={[
                        styles.sgRow,
                        i < suggestions.length - 1 && styles.sgRowDivider,
                      ]}
                      onPress={() =>
                        router.push({
                          pathname: "/product/[id]",
                          params: { id: p._id },
                        })
                      }
                    >
                      <Image
                        source={{ uri: apiImageUrl(p.image) }}
                        style={styles.sgImage}
                        contentFit="cover"
                      />
                      <View style={styles.sgInfo}>
                        <ThemedText style={styles.sgName} numberOfLines={1}>
                          {p.title}
                        </ThemedText>
                        <View style={styles.sgPriceRow}>
                          <ThemedText style={styles.sgPrice}>
                            {p.price > 0
                              ? `₹${p.price}`
                              : "Order to know Price"}
                          </ThemedText>
                          {off !== null && (
                            <>
                              <ThemedText style={styles.sgOriginal}>
                                ₹{p.originalPrice}
                              </ThemedText>
                              <ThemedText style={styles.sgOff}>
                                {off}% OFF
                              </ThemedText>
                            </>
                          )}
                        </View>
                      </View>

                      {cartItem ? (
                        <View style={styles.sgStepper}>
                          <Pressable
                            accessibilityLabel="Decrease quantity"
                            hitSlop={6}
                            style={styles.sgQtyBtn}
                            onPress={() =>
                              cartItem.quantity > 1
                                ? changeQuantity(cartItem, -1)
                                : removeItem(cartItem)
                            }
                          >
                            <ThemedText style={styles.sgQtyText}>-</ThemedText>
                          </Pressable>
                          <ThemedText style={styles.sgQtyValue}>
                            {cartItem.quantity}
                          </ThemedText>
                          <Pressable
                            accessibilityLabel="Increase quantity"
                            hitSlop={6}
                            style={[styles.sgQtyBtn, styles.sgQtyBtnAdd]}
                            onPress={() => changeQuantity(cartItem, 1)}
                          >
                            <ThemedText
                              style={[styles.sgQtyText, { color: surface }]}
                            >
                              +
                            </ThemedText>
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          accessibilityLabel="Add to cart"
                          style={styles.sgAddBtn}
                          hitSlop={6}
                          onPress={() => addItem(p as any)}
                        >
                          <ThemedText style={styles.sgAddText}>ADD</ThemedText>
                        </Pressable>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

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
            {/* <View style={styles.billContainer}>
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
            </View> */}
          </>
        )}

        {/* Restore API driven product rail */}
        {products.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <ProductRail
              title="Keep exploring"
              products={products.slice(0, 8)}
              onSeeAll={() => router.push("/products")}
            />
          </View>
        )}

        {/* ─── Bill Details (dropdown, always last) ─── */}
        {items.length > 0 && (
          <View style={styles.billContainer}>
            <Pressable
              style={styles.billHeader}
              onPress={() => setBillOpen((v) => !v)}
            >
              <ThemedText style={styles.billHeaderTitle}>
                Bill Details
              </ThemedText>
              <View style={styles.billHeaderRight}>
                <ThemedText style={styles.billTotalValue}>
                  {payableText}
                </ThemedText>
                <Ionicons
                  name={billOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={ink}
                />
              </View>
            </Pressable>

            {billOpen && (
              <View style={styles.billCard}>
                <View style={styles.billRow}>
                  <ThemedText style={styles.billLabel}>
                    Total item price
                  </ThemedText>
                  <ThemedText style={styles.billValue}>
                    ₹{totalOriginal.toFixed(2)}
                  </ThemedText>
                </View>
                <View style={styles.billRow}>
                  <ThemedText style={styles.billLabel}>
                    Total discount
                  </ThemedText>
                  <ThemedText style={styles.billValue}>
                    -₹{totalDiscount.toFixed(2)}
                  </ThemedText>
                </View>
                {bill.totalGst > 0 && (
                  <>
                    <View style={styles.billRow}>
                      <ThemedText style={styles.billLabel}>
                        Subtotal (excl. GST)
                      </ThemedText>
                      <ThemedText style={styles.billValue}>
                        ₹{bill.subtotal.toFixed(2)}
                      </ThemedText>
                    </View>
                    {bill.cgst > 0 && (
                      <View style={styles.billRow}>
                        <ThemedText style={styles.billLabel}>CGST</ThemedText>
                        <ThemedText style={styles.billValue}>
                          ₹{bill.cgst.toFixed(2)}
                        </ThemedText>
                      </View>
                    )}
                    {bill.sgst > 0 && (
                      <View style={styles.billRow}>
                        <ThemedText style={styles.billLabel}>SGST</ThemedText>
                        <ThemedText style={styles.billValue}>
                          ₹{bill.sgst.toFixed(2)}
                        </ThemedText>
                      </View>
                    )}
                    {bill.igst > 0 && (
                      <View style={styles.billRow}>
                        <ThemedText style={styles.billLabel}>IGST</ThemedText>
                        <ThemedText style={styles.billValue}>
                          ₹{bill.igst.toFixed(2)}
                        </ThemedText>
                      </View>
                    )}
                  </>
                )}
                <View style={[styles.billRow, styles.billRowLast]}>
                  <ThemedText style={styles.billTotalLabel}>
                    Total payable
                  </ThemedText>
                  <ThemedText style={styles.billTotalValue}>
                    {payableText}
                  </ThemedText>
                </View>
              </View>
            )}

            {false && (
              <View style={styles.billCard}>
                <View style={styles.billRow}>
                  <ThemedText style={styles.billLabel}>
                    Total item price
                  </ThemedText>
                  <ThemedText style={styles.billValue}>
                    ₹{totalOriginal.toFixed(2)}
                  </ThemedText>
                </View>
                <View style={styles.billRow}>
                  <ThemedText style={styles.billLabel}>
                    Total discount
                  </ThemedText>
                  <ThemedText style={styles.billValue}>
                    -₹{totalDiscount.toFixed(2)}
                  </ThemedText>
                </View>
                <View style={[styles.billRow, styles.billRowLast]}>
                  <ThemedText style={styles.billTotalLabel}>
                    Total payable
                  </ThemedText>
                  <ThemedText style={styles.billTotalValue}>
                    {payableText}
                  </ThemedText>
                </View>
              </View>
            )}
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
          {items.length > 1 && items.some((i) => unitPrice(i) <= 0) && (
            <ThemedText
              style={[
                styles.mutedText,
                { textAlign: "center", marginBottom: 8 },
              ]}
            >
              Items will be placed as separate orders.
            </ThemedText>
          )}
          {splitOrders && (
            <ThemedText
              style={[
                styles.mutedText,
                { textAlign: "center", marginBottom: 8, fontSize: 13 },
              ]}
            >
              Each product will be placed as a separate order.
            </ThemedText>
          )}
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
  splitNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF4DC",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 14,
  },
  splitNoticeText: {
    flex: 1,
    color: ink,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
  },
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
  itemInfo: { flex: 1, minWidth: 0, justifyContent: "center" },
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
    flexWrap: "wrap",
    columnGap: 8,
    rowGap: 8,
  },
  price: { fontSize: 18, fontWeight: "800", color: ink, flexShrink: 1 },

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
  qtyBtnText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
    color: mutedInk,
  },
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
  qtyBtnAddText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
    color: surface,
  },

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

  billContainer: { marginTop: 24 },
  billHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: surface,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  billHeaderTitle: { fontSize: 15, fontWeight: "700", color: ink },
  billHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },

  sgSection: {
    marginTop: 20,
    backgroundColor: surface,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sgTitle: { fontSize: 14, fontWeight: "700", color: ink, marginBottom: 6 },
  sgRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  sgRowDivider: { borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  sgImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: bgLight,
  },
  sgInfo: { flex: 1, minWidth: 0 },
  sgName: { fontSize: 13, fontWeight: "600", color: ink },
  sgPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  sgPrice: { fontSize: 13, fontWeight: "800", color: ink },
  sgOriginal: {
    fontSize: 11,
    color: mutedInk,
    textDecorationLine: "line-through",
  },
  sgOff: { fontSize: 11, fontWeight: "700", color: "#22A45D" },
  sgArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: bgLight,
    alignItems: "center",
    justifyContent: "center",
  },
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
  sgAddBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#edad78",
    backgroundColor: surface,
  },
  sgAddText: { fontSize: 12, fontWeight: "800", color: "#edad78" },
  sgStepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  sgQtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#DCDCDC",
    alignItems: "center",
    justifyContent: "center",
  },
  sgQtyBtnAdd: { backgroundColor: ink, borderColor: ink },
  sgQtyText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "600",
    color: mutedInk,
  },
  sgQtyValue: {
    fontSize: 13,
    fontWeight: "700",
    color: ink,
    minWidth: 16,
    textAlign: "center",
  },
});
