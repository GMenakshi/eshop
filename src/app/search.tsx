import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import { api, apiImageUrl, type ApiProduct } from "@/lib/api";
import { useStore } from "@/lib/store-context";
import { useVoiceSearch } from "@/lib/use-voice-search";

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

export default function SearchResultsScreen() {
  const insets = useSafeAreaInsets();
  const headerTotal = insets.top + PAD_TOP + SEARCH_H + PAD_BOTTOM;
  const scrollY = useRef(new Animated.Value(0)).current;
  const bgOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const { query } = useLocalSearchParams<{ query: string }>();
  const [searchQuery, setSearchQuery] = useState(query || "");
    const voice = useVoiceSearch((text, isFinal) => {
    setSearchQuery(text);
    if (isFinal) router.setParams({ query: text });
  });
  const { storeId } = useStore();
  const { items: cartItems } = useCart();
  const { toggle: toggleWishlist, isSaved: isWishlisted } = useWishlist();
  
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Load products based on search query
  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    api.products(storeId)
      .then(res => {
        const queryLower = (query || "").toLowerCase();
        // Simple client-side filtering for demonstration
        const filtered = res.products.filter(p => 
          (p.title && p.title.toLowerCase().includes(queryLower)) ||
          (p.description && p.description.toLowerCase().includes(queryLower)) ||
          (p.categoryName && p.categoryName.toLowerCase().includes(queryLower))
        );
        setProducts(filtered.length > 0 ? filtered : res.products); // fallback to all if no exact match for demo
      })
      .finally(() => setLoading(false));
  }, [storeId, query]);

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const renderFilterChips = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsContainer}>
      <Pressable style={styles.filterChip}>
        <SymbolView name={{ ios: "slider.horizontal.3", android: "tune", web: "tune" }} size={14} tintColor={ink} />
        <Text style={styles.filterChipText}>Sort & Filter</Text>
      </Pressable>
      <Pressable style={styles.filterChip}>
        <Text style={styles.filterChipText}>Price Live</Text>
      </Pressable>
      <Pressable style={styles.filterChip}>
        <SymbolView name={{ ios: "square.grid.2x2", android: "grid_view", web: "grid_view" }} size={14} tintColor={ink} />
        <Text style={styles.filterChipText}>Value 365</Text>
      </Pressable>
      <Pressable style={styles.filterChip}>
        <Text style={styles.filterChipText}>Brand</Text>
      </Pressable>
    </ScrollView>
  );

  const renderTopOffers = () => (
    <View style={styles.topOffersSection}>
      <View style={styles.topOffersHeader}>
        <View style={styles.topOffersHeaderLeft}>
          <View style={styles.topOffersBrandIcon} />
          <View>
            <Text style={styles.topOffersTitle}>Top offers on {query || "Products"}</Text>
            <Text style={styles.topOffersViewAll}>View all</Text>
          </View>
        </View>
        <View style={styles.adBadge}><Text style={styles.adBadgeText}>AD</Text></View>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topOffersScroll}>
        {products.slice(0, 4).map((p, i) => (
          <Pressable key={`offer-${i}`} style={styles.offerCard} onPress={() => router.push({ pathname: "/product/[id]", params: { id: p._id } })}>
            <View style={styles.offerImageWrap}>
              <Image source={{ uri: apiImageUrl(p.image) || "https://via.placeholder.com/150" }} style={styles.offerImage} contentFit="cover" />
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>4.1</Text>
                <Text style={styles.ratingStar}>★</Text>
              </View>
            </View>
            <View style={styles.offerInfo}>
              <Text style={styles.offerTitle} numberOfLines={1}>{p.title}</Text>
              <View style={styles.offerPriceRow}>
                <Text style={styles.offerOriginalPrice}>₹{(p.price * 1.5).toFixed(0)}</Text>
                <Text style={styles.offerCurrentPrice}>₹{p.price}</Text>
              </View>
              <Text style={styles.offerPromo} numberOfLines={1}>Buy for ₹{(p.price * 0.9).toFixed(0)} & get 2%...</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const renderProductGrid = () => (
    <View style={styles.gridContainer}>
      {products.map((p, i) => {
        const isSaved = isWishlisted(p._id);
        const originalPrice = p.price * 2.5; // dummy logic
        const currentPrice = p.price;
        const discount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);

        return (
          <Pressable key={`grid-${i}`} style={styles.gridCard} onPress={() => router.push({ pathname: "/product/[id]", params: { id: p._id } })}>
            <View style={styles.gridImageWrap}>
              <Image source={{ uri: apiImageUrl(p.image) || "https://via.placeholder.com/150" }} style={styles.gridImage} contentFit="cover" />
              
              <View style={styles.gridAdBadge}><Text style={styles.gridAdBadgeText}>AD</Text></View>
              
              <Pressable 
                style={styles.heartBtn} 
                onPress={(e) => {
                  e.stopPropagation();
                  toggleWishlist({ id: p._id, name: p.title, price: p.price, image: p.image ?? "", brand: p.brandId || "Brand", category: p.categoryId || "", description: p.description ?? "" });
                }}
              >
                <SymbolView name={isSaved ? "heart.fill" : "heart"} size={16} tintColor={isSaved ? "#E8634A" : "#999999"} />
              </Pressable>
              
              <View style={styles.gridRatingBadge}>
                <Text style={styles.gridRatingText}>3.9 ★ | 7.8K+</Text>
              </View>
            </View>
            
            <View style={styles.gridInfo}>
              <Text style={styles.gridBrandLabel}>✓ Assured  {p.brandId || "Birde"}</Text>
              <Text style={styles.gridTitle} numberOfLines={1}>{p.title}</Text>
              
              <View style={styles.gridPriceRow}>
                <Text style={styles.gridDiscount}>↓{discount}%</Text>
                <Text style={styles.gridOriginalPrice}>₹{originalPrice.toFixed(0)}</Text>
                <Text style={styles.gridCurrentPrice}>₹{currentPrice.toFixed(0)}</Text>
              </View>
              
              <Text style={styles.gridWowPromo}>WOW! Buy at ₹{(currentPrice * 0.9).toFixed(0)}</Text>
              <Text style={styles.gridDelivery}>Get it <Text style={{fontStyle: 'italic', fontWeight: 'bold'}}>Tomorrow</Text></Text>
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
        contentContainerStyle={{ paddingTop: headerTotal, paddingBottom: 40 + insets.bottom }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
      >
        {renderFilterChips()}
        {products.length > 0 && renderTopOffers()}
        {products.length > 0 ? renderProductGrid() : (
          <View style={{ padding: 40, alignItems: "center" }}>
            <Text style={{ color: muted, fontSize: 16 }}>Loading results...</Text>
          </View>
        )}
      </Animated.ScrollView>

      {/* floating header */}
      <View style={[styles.headerWrap, { height: headerTotal }]} pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.headerBg, { opacity: bgOpacity }]}
        >
          <BlurView
            intensity={50}
            tint="light"
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["rgba(255,226,140,0.88)", "rgba(255,240,187,0.72)", "rgba(255,247,214,0.55)"]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={[styles.headerRow, { paddingTop: insets.top + PAD_TOP }]}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <SymbolView name={{ ios: "arrow.left", android: "arrow_back", web: "arrow_back" }} size={24} tintColor={ink} />
          </Pressable>

          <View style={styles.pill}>
            <SymbolView name={{ ios: "magnifyingglass", android: "search", web: "search" }} size={22} tintColor="#2B2B2B" />
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
            <SymbolView name={{ ios: "mic.fill", android: "mic", web: "mic" }} size={22} tintColor="#2B2B2B" />
          </View>

          <Pressable style={styles.iconBtn} onPress={() => router.push("/cart")}>
            <SymbolView name={{ ios: "cart", android: "shopping_cart", web: "shopping_cart" }} size={24} tintColor={ink} />
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
