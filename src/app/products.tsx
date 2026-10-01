import { Image } from "expo-image";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addRecentlyViewed, getRecentlyViewedIds } from "@/lib/recently-viewed";
import { ThemedText } from "@/components/themed-text";
import { useWishlist } from "@/context/wishlist-context";
import { api, apiImageUrl, type ApiProduct } from "@/lib/api";
import { useStore } from "@/lib/store-context";

const themeLightOrange = "#FFF4EB";
const themeIconOrange = "#F09148";
const ink = "#1A1A1A";
const muted = "#737373";
const green = "#3FA35E";
const accent = "#E8634A";

type SortMode = "default" | "low" | "high" | "offers";

const SORT_CHIPS: { key: SortMode; label: string }[] = [
  { key: "default", label: "All" },
  { key: "low", label: "Price: Low to High" },
  { key: "high", label: "Price: High to Low" },
  { key: "offers", label: "On Offer" },
];

const getDiscount = (p: ApiProduct) => {
  if (typeof p.originalPrice === "number" && p.originalPrice > p.price) {
    return Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
  }
  return null;
};

export default function ProductsScreen() {
  const { storeId } = useStore();
  const { toggle, isSaved } = useWishlist();
  const { categoryId, categoryName, mode, excludeId } = useLocalSearchParams<{
    categoryId?: string;
    categoryName?: string;
    mode?: "recent" | "similar";
    excludeId?: string;
  }>();

  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("default");

  useEffect(() => {
    if (!storeId) return;
    let mounted = true;
    setLoading(true);
    const load = async () => {
  try {
    let list: ApiProduct[] = [];

    if (mode === "recent") {
      const ids = await getRecentlyViewedIds(storeId);
      const catalog = await api.allProducts(storeId);
      const byId = new Map(catalog.map((p) => [p._id, p]));
          list = ids.map((rid) => byId.get(rid)).filter(Boolean) as ApiProduct[];
        } else if (mode === "similar" && categoryId) {
      const response = await api.productsByCategory(storeId, categoryId);
          list = (response.products ?? []).filter((p) => p._id !== excludeId);
        } else if (categoryId && categoryId !== "all") {
          list = (await api.productsByCategory(storeId, categoryId)).products ?? [];
        } else {
          list = (await api.products(storeId)).products ?? [];
        }

        if (mounted) setProducts(list);
      } catch {
        if (mounted) setProducts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [categoryId, storeId, mode, excludeId]);

  const visible = useMemo(() => {
    let list = products.filter((p) =>
      (p.title ?? "").toLowerCase().includes(query.trim().toLowerCase()),
    );
    if (sortMode === "offers")
      list = list.filter((p) => getDiscount(p) !== null);
    if (sortMode === "low") list = [...list].sort((a, b) => a.price - b.price);
    if (sortMode === "high") list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [products, query, sortMode]);

  const renderHeader = () => (
    <View>
      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchInputContainer}>
          <SymbolView
            name={{ ios: "magnifyingglass", android: "search", web: "search" }}
            size={18}
            tintColor={muted}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search products"
            placeholderTextColor="#A0A0A0"
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {SORT_CHIPS.map((chip) => {
          const active = sortMode === chip.key;
          return (
            <Pressable
              key={chip.key}
              onPress={() => setSortMode(chip.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderItem = ({ item }: { item: ApiProduct }) => {
    const saved = isSaved(item._id);
    const discount = getDiscount(item);
    const hasRating = typeof item.rating === "number" && item.rating > 0;

    return (
      <Pressable
        style={styles.card}
        onPress={() =>
          router.push({ pathname: "/product/[id]", params: { id: item._id } })
        }
      >
        <View style={styles.imageWrap}>
          {item.image ? (
            <Image
              source={{ uri: apiImageUrl(item.image) }}
              style={styles.image}
              contentFit="cover"
            />
          ) : (
            <View style={styles.image} />
          )}

          <Pressable
            style={styles.heartBtn}
            onPress={() =>
              toggle({
                id: item._id,
                name: item.title || "",
                brand: "",
                price: item.price,
                category: item.categoryName || item.categoryId || "",
                image: item.image ?? "",
                description: item.description ?? "",
                unit: item.unit,
                size: item.size,
              })
            }
          >
            <SymbolView
              name={
                saved
                  ? { ios: "heart.fill", android: "favorite", web: "favorite" }
                  : {
                      ios: "heart",
                      android: "favorite_border",
                      web: "favorite_border",
                    }
              }
              size={16}
              tintColor={saved ? accent : "#999999"}
            />
          </Pressable>

          {hasRating && (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>{item.rating!.toFixed(1)} </Text>
              <Text style={styles.ratingStar}>★</Text>
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>

          <View style={styles.priceRow}>
            {discount !== null && (
              <Text style={styles.discount}>↓{discount}%</Text>
            )}
            {discount !== null && (
              <Text style={styles.originalPrice}>₹{item.originalPrice}</Text>
            )}
            <Text style={styles.price}>₹{item.price}</Text>
          </View>

          <Text style={styles.delivery}>
            Get it{" "}
            <Text style={styles.deliveryBold}>
              {item.deliveryTime || "Same day"}
            </Text>
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: categoryName || "Products",
          headerShown: true,
          headerStyle: { backgroundColor: themeLightOrange },
          headerTintColor: ink,
          headerShadowVisible: false,
        }}
      />

      {loading ? (
        <ActivityIndicator color={themeIconOrange} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item._id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrap}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <ThemedText style={styles.empty}>No products found.</ThemedText>
          }
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  grid: { paddingBottom: 40 },
  columnWrap: { paddingHorizontal: 12, justifyContent: "space-between" },

  /* Search */
  searchWrap: {
    backgroundColor: themeLightOrange,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: themeIconOrange,
    height: 42,
    paddingHorizontal: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: ink },

  /* Chips */
  chipsRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: themeLightOrange,
    borderColor: themeIconOrange,
  },
  chipText: { fontSize: 13, color: ink, fontWeight: "500" },
  chipTextActive: { fontWeight: "700" },

  /* Card */
  card: { width: "48%", marginBottom: 16 },
  imageWrap: {
    width: "100%",
    aspectRatio: 0.8,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 8,
  },
  image: { width: "100%", height: "100%", backgroundColor: "#F5F5F5" },
  heartBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  ratingText: { fontSize: 10, fontWeight: "700", color: ink },
  ratingStar: { fontSize: 10, color: green },

  info: { paddingHorizontal: 4 },
  title: { fontSize: 13, color: ink, fontWeight: "600", marginBottom: 6 },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  discount: { fontSize: 13, color: green, fontWeight: "700" },
  originalPrice: {
    fontSize: 13,
    color: muted,
    textDecorationLine: "line-through",
  },
  price: { fontSize: 14, color: ink, fontWeight: "800" },
  delivery: { fontSize: 11, color: muted },
  deliveryBold: { fontStyle: "italic", fontWeight: "700" },

  empty: { color: muted, fontSize: 14, textAlign: "center", marginTop: 40 },
});
