import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";

import { ThemedText } from "@/components/themed-text";
import { api, DEFAULT_STORE_ID, apiImageUrl, ApiProduct } from "@/lib/api";
import { useStore } from "@/lib/store-context";
import { useCart } from "@/context/cart-context";
import { useAuth } from "@/context/auth-context";

type Category = {
  _id: string;
  name: string;
  image?: string;
};

const categoryIconMap: Record<
  string,
  { ios: string; android: string; web: string }
> = {
  All: { ios: "sparkles", android: "auto_awesome", web: "auto_awesome" },
  Groceries: { ios: "cart.fill", android: "shopping_basket", web: "shopping_basket" },
  Grocery: { ios: "cart.fill", android: "shopping_basket", web: "shopping_basket" },
  Electronics: { ios: "tv.fill", android: "tv", web: "tv" },
  Beauty: { ios: "sparkle", android: "brush", web: "brush" },
  Gifting: { ios: "gift.fill", android: "card_giftcard", web: "card_giftcard" },
  Fashion: { ios: "shirt.fill", android: "checkroom", web: "checkroom" },
  Toys: { ios: "gamecontroller.fill", android: "sports_esports", web: "gamepad" },
  Books: { ios: "book.fill", android: "menu_book", web: "book" },
  Sports: { ios: "figure.run", android: "sports", web: "sports" },
  Home: { ios: "house.fill", android: "home", web: "home" },
  default: { ios: "square.grid.3x3", android: "apps", web: "apps" },
};

const getCategoryIcon = (name: string) => {
  const matchedKey = Object.keys(categoryIconMap).find(
    (key) => key.toLowerCase() === name.toLowerCase(),
  );
  return categoryIconMap[matchedKey ?? "default"] ?? categoryIconMap.default;
};

export default function CategoriesScreen() {
  const router = useRouter();
  const { storeId } = useStore();
  const activeStoreId = storeId || DEFAULT_STORE_ID;
  const { token } = useAuth();
  const { addItem, items: cartItems, changeQuantity } = useCart();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);

  const loadData = async () => {
    try {
      const [categoryRes, productRes] = await Promise.allSettled([
        api.categories(),
        api.allProducts(activeStoreId),
      ]);

      if (categoryRes.status === "fulfilled" && categoryRes.value.categories) {
        setCategories(
          categoryRes.value.categories.map((cat) => ({
            _id: cat._id,
            name: cat.name,
            image: cat.image,
          })),
        );
      }

      if (productRes.status === "fulfilled") {
        setProducts(productRes.value);
      }
    } catch (error) {
      console.warn("Failed to load categories or products", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [activeStoreId]);

  const activeCategoryObj = categories.find((cat) => cat._id === activeCategoryId);
  const activeCategoryName =
    activeCategoryId === "all"
      ? "All Products"
      : activeCategoryObj?.name ?? "Products";

  const filteredProducts = products.filter((product) => {
    if (activeCategoryId === "all") return true;
    const prodCatId = product.categoryId;
    const prodCatName = (product.categoryName || "").toLowerCase();
    const activeName = (activeCategoryObj?.name || "").toLowerCase();

    return (
      prodCatId === activeCategoryId ||
      (activeName && prodCatName.includes(activeName)) ||
      (activeName && activeName.includes(prodCatName))
    );
  });

  const handleAddToCart = async (product: ApiProduct) => {
    if (!token) {
      router.push("/sign-in");
      return;
    }
    try {
      await addItem(
        {
          _id: product._id,
          title: product.title,
          price: product.price,
          image: product.image ? apiImageUrl(product.image) : undefined,
          categoryId: product.categoryId,
          description: product.description,
          unit: product.unit,
          size: product.size,
          weight: product.weight,
          deliveryTime: product.deliveryTime,
          productCode: product.productCode,
        },
        1,
      );
    } catch (error) {
      console.warn(error);
    }
  };

  const handleChangeQuantity = async (product: ApiProduct, amount: number) => {
    const cartItem = cartItems.find((item) => item.id === product._id);
    if (amount > 0) {
      await handleAddToCart(product);
    } else if (cartItem) {
      await changeQuantity(cartItem, -1);
    }
  };

  const allCategoriesList: Category[] = [
    { _id: "all", name: "All" },
    ...categories,
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Categories & Products</ThemedText>
      </View>
      <View style={styles.body}>
        {/* Left sidebar for API categories */}
        <ScrollView
          style={styles.sidebar}
          contentContainerStyle={styles.sidebarContent}
          showsVerticalScrollIndicator={false}
        >
          {allCategoriesList.map((cat) => {
            const active = cat._id === activeCategoryId;
            const icon = getCategoryIcon(cat.name);
            return (
              <Pressable
                key={cat._id}
                style={[styles.sidebarRow, active && styles.sidebarRowActive]}
                onPress={() => setActiveCategoryId(cat._id)}
              >
                 <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                   {cat.image && apiImageUrl(cat.image) ? (
                     <Image
                       source={{ uri: apiImageUrl(cat.image) }}
                       style={styles.categoryIconImage}
                       resizeMode="cover"
                     />
                   ) : (
                     <SymbolView
                       name={icon as any}
                       size={20}
                       tintColor={active ? "#17211D" : "#526057"}
                     />
                   )}
                 </View>
                <ThemedText
                  style={[
                    styles.sidebarLabel,
                    active && styles.sidebarLabelActive,
                  ]}
                  numberOfLines={2}
                >
                  {cat.name}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Right side for products matching selected category */}
        <View style={styles.main}>
          <View style={styles.mainHeader}>
            <ThemedText style={styles.mainHeaderTitle}>
              {activeCategoryName}
            </ThemedText>
            <ThemedText style={styles.mainHeaderCount}>
              {filteredProducts.length}{" "}
              {filteredProducts.length === 1 ? "Item" : "Items"}
            </ThemedText>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#17211D" />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.productListContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    void loadData();
                  }}
                  tintColor="#17211D"
                />
              }
            >
              {filteredProducts.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <SymbolView
                    name={{ ios: "tray", android: "inbox", web: "inbox" }}
                    size={40}
                    tintColor="#8A948C"
                  />
                  <ThemedText style={styles.emptyText}>
                    No products found in {activeCategoryName}
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.productGrid}>
                  {filteredProducts.map((product) => {
                    const isSaved = saved.includes(product.title);
                    const cartItem = cartItems.find(
                      (item) => item.id === product._id,
                    );
                    const imageUrl = apiImageUrl(product.image);

                    return (
                      <Pressable
                        key={product._id}
                        style={styles.productCard}
                        onPress={() =>
                          router.push({
                            pathname: "/product/[id]",
                            params: { id: product._id },
                          })
                        }
                      >
                        <View style={styles.imageWrap}>
                          {imageUrl ? (
                            <Image
                              source={{ uri: imageUrl }}
                              style={styles.productImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.imagePlaceholder}>
                              <SymbolView
                                name={{
                                  ios: "photo",
                                  android: "image",
                                  web: "image",
                                }}
                                size={24}
                                tintColor="#8A948C"
                              />
                            </View>
                          )}
                          <Pressable
                            style={styles.saveButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              setSaved((items) =>
                                isSaved
                                  ? items.filter((i) => i !== product.title)
                                  : [...items, product.title],
                              );
                            }}
                          >
                            <SymbolView
                              name="heart"
                              size={12}
                              tintColor={isSaved ? "#D5684A" : "#17211D"}
                            />
                          </Pressable>

                          {cartItem ? (
                            <View style={styles.cartControls}>
                              <Pressable
                                style={styles.qtyBtn}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  void handleChangeQuantity(product, -1);
                                }}
                              >
                                <ThemedText style={styles.qtyBtnText}>
                                  −
                                </ThemedText>
                              </Pressable>
                              <ThemedText style={styles.qtyValText}>
                                {cartItem.quantity}
                              </ThemedText>
                              <Pressable
                                style={styles.qtyBtn}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  void handleChangeQuantity(product, 1);
                                }}
                              >
                                <ThemedText style={styles.qtyBtnText}>
                                  +
                                </ThemedText>
                              </Pressable>
                            </View>
                          ) : (
                            <Pressable
                              style={styles.addCartBtn}
                              onPress={(e) => {
                                e.stopPropagation();
                                void handleAddToCart(product);
                              }}
                            >
                              <SymbolView
                                name={{
                                  ios: "cart.fill",
                                  android: "add_shopping_cart",
                                  web: "add_shopping_cart",
                                }}
                                size={13}
                                tintColor="#FFFFFF"
                              />
                            </Pressable>
                          )}
                        </View>

                        <View style={styles.productMeta}>
                          <ThemedText
                            style={styles.productName}
                            numberOfLines={2}
                          >
                            {product.title}
                          </ThemedText>
                          <ThemedText
                            style={styles.productPrice}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {product.price > 0
                              ? `MRP ₹${product.price}`
                              : "PRICE ON REQUEST"}
                          </ThemedText>
                          {product.unit ? (
                            <ThemedText style={styles.productUnit}>
                              Unit: {product.unit}
                            </ThemedText>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const SIDEBAR_WIDTH = 85;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E8E4",
    backgroundColor: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#17211D",
  },
  body: { flex: 1, flexDirection: "row" },

  // Sidebar
  sidebar: {
    width: SIDEBAR_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: "#F4F4ED",
    borderRightWidth: 1,
    borderRightColor: "#E0E0D8",
  },
  sidebarContent: { paddingBottom: 24 },
  sidebarRow: {
    width: SIDEBAR_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E0",
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  sidebarRowActive: {
    backgroundColor: "#FFFFFF",
    borderLeftColor: "#17211D",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E4ECE4",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: "#D8E5D8",
  },
  categoryIconImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  sidebarLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: "#526057",
    fontWeight: "600",
    textAlign: "center",
  },
  sidebarLabelActive: {
    color: "#17211D",
    fontWeight: "800",
  },

  // Main Product Area
  main: { flex: 1, backgroundColor: "#FFFFFF" },
  mainHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F9FAF8",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E8E4",
  },
  mainHeaderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#17211D",
  },
  mainHeaderCount: {
    fontSize: 11,
    fontWeight: "700",
    color: "#748078",
    letterSpacing: 0.5,
  },

  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyWrap: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: "#748078",
    textAlign: "center",
    fontWeight: "600",
  },

  productListContent: { padding: 10, paddingBottom: 40 },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  productCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E8E4",
    overflow: "hidden",
    padding: 6,
  },
  imageWrap: {
    position: "relative",
    aspectRatio: 1,
    backgroundColor: "#F0F0EE",
    borderRadius: 10,
    overflow: "hidden",
  },
  productImage: { width: "100%", height: "100%" },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E9ECE8",
  },
  saveButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  addCartBtn: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#17211D",
    alignItems: "center",
    justifyContent: "center",
  },
  cartControls: {
    position: "absolute",
    right: 6,
    bottom: 6,
    height: 28,
    minWidth: 64,
    borderRadius: 14,
    paddingHorizontal: 2,
    backgroundColor: "#17211D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  qtyBtn: {
    width: 22,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  qtyValText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    minWidth: 12,
    textAlign: "center",
  },
  productMeta: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
  },
  productName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#17211D",
    lineHeight: 16,
  },
  productPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#17211D",
    marginTop: 4,
  },
  productUnit: {
    fontSize: 10,
    color: "#748078",
    marginTop: 2,
  },
});