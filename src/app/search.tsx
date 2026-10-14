import { useCart } from "@/context/cart-context";
import { api, apiImageUrl, type ApiProduct } from "@/lib/api";
import { deliveryDateText } from "@/lib/delivery-text";
import { useStore } from "@/lib/store-context";
import { usePincode } from "@/lib/use-pincode";
import { useVoiceSearch } from "@/lib/use-voice-search";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Mild orange theme constants
const themeLightOrange = "#FFF4EB"; // Very mild orange background replacing blue
const themeBorderOrange = "#FFE3D0";
const themeIconOrange = "#F09148";
const ink = "#1A1A1A";
const muted = "#737373";
const SEARCH_H = 48; // pill height
const PAD_TOP = 8; // space above the pill, below the status bar
const PAD_BOTTOM = 14; // how far the yellow reaches under the pill // how far the orange reaches below the search bar
const HEADER_HEIGHT = SEARCH_H;

const SORT_OPTIONS = [
  { key: "relevance", label: "Relevance" },
  { key: "priceAsc", label: "Price: Low to High" },
  { key: "priceDesc", label: "Price: High to Low" },
  { key: "rating", label: "Rating" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];
const RATING_OPTIONS = [
  { value: 0, label: "Any" },
  { value: 3, label: "3★ & above" },
  { value: 4, label: "4★ & above" },
  { value: 4.5, label: "4.5★ & above" },
];
const ratingOf = (p: any) => Number(p?.rating) || 0;
const brandOf = (p: any) => (typeof p?.brandId === "string" ? p.brandId : "");

export default function SearchResultsScreen() {
  const insets = useSafeAreaInsets();
  const headerTotal = insets.top + PAD_TOP + SEARCH_H + PAD_BOTTOM;
  const scrollY = useRef(new Animated.Value(0)).current;
  const bgOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const { query, filter } = useLocalSearchParams<{
    query: string;
    filter?: string;
  }>();
  const [searchQuery, setSearchQuery] = useState(query || "");
  const voice = useVoiceSearch((text, isFinal) => {
    setSearchQuery(text);
    if (isFinal) router.setParams({ query: text });
  });
  const { storeId } = useStore();
  const pincode = usePincode();
  const { items: cartItems } = useCart();

  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("relevance");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [onlyOffers, setOnlyOffers] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);

  // opened from the home page's filter button
  useEffect(() => {
    if (filter === "1") setFilterOpen(true);
  }, [filter]);

  const resetFilters = () => {
    setSort("relevance");
    setMinPrice("");
    setMaxPrice("");
    setMinRating(0);
    setOnlyOffers(false);
    setBrands([]);
  };

  const brandOptions = useMemo(
    () =>
      Array.from(new Set(products.map(brandOf).filter(Boolean))) as string[],
    [products],
  );

  const activeFilterCount =
    (sort !== "relevance" ? 1 : 0) +
    (minPrice || maxPrice ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (onlyOffers ? 1 : 0) +
    (brands.length > 0 ? 1 : 0);

  const visibleProducts = useMemo(() => {
    const min = Number(minPrice) || 0;
    const max = Number(maxPrice) || Infinity;
    const list = products.filter((p) => {
      const price = Number(p.price) || 0;
      if (min > 0 || max !== Infinity) {
        // price-on-request items can't be compared
        if (!(price > 0) || price < min || price > max) return false;
      }
      if (minRating > 0 && ratingOf(p) < minRating) return false;
      if (
        onlyOffers &&
        !(typeof p.originalPrice === "number" && p.originalPrice > price)
      )
        return false;
      if (brands.length > 0 && !brands.includes(brandOf(p))) return false;
      return true;
    });
    const sorted = [...list];
    if (sort === "priceAsc")
      sorted.sort(
        (a, b) =>
          (a.price > 0 ? a.price : Number.MAX_SAFE_INTEGER) -
          (b.price > 0 ? b.price : Number.MAX_SAFE_INTEGER),
      );
    else if (sort === "priceDesc")
      sorted.sort(
        (a, b) => (b.price > 0 ? b.price : -1) - (a.price > 0 ? a.price : -1),
      );
    else if (sort === "rating")
      sorted.sort((a, b) => ratingOf(b) - ratingOf(a));
    return sorted;
  }, [products, minPrice, maxPrice, minRating, onlyOffers, brands, sort]);

  const matchesSearchQuery = (product: ApiProduct, rawQuery: string) => {
    const query = (rawQuery ?? "").trim().toLowerCase();
    if (!query) return true;

    const synonyms: Record<string, string[]> = {
      ring: [
        "ring",
        "rings",
        "jewelry",
        "jewellery",
        "bracelet",
        "bracelets",
        "earring",
        "earrings",
        "necklace",
        "necklaces",
        "pendant",
        "pendants",
        "accessory",
        "accessories",
      ],
      jewelry: [
        "jewelry",
        "jewellery",
        "ring",
        "rings",
        "bracelet",
        "bracelets",
        "earring",
        "earrings",
        "necklace",
        "necklaces",
        "pendant",
        "pendants",
      ],
      jewellery: [
        "jewellery",
        "jewelry",
        "ring",
        "rings",
        "bracelet",
        "bracelets",
        "earring",
        "earrings",
        "necklace",
        "necklaces",
        "pendant",
        "pendants",
      ],
      bracelet: [
        "bracelet",
        "bracelets",
        "ring",
        "rings",
        "jewelry",
        "jewellery",
        "accessory",
        "accessories",
      ],
      necklace: [
        "necklace",
        "necklaces",
        "pendant",
        "pendants",
        "jewelry",
        "jewellery",
        "ring",
        "rings",
      ],
      earring: ["earring", "earrings", "jewelry", "jewellery", "ring", "rings"],
    };

    const queryTerms = new Set<string>([query]);
    const stemmed = query.replace(/s$/, "");
    if (stemmed) queryTerms.add(stemmed);

    const relatedTerms = synonyms[query] ?? synonyms[stemmed] ?? [];
    relatedTerms.forEach((term) => queryTerms.add(term));

    const haystack = [
      product.title,
      product.description,
      product.categoryName,
      product.categoryId,
      product.brandId,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return [...queryTerms].some(
      (term) => term && haystack.includes(term.toLowerCase()),
    );
  };

  // Load products based on search query
  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    api
      .products(storeId, 1, pincode)
      .then((res) => {
        const filtered = (res.products ?? []).filter((p) =>
          matchesSearchQuery(p, query || ""),
        );
        setProducts(filtered.length > 0 ? filtered : (res.products ?? []));
      })
      .finally(() => setLoading(false));
  }, [storeId, query, pincode]);

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const chip = (label: string, active: boolean, onPress: () => void) => (
    <Pressable
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text
        style={[styles.filterChipText, active && styles.filterChipTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );

  const renderFilterChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterChipsContainer}
    >
      <Pressable
        style={[
          styles.filterChip,
          activeFilterCount > 0 && styles.filterChipActive,
        ]}
        onPress={() => setFilterOpen(true)}
      >
        <SymbolView
          name={{ ios: "slider.horizontal.3", android: "tune", web: "tune" }}
          size={14}
          tintColor={ink}
        />
        <Text style={styles.filterChipText}>
          Sort & Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Text>
      </Pressable>
      {chip("Price: Low to High", sort === "priceAsc", () =>
        setSort(sort === "priceAsc" ? "relevance" : "priceAsc"),
      )}
      {chip("4★ & above", minRating === 4, () =>
        setMinRating(minRating === 4 ? 0 : 4),
      )}
      {chip("On offer", onlyOffers, () => setOnlyOffers((v) => !v))}
      {brandOptions.length > 0 &&
        chip(
          brands.length > 0 ? `Brand (${brands.length})` : "Brand",
          brands.length > 0,
          () => setFilterOpen(true),
        )}
    </ScrollView>
  );

  const renderTopOffers = () => (
    <View style={styles.topOffersSection}>
      <View style={styles.topOffersHeader}>
        <View style={styles.topOffersHeaderLeft}>
          <View style={styles.topOffersBrandIcon} />
          <View>
            <Text style={styles.topOffersTitle}>
              Top offers on {query || "Products"}
            </Text>
            <Text style={styles.topOffersViewAll}>View all</Text>
          </View>
        </View>
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeText}>AD</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.topOffersScroll}
      >
        {visibleProducts.slice(0, 4).map((p, i) => {
          return (
            <Pressable
              key={`offer-${i}`}
              style={styles.offerCard}
              onPress={() =>
                router.push({
                  pathname: "/product/[id]",
                  params: { id: p._id },
                })
              }
            >
              <View style={styles.offerImageWrap}>
                <Image
                  source={{
                    uri:
                      apiImageUrl(p.image) || "https://via.placeholder.com/150",
                  }}
                  style={styles.offerImage}
                  contentFit="cover"
                />
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingText}>4.1</Text>
                  <Text style={styles.ratingStar}>★</Text>
                </View>
              </View>
              <View style={styles.offerInfo}>
                <Text style={styles.offerTitle} numberOfLines={1}>
                  {p.title}
                </Text>
                {p.price > 0 ? (
                  <>
                    <View style={styles.offerPriceRow}>
                      <Text style={styles.offerOriginalPrice}>
                        ₹{(p.price * 1.5).toFixed(0)}
                      </Text>
                      <Text style={styles.offerCurrentPrice}>₹{p.price}</Text>
                    </View>
                    <Text style={styles.offerPromo} numberOfLines={1}>
                      Buy for ₹{(p.price * 0.9).toFixed(0)} & get 2%...
                    </Text>
                  </>
                ) : (
                  <Text style={styles.offerCurrentPrice}>
                    Order to know Price
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderProductGrid = () => (
    <View style={styles.gridContainer}>
      {visibleProducts.map((p, i) => {
        const originalPrice = p.price * 2.5; // dummy logic
        const currentPrice = p.price;
        const discount = Math.round(
          ((originalPrice - currentPrice) / originalPrice) * 100,
        );

        return (
          <Pressable
            key={`grid-${i}`}
            style={styles.gridCard}
            onPress={() =>
              router.push({ pathname: "/product/[id]", params: { id: p._id } })
            }
          >
            <View style={styles.gridImageWrap}>
              <Image
                source={{
                  uri:
                    apiImageUrl(p.image) || "https://via.placeholder.com/150",
                }}
                style={styles.gridImage}
                contentFit="cover"
              />

              <View style={styles.gridAdBadge}>
                <Text style={styles.gridAdBadgeText}>AD</Text>
              </View>

              <View style={styles.gridRatingBadge}>
                <Text style={styles.gridRatingText}>3.9 ★ | 7.8K+</Text>
              </View>
            </View>

            <View style={styles.gridInfo}>
              {/* <Text style={styles.gridBrandLabel}>
                ✓ Assured {p.brandId || "Birde"}
              </Text> */}
              <Text style={styles.gridTitle} numberOfLines={1}>
                {p.title}
              </Text>

              {currentPrice > 0 ? (
                <>
                  <View style={styles.gridPriceRow}>
                    <Text style={styles.gridDiscount}>↓{discount}%</Text>
                    <Text style={styles.gridOriginalPrice}>
                      ₹{originalPrice.toFixed(0)}
                    </Text>
                    <Text style={styles.gridCurrentPrice}>
                      ₹{currentPrice.toFixed(0)}
                    </Text>
                  </View>
                  {/* <Text style={styles.gridWowPromo}>
                    WOW! Buy at ₹{(currentPrice * 0.9).toFixed(0)}
                  </Text> */}
                </>
              ) : (
                <View style={styles.gridPriceRow}>
                  <Text style={styles.gridCurrentPrice}>
                    Order to know Price
                  </Text>
                </View>
              )}
              <Text style={styles.gridDelivery}>
                Get it{" "}
                <Text style={{ fontStyle: "italic", fontWeight: "bold" }}>
                  {deliveryDateText(p.delivery, p.deliveryTime)}
                </Text>
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: headerTotal,
          paddingBottom: 40 + insets.bottom,
        }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
      >
        {renderFilterChips()}
        {visibleProducts.length > 0 && renderTopOffers()}
        {visibleProducts.length > 0 ? (
          renderProductGrid()
        ) : (
          <View style={{ padding: 40, alignItems: "center", gap: 12 }}>
            <Text style={{ color: muted, fontSize: 16 }}>
              {loading
                ? "Loading results..."
                : "No products match your filters."}
            </Text>
            {!loading && activeFilterCount > 0 && (
              <Pressable onPress={resetFilters}>
                <Text style={{ color: themeIconOrange, fontWeight: "700" }}>
                  Clear filters
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </Animated.ScrollView>

      {/* filter sheet */}
      <Modal
        visible={filterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterOpen(false)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setFilterOpen(false)} />
          <KeyboardAvoidingView behavior="padding">
            <View
              style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
            >
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Sort & Filter</Text>
                <Pressable onPress={() => setFilterOpen(false)} hitSlop={10}>
                  <Text style={styles.sheetClose}>✕</Text>
                </Pressable>
              </View>

              <ScrollView
                style={{ flexGrow: 0 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.sheetLabel}>Sort by</Text>
                <View style={styles.optionWrap}>
                  {SORT_OPTIONS.map((o) => (
                    <Pressable
                      key={o.key}
                      style={[
                        styles.optionChip,
                        sort === o.key && styles.optionChipActive,
                      ]}
                      onPress={() => setSort(o.key)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          sort === o.key && styles.optionTextActive,
                        ]}
                      >
                        {o.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.sheetLabel}>Price range (₹)</Text>
                <View style={styles.priceRow}>
                  <TextInput
                    style={styles.priceInput}
                    value={minPrice}
                    onChangeText={(t) => setMinPrice(t.replace(/\D/g, ""))}
                    placeholder="Min"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                  />
                  <Text style={{ color: muted }}>to</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={maxPrice}
                    onChangeText={(t) => setMaxPrice(t.replace(/\D/g, ""))}
                    placeholder="Max"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                  />
                </View>

                <Text style={styles.sheetLabel}>Rating</Text>
                <View style={styles.optionWrap}>
                  {RATING_OPTIONS.map((o) => (
                    <Pressable
                      key={o.value}
                      style={[
                        styles.optionChip,
                        minRating === o.value && styles.optionChipActive,
                      ]}
                      onPress={() => setMinRating(o.value)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          minRating === o.value && styles.optionTextActive,
                        ]}
                      >
                        {o.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.sheetLabel}>Offers</Text>
                <View style={styles.optionWrap}>
                  <Pressable
                    style={[
                      styles.optionChip,
                      onlyOffers && styles.optionChipActive,
                    ]}
                    onPress={() => setOnlyOffers((v) => !v)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        onlyOffers && styles.optionTextActive,
                      ]}
                    >
                      Only products on offer
                    </Text>
                  </Pressable>
                </View>

                {brandOptions.length > 0 && (
                  <>
                    <Text style={styles.sheetLabel}>Brand</Text>
                    <View style={styles.optionWrap}>
                      {brandOptions.map((b) => {
                        const on = brands.includes(b);
                        return (
                          <Pressable
                            key={b}
                            style={[
                              styles.optionChip,
                              on && styles.optionChipActive,
                            ]}
                            onPress={() =>
                              setBrands((cur) =>
                                on ? cur.filter((x) => x !== b) : [...cur, b],
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.optionText,
                                on && styles.optionTextActive,
                              ]}
                            >
                              {b}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}
              </ScrollView>

              <View style={styles.sheetFooter}>
                <Pressable style={styles.resetBtn} onPress={resetFilters}>
                  <Text style={styles.resetText}>Reset</Text>
                </Pressable>
                <Pressable
                  style={styles.applyBtn}
                  onPress={() => setFilterOpen(false)}
                >
                  <Text style={styles.applyText}>
                    Show {visibleProducts.length} results
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* floating header */}
      <View
        style={[styles.headerWrap, { height: headerTotal }]}
        pointerEvents="box-none"
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.headerBg,
            { opacity: bgOpacity },
          ]}
        >
          <BlurView
            intensity={50}
            tint="light"
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[
              "rgba(255,226,140,0.88)",
              "rgba(255,240,187,0.72)",
              "rgba(255,247,214,0.55)",
            ]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={[styles.headerRow, { paddingTop: insets.top + PAD_TOP }]}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <SymbolView
              name={{
                ios: "arrow.left",
                android: "arrow_back",
                web: "arrow_back",
              }}
              size={24}
              tintColor={ink}
            />
          </Pressable>

          <View style={styles.pill}>
            <SymbolView
              name={{
                ios: "magnifyingglass",
                android: "search",
                web: "search",
              }}
              size={22}
              tintColor="#2B2B2B"
            />
            <TextInput
              style={styles.pillInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => router.setParams({ query: searchQuery })}
              placeholder="Search for products and more"
              placeholderTextColor="#6B6146"
              returnKeyType="search"
            />
            <View style={styles.pillDivider} />
            <SymbolView
              name={{ ios: "mic.fill", android: "mic", web: "mic" }}
              size={22}
              tintColor="#2B2B2B"
            />
          </View>

          <Pressable
            style={styles.iconBtn}
            onPress={() => router.push("/cart")}
          >
            <SymbolView
              name={{
                ios: "cart",
                android: "shopping_cart",
                web: "shopping_cart",
              }}
              size={24}
              tintColor={ink}
            />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: HEADER_HEIGHT,
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: themeIconOrange,
    height: 40,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: ink,
  },
  cartBtn: {
    padding: 4,
    marginLeft: 12,
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    top: -2,
    right: -4,
    backgroundColor: "#E43F40",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Filter Chips
  filterChipsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: themeLightOrange,
    borderColor: themeIconOrange,
  },
  filterChipTextActive: { color: themeIconOrange, fontWeight: "700" },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    maxHeight: "100%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: ink },
  sheetClose: { fontSize: 20, color: ink },
  sheetLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: muted,
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionChip: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
  },
  optionChipActive: {
    borderColor: themeIconOrange,
    backgroundColor: themeLightOrange,
  },
  optionText: { fontSize: 13, color: ink, fontWeight: "500" },
  optionTextActive: { color: themeIconOrange, fontWeight: "700" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  priceInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: ink,
  },
  sheetFooter: { flexDirection: "row", gap: 12, marginTop: 16 },
  resetBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ink,
    alignItems: "center",
    justifyContent: "center",
  },
  resetText: { fontSize: 14, fontWeight: "700", color: ink },
  applyBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: themeIconOrange,
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  filterChipText: {
    fontSize: 13,
    color: ink,
    fontWeight: "500",
  },

  // Top Offers
  topOffersSection: {
    backgroundColor: themeLightOrange,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
  },
  topOffersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  topOffersHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topOffersBrandIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  topOffersTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: ink,
  },
  topOffersViewAll: {
    fontSize: 12,
    color: muted,
    marginTop: 2,
  },
  adBadge: {
    backgroundColor: "#D0DBE5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adBadgeText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#666",
  },
  topOffersScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  offerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    width: 140,
    overflow: "hidden",
  },
  offerImageWrap: {
    width: "100%",
    height: 140,
    position: "relative",
  },
  offerImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F5F5F5",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  ratingText: {
    fontSize: 10,
    fontWeight: "bold",
  },
  ratingStar: {
    fontSize: 10,
    color: "#3FA35E",
    marginLeft: 2,
  },
  offerInfo: {
    padding: 8,
  },
  offerTitle: {
    fontSize: 12,
    color: ink,
    fontWeight: "500",
    marginBottom: 4,
  },
  offerPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  offerOriginalPrice: {
    fontSize: 12,
    color: muted,
    textDecorationLine: "line-through",
  },
  offerCurrentPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: ink,
  },
  offerPromo: {
    fontSize: 11,
    color: "#3FA35E",
    fontWeight: "600",
  },

  // Main Grid
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    justifyContent: "space-between",
  },
  gridCard: {
    width: "48%",
    marginBottom: 16,
  },
  gridImageWrap: {
    width: "100%",
    aspectRatio: 0.8,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    position: "relative",
    overflow: "hidden",
    marginBottom: 8,
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  gridAdBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gridAdBadgeText: {
    fontSize: 8,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  gridRatingBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  gridRatingText: {
    fontSize: 10,
    fontWeight: "bold",
    color: ink,
  },
  gridInfo: {
    paddingHorizontal: 4,
  },
  gridBrandLabel: {
    fontSize: 11,
    color: muted,
    fontWeight: "600",
    marginBottom: 2,
  },
  gridTitle: {
    fontSize: 13,
    color: ink,
    marginBottom: 6,
  },
  gridPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  gridDiscount: {
    fontSize: 13,
    color: "#3FA35E",
    fontWeight: "700",
  },
  gridOriginalPrice: {
    fontSize: 13,
    color: muted,
    textDecorationLine: "line-through",
  },
  gridCurrentPrice: {
    fontSize: 14,
    color: ink,
    fontWeight: "800",
  },
  gridWowPromo: {
    fontSize: 11,
    color: "#2874F0", // Kept this specific blue as it's a distinctive branding color for this kind of offer, but the background is orange
    fontWeight: "700",
    marginBottom: 2,
  },
  gridDelivery: {
    fontSize: 11,
    color: muted,
  },
  headerBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: themeLightOrange,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 6,
  },
  iconBtn: {
    width: 36,
    height: SEARCH_H,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    flex: 1,
    height: SEARCH_H,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
    borderRadius: SEARCH_H / 2,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(237,181,79,0.35)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pillInput: {
    flex: 1,
    fontSize: 16,
    color: ink,
    paddingVertical: 0,
  },
  pillDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
});
