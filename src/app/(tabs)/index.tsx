import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { api, apiImageUrl } from "@/lib/api";
import { useStore } from "@/lib/store-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useState } from "react";
import {
  Animated,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWishlist } from "@/context/wishlist-context";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

const imageBase = "https://api-palette-project.lovable.app/assets/";
export type HomeProduct = {
  id: string;
  name: string;
  brand: string;
  price: number;
  category: string;
  image: string;
  description: string;
  unit?: string;
  size?: string;
  weight?: string | number;
  deliveryTime?: string;
  productCode?: string;
  badge?: string;
};

const offerSlides = [
  {
    eyebrow: "FIELD SALE / 01",
    title: "SAVE 25%\nON YOUR NEXT DROP",
    detail: "Use code FIELD25 at checkout",
    interstitialTitle: "GEAR UP FOR LESS",
    interstitialDetail: "Extra 25% off field gear",
    color: "#17211D",
    accent: "#C8FF00",
  },
  {
    eyebrow: "WEEKEND SIGNAL",
    title: "FREE SHIPPING\nON EVERY ESSENTIAL",
    detail: "No minimum. This weekend only.",
    interstitialTitle: "STOCK UP NOW",
    interstitialDetail: "Free shipping all weekend",
    color: "#B84A36",
    accent: "#FFF1E6",
  },
  {
    eyebrow: "MEMBER ACCESS",
    title: "BUY MORE.\nCARRY LESS.",
    detail: "Bundle selected gear and save 15%",
    interstitialTitle: "BUNDLE & SAVE",
    interstitialDetail: "15% off curated bundles",
    color: "#245C55",
    accent: "#D4E8D2",
  },
];

const categoryIconMap: Record<
  string,
  { ios: string; android: string; web: string }
> = {
  All: { ios: "house.fill", android: "home", web: "home" },
  Ganeshotsav: { ios: "sparkles", android: "celebration", web: "celebration" },
  Electronics: { ios: "tv.fill", android: "tv", web: "tv" },
  Beauty: { ios: "sparkle", android: "brush", web: "brush" },
  Gifting: { ios: "gift.fill", android: "card_giftcard", web: "card_giftcard" },
  Fashion: { ios: "shirt.fill", android: "checkroom", web: "checkroom" },
  Toys: {
    ios: "gamecontroller.fill",
    android: "sports_esports",
    web: "gamepad",
  },
  Books: { ios: "book.fill", android: "menu_book", web: "book" },
  Sports: { ios: "figure.run", android: "sports", web: "sports" },
  Home: { ios: "house.fill", android: "home", web: "home" },
  default: { ios: "square.grid.3x3", android: "apps", web: "apps" },
};

const getCategoryIcon = (name: string) =>
  categoryIconMap[name] ?? categoryIconMap.default;

const searchSuggestions = ["furniture", "kids", "storage", "lighting", "decor"];
const recentSearchesKey = "recentSearches";
const maxRecentSearches = 10;

const parseRecentSearches = (storedValue: string | null): string[] => {
  if (!storedValue) return [];

  try {
    const parsed: unknown = JSON.parse(storedValue);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .slice(0, maxRecentSearches);
  } catch {
    return [];
  }
};

const loadRecentSearches = async (): Promise<string[]> => {
  try {
    return parseRecentSearches(await AsyncStorage.getItem(recentSearchesKey));
  } catch {
    return [];
  }
};

const saveRecentSearches = async (searches: string[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(recentSearchesKey, JSON.stringify(searches));
  } catch {
    return;
  }
};


export default function HomeScreen() {
  
  const { token } = useAuth();
  const { addItem, items: cartItems, changeQuantity } = useCart();
  const { toggle: toggleWishlist, isSaved: isWishlisted } = useWishlist();
  const { storeId } = useStore();
  const [activeCategory, setActiveCategory] = useState("All");
  const [categories, setCategories] = useState<{ id: string; name: string; image?: string; icon?: string }[]>(
    [],
  );
  const [banners, setBanners] = useState<{ id: string; name: string; image: string }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [products, setProducts] = useState<HomeProduct[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchSuggestionIndex, setSearchSuggestionIndex] = useState(0);
  const brandAssets = [
    require("@/assets/images/brand6.jpg"),
    require("@/assets/images/brand4.jpg"),
    require("@/assets/images/brand2.jpg"),
    require("@/assets/images/brand5.jpg"),
    require("@/assets/images/brand1.jpg"),
    require("@/assets/images/brand3.jpg"),
  ];
  const brandTitles = [
    "Aural Lab",
    "Keystroke Sys",
    "Volt Co.",
    "ESHOP Origin",
    "Nordic Studio",
    "Field Supply",
  ];
  const brandColumns: Array<
    Array<{ image: number; title: string; height: number; offset?: number }>
  > = [
      [
        { image: brandAssets[0], title: brandTitles[0], height: 230 },
        { image: brandAssets[2], title: brandTitles[2], height: 180 },
        { image: brandAssets[4], title: brandTitles[4], height: 210 },
      ],
      [
        { image: brandAssets[1], title: brandTitles[1], height: 180, offset: 26 },
        { image: brandAssets[3], title: brandTitles[3], height: 250, offset: 12 },
        { image: brandAssets[5], title: brandTitles[5], height: 190, offset: 12 },
      ],
    ];

  const [offerIndex, setOfferIndex] = useState(0);
  const [offerOpacity] = useState(() => new Animated.Value(1));
  const [couponOpen, setCouponOpen] = useState(false);
  const [stickyHeaderOpacity, setStickyHeaderOpacity] = useState(0);
  const activeOffer = offerSlides[offerIndex];
  const bannerPlayer = useVideoPlayer(
    require("@/assets/images/video2.mp4"),
    (player) => {
      player.loop = true;
      player.muted = true;
      player.play();
    },
  );

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.sequence([
        Animated.timing(offerOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(offerOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
      setOfferIndex((current) => (current + 1) % offerSlides.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [offerOpacity]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSearchSuggestionIndex(
        (current) => (current + 1) % searchSuggestions.length,
      );
    }, 2000);
    return () => clearInterval(timer);
  }, []);
  const loadHomeData = async () => {
    if (!storeId) {
      setProducts([]);
      return;
    }
    setRefreshing(true);
    try {
      const [productResult, categoryResult, bannerResult] = await Promise.allSettled([
  api.products(storeId),
  api.categories(),
  api.banners(),
]);

      const productResponse =
        productResult.status === "fulfilled" ? productResult.value : null;
      const categoryResponse =
        categoryResult.status === "fulfilled" ? categoryResult.value : null;
        const bannerResponse =
  bannerResult.status === "fulfilled" ? bannerResult.value : null;
console.log("[Banner] raw response", JSON.stringify(bannerResponse));
      if (productResponse) {
        const pageSize = Math.max(productResponse.products.length, 1);
        const totalPages = Math.ceil(
          (productResponse.pagination?.totalData ?? pageSize) / pageSize,
        );
        const additionalPages = await Promise.all(
          Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) =>
            api.products(storeId, index + 2),
          ),
        );
        const allProducts = [productResponse, ...additionalPages].flatMap(
          (response) => response.products,
        );
        const detailedProducts = await Promise.all(
          allProducts.map(async (product) => {
            try {
              const response = await api.product(storeId, product._id);
              return response.product ?? product;
            } catch {
              return product;
            }
          }),
        );

        setProducts(
          detailedProducts.map((product) => ({
            id: product._id,
            name: product.title,
            price: product.price,
            brand: product.brandId ?? "ESHOP",
            category:
              product.categoryName ?? product.categoryId ?? "Collection",
            image:
              apiImageUrl(product.image) ?? `${imageBase}p-pack-EQw1NN7b.jpg`,
            description: product.description ?? "",
            unit: product.unit,
            size: product.size,
            weight: product.weight,
            deliveryTime: product.deliveryTime,
            productCode: product.productCode,
          })),
        );
      }

      if (categoryResponse) {
        setCategories(
          categoryResponse.categories.map((category) => ({
            id: category._id,
            name: category.name,
            image: category.image,
            icon: category.icon,
          })),
        );
      }

      if (bannerResponse) {
  setBanners(
    bannerResponse.banners
      .filter((b) => b.isActive)
      .map((b) => ({
        id: b._id,
        name: b.name,
        image: apiImageUrl(b.image) ?? "",
      })),
  );
}

      if (productResult.status === "rejected") {
        console.warn("Failed to load products from API", productResult.reason);
      }
      if (categoryResult.status === "rejected") {
        console.warn(
          "Failed to load categories from API",
          categoryResult.reason,
        );
      }
    } catch (error) {
      console.warn("Failed to refresh home data", error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!storeId) return;
    void loadHomeData();
  }, [storeId]);
  const activeCategoryObj = categories.find((cat) => cat.id === activeCategory);
  const activeCategoryName = activeCategoryObj?.name ?? "";
  const filteredProducts = products.filter((product) => {
    const name = product?.name ?? "";
    const matchesCategory =
      activeCategory === "All" ||
      product.category === activeCategoryName;
    return (
      matchesCategory && name.toLowerCase().includes(query.trim().toLowerCase())
    );
  });
  const inspirationProducts = products.slice(0, 2); // Show only 2 products for SHOP NOW
  const stickyHeaderIndex = 1;
  const stickyBackgroundOpacity = Math.min(stickyHeaderOpacity, 1);
  const categoryIconOpacity = Math.max(0, 1 - stickyHeaderOpacity * 1.3);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y ?? 0;
    setStickyHeaderOpacity(Math.min(y / 120, 1));
  };

  const openSearch = async () => {
    const storedSearches = await loadRecentSearches();
    setRecentSearches(storedSearches);
    setSearchOpen(true);
  };

  const submitSearch = async (value: string) => {
    const normalizedValue = value.trim();
    if (!normalizedValue) return;

    const nextRecentSearches = [
      normalizedValue,
      ...recentSearches.filter(
        (search) => search.toLowerCase() !== normalizedValue.toLowerCase(),
      ),
    ].slice(0, maxRecentSearches);

    setRecentSearches(nextRecentSearches);
    await saveRecentSearches(nextRecentSearches);
    setQuery(normalizedValue);
    setSearchOpen(false);
  };

  const selectRecentSearch = (value: string) => {
    setQuery(value);
    setSearchOpen(false);
  };

  const clearRecentSearches = async () => {
    setRecentSearches([]);
    await saveRecentSearches([]);
  };

  const addProduct = async (product: HomeProduct) => {
    if (!token) {
      router.push("/sign-in");
      return;
    }
    try {
      await addItem(
        {
          _id: product.id,
          title: product.name,
          price: product.price,
          image: product.image,
          categoryId: product.category,
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

  const changeProductQuantity = async (
    product: HomeProduct,
    amount: number,
  ) => {
    const cartItem = cartItems.find((item) => item.id === product.id);
    if (amount > 0) {
      await addProduct(product);
    } else if (cartItem) {
      await changeQuantity(cartItem, -1);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.topGradient,
            {
              opacity: Math.max(0, 0.7 - stickyHeaderOpacity * 0.7),
            },
          ]}
        >
          <LinearGradient
            colors={[
              "rgba(185, 42, 32, 0.62)",
              "rgba(220, 92, 55, 0.6)",
              "rgba(244, 149, 72, 0.38)",
              "rgba(255, 255, 255, 0)",
            ]}
            locations={[0, 0.34, 0.7, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <ScrollView
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[stickyHeaderIndex]}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadHomeData()}
              tintColor="#17211D"
              colors={["#17211D"]}
              title="Refreshing..."
              titleColor="#17211D"
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerInner}>
              <View style={styles.headerMeta}>
                <ThemedText style={styles.logo}>ESHOP</ThemedText>
                <ThemedText style={styles.kicker}>FIELD SUPPLY / 04</ThemedText>
                <Pressable
                  style={styles.addressRow}
                  onPress={() => router.push("/address")}
                  accessibilityLabel="Choose delivery address"
                >
                  <SymbolView
                    name={{
                      ios: "location.fill",
                      android: "location_on",
                      web: "location_on",
                    }}
                    size={12}
                    tintColor="#6E786F"
                  />
                  <ThemedText style={styles.addressText}>
                    Deliver to: Brooklyn, NY
                  </ThemedText>
                  <SymbolView
                    name={{
                      ios: "chevron.down",
                      android: "expand_more",
                      web: "expand_more",
                    }}
                    size={11}
                    tintColor="#6E786F"
                  />
                </Pressable>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  accessibilityLabel="Open notifications"
                  style={styles.iconButton}
                  onPress={() => router.push("/notifications")}
                >
                  <SymbolView
                    name={{
                      ios: "bell.fill",
                      android: "notifications",
                      web: "notifications",
                    }}
                    size={21}
                    tintColor="#17211D"
                  />
                </Pressable>
                <Pressable
                  accessibilityLabel="Open wishlist"
                  style={styles.iconButton}
                  onPress={() => router.push("/wishlist")}
                >
                  <SymbolView
                    name={{
                      ios: "heart",
                      android: "favorite",
                      web: "favorite",
                    }}
                    size={21}
                    tintColor="#17211D"
                  />
                </Pressable>
              </View>
            </View>
          </View>
          <View
  style={[
    styles.stickySearchAndCategories,
    {
      borderBottomColor: `rgba(23, 33, 29, ${0.06 + stickyBackgroundOpacity * 0.3})`,
    },
    stickyBackgroundOpacity > 0 &&
    styles.stickySearchAndCategoriesVisible,
  ]}
>
  <BlurView
    intensity={Math.round(stickyBackgroundOpacity * 60)}
    tint="light"
    style={StyleSheet.absoluteFill}
  />
  <Pressable
    style={[
      styles.searchPromptBar,
      { marginBottom: 10 - stickyBackgroundOpacity * 8 },
    ]}
              onPress={() => void openSearch()}
              accessibilityLabel="Open search"
            >
              <SymbolView
                name={{
                  ios: "magnifyingglass",
                  android: "search",
                  web: "search",
                }}
                size={18}
                tintColor="#17211D"
              />
                <TextInput
                  value={query}
                  editable={false}
                  pointerEvents="none"
                  placeholder={`Search for "${searchSuggestions[searchSuggestionIndex]}"`}
                  placeholderTextColor="#7A847D"
                  style={styles.promptInput}
                />
                <View style={styles.searchDivider} />
                <View style={styles.voiceButton}>
                <SymbolView
                  name={{ ios: "mic.fill", android: "mic", web: "mic" }}
                  size={17}
                  tintColor="#17211D"
                />
              </View>
            </Pressable>
            <View style={styles.categorySection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                {[{ id: "All", name: "All" }, ...categories].map((category) => {
                  const icon = getCategoryIcon(category.name);
                  const categoryImageUrl = category.image
                    ? apiImageUrl(category.image)
                    : undefined;
                  const emojiIcon = category.icon || "";
                  const useImage = Boolean(categoryImageUrl);
                  const useEmoji = !useImage && Boolean(emojiIcon);
                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => setActiveCategory(category.id)}
                      style={[
                        styles.categoryChip,
                        activeCategory === category.id &&
                          styles.categoryChipActive,
                      ]}
                    >
                      {null}
                      <ThemedText
                        style={[
                          styles.categoryText,
                          activeCategory === category.id &&
                            styles.categoryTextActive,
                        ]}
                      >
                        {category.name}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={styles.categoryDivider} />
            </View>
          </View>
          {banners.length > 0 ? (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={styles.heroGifWrap}
    contentContainerStyle={{ borderRadius: 24 }}
  >
    {banners.map((banner) => (
      <Image
        key={banner.id}
        source={{ uri: banner.image }}
        style={{ width: 360, height: 220, borderRadius: 24, marginRight: 12 }}
        contentFit="cover"
      />
    ))}
  </ScrollView>
) : (
  <View style={styles.heroGifWrap}>
    <Image
      source={require("@/assets/images/video1.gif")}
      style={styles.heroGif}
      contentFit="cover"
    />
  </View>
)}
          {inspirationProducts.length > 0 && (
            <View style={styles.shopNowWrap}>
              <View style={styles.shopNowHeader}>
                <ThemedText style={styles.sectionTitle}>SHOP NOW</ThemedText>
              </View>
              <View style={styles.shopNowRow}>
                {inspirationProducts.map((product, index) => {
                  const isSaved = isWishlisted(product.id);
                  const cartItem = cartItems.find(
                    (item) => item.id === product.id,
                  );
                  const ratingOptions = [4.8, 4.9, 4.7];
                  const rating = ratingOptions[index % ratingOptions.length];

                  return (
                    <Pressable
                      key={product.id}
                      style={[
                        styles.inspoCard,
                        index === 1 && styles.inspoCardCenter,
                      ]}
                      onPress={() =>
                        router.push({
                          pathname: "/product/[id]",
                          params: { id: product.id },
                        })
                      }
                    >
                      <View style={styles.inspoImageWrap}>
                        <View style={styles.inspoImageBox}>
                          <Image
                            source={{ uri: product.image }}
                            style={styles.inspoImage}
                            contentFit="cover"
                          />
                        </View>
                        <Pressable
                          style={styles.inspoSave}
                          onPress={(event) => {
                            event.stopPropagation();
                            void toggleWishlist(product);
                          }}
                        >
                          <SymbolView
                            name={isSaved ? "heart.fill" : "heart"}
                            size={13}
                            tintColor={isSaved ? "#D5684A" : "#17211D"}
                          />
                        </Pressable>
                        {cartItem ? (
                          <View style={styles.inspoCartControls}>
                            <Pressable
                              accessibilityLabel={`Remove one ${product.name} from cart`}
                              onPress={(event) => {
                                event.stopPropagation();
                                void changeProductQuantity(product, -1);
                              }}
                              style={styles.inspoQuantityButton}
                            >
                              <ThemedText style={styles.inspoQuantityText}>
                                −
                              </ThemedText>
                            </Pressable>
                            <ThemedText style={styles.inspoQuantityValue}>
                              {cartItem.quantity}
                            </ThemedText>
                            <Pressable
                              accessibilityLabel={`Add another ${product.name} to cart`}
                              onPress={(event) => {
                                event.stopPropagation();
                                void changeProductQuantity(product, 1);
                              }}
                              style={styles.inspoQuantityButton}
                            >
                              <ThemedText style={styles.inspoQuantityText}>
                                +
                              </ThemedText>
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable
                            accessibilityLabel={`Add ${product.name} to cart`}
                            style={styles.inspoCart}
                            onPress={(event) => {
                              event.stopPropagation();
                              void addProduct(product);
                            }}
                          >
                            <SymbolView
                              name={{
                                ios: "cart.fill",
                                android: "add_shopping_cart",
                                web: "add_shopping_cart",
                              }}
                              size={14}
                              tintColor="#ffffff"
                            />
                          </Pressable>
                        )}
                      </View>
                      <View style={styles.inspoMeta}>
                        <ThemedText style={styles.inspoName}>
                          {product.name}
                        </ThemedText>
                        <ThemedText style={styles.inspoPrice}>
                          {product.price > 0
                            ? `MRP ₹${product.price}`
                            : "PRICE ON REQUEST"}
                        </ThemedText>

                        <View style={styles.inspoDetailsRow}>
                          <ThemedText style={styles.inspoDetailLabel}>
                            Rating
                          </ThemedText>
                          <ThemedText style={styles.inspoDetailValue}>
                            {rating.toFixed(1)} / 5
                          </ThemedText>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
          <View style={styles.brandSection}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Brands</ThemedText>
              <ThemedText style={styles.seeAll}>Explore all</ThemedText>
            </View>
            <View style={styles.brandGallery}>
              {brandColumns.map((column, columnIndex) => (
                <View
                  key={`brand-column-${columnIndex}`}
                  style={styles.brandColumn}
                >
                  {column.map((item, index) => (
                    <View
                      key={`brand-${columnIndex}-${index}`}
                      style={[
                        styles.brandCard,
                        { height: item.height },
                        columnIndex === 1
                          ? { marginTop: item.offset ?? 0 }
                          : null,
                      ]}
                    >
                      <Image
                        source={item.image}
                        style={styles.brandImage}
                        contentFit="cover"
                      />
                      <LinearGradient
                        colors={[
                          "rgba(0,0,0,0.55)",
                          "rgba(0,0,0,0.15)",
                          "rgba(0,0,0,0)",
                        ]}
                        locations={[0, 0.5, 1]}
                        start={{ x: 0.5, y: 1 }}
                        end={{ x: 0.5, y: 0 }}
                        style={styles.brandGradient}
                      />
                      <ThemedText style={styles.brandTitle}>
                        {item.title}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
          <View style={styles.imageBanner}>
            <VideoView
              style={styles.imageBannerPhoto}
              player={bannerPlayer}
              nativeControls={false}
            />
          </View>
          <View style={[styles.sectionHeader, styles.productsHeader]}>
            <ThemedText style={styles.sectionTitle}>New arrivals</ThemedText>
            <ThemedText style={styles.countText}>
              {filteredProducts.length} ITEMS
            </ThemedText>
          </View>
          <View style={styles.productGrid}>
            {filteredProducts.map((product, index) => {
              const isSaved = isWishlisted(product.id);
              const cartItem = cartItems.find((item) => item.id === product.id);
              const ratingOptions = [4.8, 4.9, 4.7];
              const rating = ratingOptions[index % ratingOptions.length];

              return (
                <View key={product.id} style={styles.productSlot}>
                  <Pressable
                    style={styles.inspoCard}
                    onPress={() =>
                      router.push({
                        pathname: "/product/[id]",
                        params: { id: product.id },
                      })
                    }
                  >
                    <View style={styles.inspoImageWrap}>
                      <View style={styles.inspoImageBox}>
                        <Image
                          source={{ uri: product.image }}
                          style={styles.inspoImage}
                          contentFit="cover"
                        />
                      </View>
                      <Pressable
                        style={styles.inspoSave}
                        onPress={(event) => {
                          event.stopPropagation();
                          void toggleWishlist(product);
                        }}
                      >
                        <SymbolView
                          name={isSaved ? "heart.fill" : "heart"}
                          size={13}
                          tintColor={isSaved ? "#D5684A" : "#17211D"}
                        />
                      </Pressable>
                      {cartItem ? (
                        <View style={styles.inspoCartControls}>
                          <Pressable
                            accessibilityLabel={`Remove one ${product.name} from cart`}
                            onPress={(event) => {
                              event.stopPropagation();
                              void changeProductQuantity(product, -1);
                            }}
                            style={styles.inspoQuantityButton}
                          >
                            <ThemedText style={styles.inspoQuantityText}>
                              −
                            </ThemedText>
                          </Pressable>
                          <ThemedText style={styles.inspoQuantityValue}>
                            {cartItem.quantity}
                          </ThemedText>
                          <Pressable
                            accessibilityLabel={`Add another ${product.name} to cart`}
                            onPress={(event) => {
                              event.stopPropagation();
                              void changeProductQuantity(product, 1);
                            }}
                            style={styles.inspoQuantityButton}
                          >
                            <ThemedText style={styles.inspoQuantityText}>
                              +
                            </ThemedText>
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          accessibilityLabel={`Add ${product.name} to cart`}
                          style={styles.inspoCart}
                          onPress={(event) => {
                            event.stopPropagation();
                            void addProduct(product);
                          }}
                        >
                          <SymbolView
                            name={{
                              ios: "cart.fill",
                              android: "add_shopping_cart",
                              web: "add_shopping_cart",
                            }}
                            size={14}
                            tintColor="#ffffff"
                          />
                        </Pressable>
                      )}
                    </View>
                    <View style={styles.inspoMeta}>
                      <ThemedText style={styles.inspoName}>
                        {product.name}
                      </ThemedText>
                      <ThemedText style={styles.inspoPrice}>
                        {product.price > 0
                          ? `MRP ₹${product.price}`
                          : "PRICE ON REQUEST"}
                      </ThemedText>

                      <View
                        style={[
                          styles.inspoDetailsRow,
                          styles.inspoDetailsRowTight,
                        ]}
                      >
                        <ThemedText style={styles.inspoDetailLabel}>
                          Rating
                        </ThemedText>
                        <ThemedText style={styles.inspoDetailValue}>
                          {rating.toFixed(1)} / 5
                        </ThemedText>
                      </View>
                      <ThemedText
                        style={styles.productDescription}
                        numberOfLines={2}
                      >
                        {product.description || "No description available"}
                      </ThemedText>
                      <ThemedText
                        style={styles.productParameters}
                        numberOfLines={3}
                      >
                        Category: {product.category} · Unit:{" "}
                        {product.unit || "N/A"}
                        {"\n"}Size: {product.size || "N/A"} · Weight:{" "}
                        {product.weight || "N/A"}
                        {"\n"}Delivery: {product.deliveryTime || "N/A"} · Code:{" "}
                        {product.productCode || "N/A"}
                      </ThemedText>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>
        {couponOpen && (
          <View style={styles.coupon}>
            <Pressable
              accessibilityLabel="Close coupon"
              onPress={() => setCouponOpen(false)}
              style={styles.couponClose}
            >
              <ThemedText style={styles.couponCloseText}>×</ThemedText>
            </Pressable>
            <ThemedText style={styles.couponKicker}>
              FIRST DROP / COUPON
            </ThemedText>
            <ThemedText style={styles.couponTitle}>
              A little extra{`\n`}for your cart.
            </ThemedText>
            <ThemedText style={styles.couponText}>
              Take 15% off your first order with this code.
            </ThemedText>
            <View style={styles.couponCode}>
              <ThemedText style={styles.couponCodeText}>ESHOP15</ThemedText>
              <ThemedText style={styles.couponCopy}>COPY</ThemedText>
            </View>
          </View>
        )}
              </SafeAreaView>
      <Modal
        visible={searchOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setSearchOpen(false)}
      >
        <SafeAreaProvider>
        <SafeAreaView style={styles.searchScreen}>
          <View style={styles.searchScreenTopBar}>
            <Pressable
              onPress={() => setSearchOpen(false)}
              accessibilityLabel="Close search"
              style={styles.searchScreenClose}
            >
              <SymbolView
                name={{ ios: "arrow.left", android: "arrow_back", web: "arrow_back" }}
                size={22}
                tintColor="#17211D"
              />
            </Pressable>
            <View style={styles.searchScreenInputWrap}>
              <SymbolView
                name={{ ios: "magnifyingglass", android: "search", web: "search" }}
                size={18}
                tintColor="#748078"
              />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="Search products"
                placeholderTextColor="#748078"
                returnKeyType="search"
                onSubmitEditing={() => void submitSearch(query)}
                style={styles.searchScreenInput}
              />
              <Pressable accessibilityLabel="Voice search">
                <SymbolView
                  name={{ ios: "mic.fill", android: "mic", web: "mic" }}
                  size={17}
                  tintColor="#748078"
                />
              </Pressable>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.searchScreenScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.recentSearchesHeaderRow}>
              <ThemedText style={styles.recentSearchesTitle}>
                Recent Searches
              </ThemedText>
              {recentSearches.length > 0 && (
                <Pressable onPress={() => void clearRecentSearches()}>
                  <ThemedText style={styles.searchEditLink}>Edit</ThemedText>
                </Pressable>
              )}
            </View>

            {recentSearches.length === 0 ? (
              <ThemedText style={styles.noRecentSearches}>
                No recent searches
              </ThemedText>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentSearchesRow}
              >
                {recentSearches.map((search) => (
                  <Pressable
                    key={search}
                    style={styles.recentSearchChip}
                    onPress={() => selectRecentSearch(search)}
                  >
                    <View style={styles.recentSearchChipIcon}>
                      <SymbolView
                        name={{ ios: "clock", android: "history", web: "history" }}
                        size={20}
                        tintColor="#748078"
                      />
                    </View>
                    <ThemedText style={styles.recentSearchChipLabel} numberOfLines={1}>
                      {search}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {categories.length > 0 && (
              <View style={styles.recommendedSection}>
                <ThemedText style={styles.recentSearchesTitle}>
                  Recommended Stores
                </ThemedText>
                <View style={styles.recommendedGrid}>
                  {categories.slice(0, 3).map((category) => {
                    const categoryImageUrl = category.image
                      ? apiImageUrl(category.image)
                      : undefined;
                    return (
                      <Pressable
                        key={category.id}
                        style={styles.recommendedCard}
                        onPress={() => {
                          setActiveCategory(category.id);
                          setSearchOpen(false);
                        }}
                      >
                        <View style={styles.recommendedImageBox}>
                          {categoryImageUrl ? (
                            <Image
                              source={{ uri: categoryImageUrl }}
                              style={styles.recommendedImage}
                              contentFit="cover"
                            />
                          ) : (
                            <SymbolView
                              name={{ ios: "bag.fill", android: "shopping_bag", web: "shopping_bag" }}
                              size={26}
                              tintColor="#748078"
                            />
                          )}
                        </View>
                        <ThemedText style={styles.recommendedLabel} numberOfLines={1}>
                          {category.name}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {products.length > 0 && (
              <View style={styles.trendingSection}>
                <ThemedText style={styles.recentSearchesTitle}>
                  Trending Today
                </ThemedText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.trendingRow}
                >
                  {products.slice(0, 6).map((product) => (
                    <Pressable
                      key={product.id}
                      style={styles.trendingCard}
                      onPress={() => {
                        setSearchOpen(false);
                        router.push({
                          pathname: "/product/[id]",
                          params: { id: product.id },
                        });
                      }}
                    >
                      <Image
                        source={{ uri: product.image }}
                        style={styles.trendingImage}
                        contentFit="cover"
                      />
                      <ThemedText style={styles.trendingLabel} numberOfLines={2}>
                        {product.name}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </ScrollView>
          </SafeAreaView>
          </SafeAreaProvider>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.light.background },
  safeArea: { flex: 1, width: "100%" },
  topGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 720,
  },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  offerHero: {
    minHeight: 280,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 30,
    justifyContent: "space-between",
    marginBottom: 30,
    overflow: "hidden",
  },
  offerEyebrow: { fontSize: 10, letterSpacing: 2.2, fontWeight: "900" },
  offerTitle: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "900",
    letterSpacing: -1.2,
    marginTop: 20,
  },
  offerDetail: { fontSize: 14, fontWeight: "700", marginTop: 12 },
  offerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
  },
  offerButton: { paddingHorizontal: 15, paddingVertical: 11, borderRadius: 3 },
  offerButtonText: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  offerDots: { flexDirection: "row", gap: 6 },
  offerDot: { width: 7, height: 7, borderRadius: 4 },
  header: {
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: "transparent",
    borderBottomWidth: 0,
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    zIndex: 10,
  },
  headerInner: {
    width: "100%",
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "transparent",
  },
  headerMeta: {
    flex: 1,
    paddingRight: 12,
  },
  logo: {
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: "#17211D",
  },
  kicker: { fontSize: 9, letterSpacing: 2, color: "#ffffff", marginTop: 3 },
  addressRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  addressText: {
    fontSize: 11,
    color: "#000000",
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  profileButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    backgroundColor: "#E4ECE4",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 45,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  searchScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  searchScreenHeader: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E8E4",
  },
  searchScreenClose: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  searchScreenTitle: {
    flex: 1,
    color: "#17211D",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  searchScreenHeaderAction: {
    width: 40,
  },
  searchScreenInputRow: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#F4F4ED",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchScreenInput: {
    flex: 1,
    color: "#17211D",
    fontSize: 16,
    fontWeight: "600",
  },
  searchScreenClear: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  recentSearchesContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  recentSearchesTitle: {
    color: "#748078",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  noRecentSearches: {
    color: "#748078",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 12,
  },
  recentSearchesList: {
    gap: 2,
    paddingBottom: 24,
  },
  recentSearchItem: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E8E4",
  },
  recentSearchText: {
    flex: 1,
    color: "#17211D",
    fontSize: 15,
    fontWeight: "600",
  },
  stickySearchAndCategories: {
    backgroundColor: "rgba(244, 244, 237, 0)",
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(23, 33, 29, 0)",
  },
  stickySearchAndCategoriesVisible: {
    backgroundColor: "rgba(244, 244, 237, 0.58)",
    borderBottomColor: "rgba(23, 33, 29, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    shadowColor: "rgba(23, 33, 29, 0.12)",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  categorySection: {
    paddingBottom: 0,
  },
  searchInput: { flex: 1, color: "#17211D", fontSize: 14 },
searchPromptBar: {
  backgroundColor: "#FFFFFF",
  borderRadius: 100,
  paddingHorizontal: 16,
  height: 52,
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  marginTop: 2,
  shadowColor: "rgba(23, 33, 29, 0.15)",
  shadowOpacity: 1,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
},
  promptInput: {
  flex: 1,
  color: "#17211D",
  fontSize: 15,
  fontWeight: "500",
},
  searchDivider: {
  width: 1,
  height: 22,
  backgroundColor: "#E2E5E0",
},
voiceButton: {
  width: 34,
  height: 34,
  alignItems: "center",
  justifyContent: "center",
},
  heroGifWrap: {
    marginTop: 4,
    marginBottom: 20,
    borderRadius: 24,
    overflow: "hidden",
    height: 220,
  },
  heroGif: {
    width: "100%",
    height: "100%",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 14,
  },
  sectionTitle: {
    color: "#17211D",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  seeAll: {
    color: "#6E786F",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  categoryRow: { gap: 10, paddingBottom: 6, paddingTop: 4 },
  categoryChip: {
  backgroundColor: "transparent",
  paddingHorizontal: 14,
  paddingVertical: 8,
  minWidth: 76,
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
},
categoryChipActive: { backgroundColor: "transparent" },
  categoryChipImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  categoryEmoji: {
    fontSize: 24,
    lineHeight: 24,
  },
  categoryText: {
  fontSize: 13,
  color: "#17211D",
  fontWeight: "700",
  letterSpacing: 0,
  textTransform: "none",
},
categoryTextActive: { color: "#000000", fontWeight: "800" },
  categoryDivider: {
    height: 1,
    backgroundColor: "rgba(23, 33, 29, 0.08)",
    marginTop: 3,
  },
  shopNowWrap: {
    marginBottom: 28,
  },
  shopNowHeader: {
    marginBottom: 12,
  },
  shopNowRow: {
    flexDirection: "row",
    gap: 12,
  },
  inspoCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E8E4",
    overflow: "hidden",
    padding: 6,
  },
  inspoCardCenter: {
    transform: [{ translateY: 10 }],
  },
  inspoImageWrap: {
    position: "relative",
    aspectRatio: 1,
    backgroundColor: "#E9ECE8",
  },
  inspoImageBox: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#F0F0EE",
  },
  inspoImage: {
    width: "100%",
    height: "100%",
  },
  inspoSave: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  inspoCart: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#17211D",
    alignItems: "center",
    justifyContent: "center",
  },
  inspoCartControls: {
    position: "absolute",
    right: 10,
    bottom: 10,
    height: 30,
    minWidth: 72,
    borderRadius: 15,
    paddingHorizontal: 3,
    backgroundColor: "#17211D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inspoQuantityButton: {
    width: 25,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  inspoQuantityText: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "700",
  },
  inspoQuantityValue: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    minWidth: 14,
    textAlign: "center",
  },
  inspoMeta: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
  },
  inspoBrand: {
    color: "#748078",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  inspoName: {
    color: "#17211D",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  inspoPrice: {
    color: "#17211D",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 8,
  },
  inspoDescription: {
    color: "#5B665F",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 8,
  },
  productDescription: {
    color: "#5B665F",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 8,
  },
  productParameters: {
    color: "#526057",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 7,
  },
  inspoDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  inspoDetailsRowTight: {
    marginTop: 4,
  },
  inspoDetailLabel: {
    color: "#748078",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  inspoDetailValue: {
    color: "#17211D",
    fontSize: 10,
    fontWeight: "700",
  },
  brandGallery: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 30,
  },
  brandSection: {
    backgroundColor: "#F5EDE4",
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  brandColumn: {
    flex: 1,
    gap: 12,
  },
  brandCard: {
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#D9D9D9",
    borderWidth: 1,
    borderColor: "#E5E8E4",
    width: "100%",
  },
  brandImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  brandGradient: {
    ...StyleSheet.absoluteFill,
  },
  brandTitle: {
    position: "absolute",
    bottom: 14,
    left: 14,
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.4,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  productsHeader: { marginBottom: 16 },
  countText: { color: "#8A948C", fontSize: 10, letterSpacing: 1.2 },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    columnGap: 10,
    rowGap: 20,
  },
  imageBanner: {
    height: 360,
    borderRadius: 44,
    overflow: "hidden",
    position: "relative",
    marginBottom: 30,
    backgroundColor: "transparent",
  },
  imageBannerPhoto: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  productSlot: { width: "48%", minWidth: 150 },
  productCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E8E4",
    overflow: "hidden",
    padding: 6,
  },
  productImageWrap: {
    position: "relative",
    aspectRatio: 1,
    backgroundColor: "#E9ECE8",
    borderRadius: 14,
    overflow: "hidden",
  },
  productImage: { width: "100%", height: "100%" },
  productInfo: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
  },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "#C94B3C",
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  badgeNew: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "#C94B3C",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  badgeBestSeller: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "#8F2F27",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  interstitial: {
    width: "100%",
    minHeight: 112,
    borderRadius: 4,
    padding: 18,
    justifyContent: "center",
    marginTop: 2,
  },
  interstitialBanner: {
    width: "100%",
    height: 160,
    borderRadius: 16,
    marginTop: 2,
    overflow: "hidden",
  },
  interstitialKicker: {
    color: "#FFFFFF",
    fontSize: 9,
    letterSpacing: 1.8,
    fontWeight: "900",
  },
  interstitialTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 6,
  },
  interstitialDetail: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  saveButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  productBrand: {
    color: "#748078",
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  productName: {
    color: "#17211D",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  productPrice: {
    color: "#17211D",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 8,
  },
  addCardButton: {
    height: 34,
    borderRadius: 3,
    backgroundColor: "#17211D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    marginBottom: 2,
  },
  addCardText: {
    color: "#F4F4ED",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  coupon: {
    position: "absolute",
    right: 16,
    bottom: 100,
    width: 245,
    backgroundColor: "#17211D",
    padding: 18,
    borderRadius: 5,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  couponClose: {
    position: "absolute",
    top: 8,
    right: 10,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  couponCloseText: { color: "#F4F4ED", fontSize: 22, lineHeight: 24 },
  couponKicker: {
    color: "#C8FF00",
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "900",
  },
  couponTitle: {
    color: "#F4F4ED",
    fontSize: 23,
    lineHeight: 25,
    fontWeight: "900",
    marginTop: 10,
  },
  couponText: { color: "#C8D2C7", fontSize: 12, lineHeight: 17, marginTop: 9 },
  couponCode: {
    marginTop: 14,
    backgroundColor: "#F4F4ED",
    borderRadius: 3,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  couponCodeText: {
    color: "#17211D",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  couponCopy: {
    color: "#B84A36",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

searchBackButton: {
  width: 34,
  height: 34,
  alignItems: "center",
  justifyContent: "center",
},
searchScreenInputWrap: {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  backgroundColor: "#F1F3EF",
  borderRadius: 100,
  paddingHorizontal: 14,
  height: 40,
},

searchScreenBody: {
  flex: 1,
  paddingHorizontal: 20,
  paddingTop: 8,
},
searchScreenSectionLabel: {
  fontSize: 11,
  fontWeight: "800",
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "#8A948C",
  marginBottom: 10,
},
searchScreenEmpty: {
  paddingVertical: 40,
  alignItems: "center",
},
searchScreenEmptyText: {
  fontSize: 13,
  color: "#8A948C",
  fontWeight: "600",
},
recentSearchRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: "#F0F0EE",
},
searchScreenTopBar: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  paddingHorizontal: 16,
  paddingVertical: 10,
},
searchScreenScrollContent: {
  paddingHorizontal: 20,
  paddingTop: 16,
  paddingBottom: 40,
},
recentSearchesHeaderRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
},

searchEditLink: {
  fontSize: 14,
  fontWeight: "700",
  color: "#2E6BE6",
},

recentSearchesRow: {
  gap: 14,
  paddingBottom: 6,
},
recentSearchChip: {
  alignItems: "center",
  width: 76,
},
recentSearchChipIcon: {
  width: 68,
  height: 68,
  borderRadius: 14,
  backgroundColor: "#F1F3EF",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 6,
},
recentSearchChipLabel: {
  fontSize: 11,
  fontWeight: "600",
  color: "#17211D",
  textAlign: "center",
},
recommendedSection: {
  marginTop: 28,
  backgroundColor: "#EAF2FB",
  borderRadius: 20,
  paddingHorizontal: 16,
  paddingVertical: 18,
  marginHorizontal: -4,
},
recommendedGrid: {
  flexDirection: "row",
  gap: 12,
  marginTop: 12,
},
recommendedCard: {
  flex: 1,
  alignItems: "center",
  backgroundColor: "#F5F6F3",
  borderRadius: 16,
  paddingVertical: 14,
},
recommendedImageBox: {
  width: 56,
  height: 56,
  borderRadius: 28,
  backgroundColor: "#FFFFFF",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  marginBottom: 8,
},
recommendedImage: {
  width: "100%",
  height: "100%",
},
recommendedLabel: {
  fontSize: 12,
  fontWeight: "700",
  color: "#17211D",
},
trendingSection: {
  marginTop: 28,
},
trendingRow: {
  gap: 12,
  marginTop: 12,
  paddingBottom: 6,
},
trendingCard: {
  width: 130,
},
trendingImage: {
  width: 130,
  height: 130,
  borderRadius: 14,
  backgroundColor: "#F0F0EE",
  marginBottom: 8,
},
trendingLabel: {
  fontSize: 12,
  fontWeight: "700",
  color: "#17211D",
},

});
