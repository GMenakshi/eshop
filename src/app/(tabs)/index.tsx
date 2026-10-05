import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import { api, API_BASE_URL, apiImageUrl } from "@/lib/api";
import {
  fetchNotifications,
  filterNotificationsForStore,
} from "@/lib/notifications-api";
import { useStore } from "@/lib/store-context";
import { useVoiceSearch } from "@/lib/use-voice-search";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useVideoPlayer } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
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
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const imageBase = "https://api-palette-project.lovable.app/assets/";
export type HomeProductColor = {
  color: string;
  image: string;
};

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
  createdAt?: string;
  colors?: HomeProductColor[];
  variants?: any[];
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

// Category display data with emojis for the new UI
const categoryDisplayData = [
  { name: "Dresses", emoji: "👗" },
  { name: "Blazers", emoji: "🧥" },
  { name: "Knitwear", emoji: "🧤" },
  { name: "Outerwear", emoji: "🧤" },
  { name: "Trousers", emoji: "👖" },
];

// Gender filter tabs
// Gender filter tabs
const genderTabs = ["Man", "Women", "Kid"];

// Banner colours: used when the API banner has no `color` field
const bannerPresets = ["#E8875C", "#C2456B", "#7A4FD6", "#C2456B", "#2F6FDE"];
const FOR_YOU = "for-you";
const isHex = (v: unknown): v is string =>
  typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

const hexToRgb = (hex: string) => {
  const h = hex.trim().replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

// amount > 0 lightens, amount < 0 darkens
const shade = (hex: string, amount: number) => {
  const { r, g, b } = hexToRgb(hex);
  const t = amount >= 0 ? 255 : 0;
  const p = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (t - c) * p);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
};

const rgba = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

type Palette = {
  hero: readonly [string, string, string];
  top: readonly [string, string, string];
};

const buildPalette = (hex: string): Palette => ({
  hero: [shade(hex, 0.35), hex, shade(hex, -0.2)],
  top: [rgba(hex, 0.55), rgba(hex, 0.3), rgba(hex, 0)],
});

const mapBanner = (b: any, idx: number) => {
  const rawCat = b.categoryId;
  const rawProd = b.productId;
  return {
    id: String(b._id),
    name: b.name as string,
    image: apiImageUrl(b.image) ?? "",
    color: isHex(b.color)
      ? (b.color as string)
      : bannerPresets[idx % bannerPresets.length],
    categoryId: rawCat
      ? String(typeof rawCat === "object" ? rawCat._id : rawCat)
      : null,
    productId: rawProd
      ? String(typeof rawProd === "object" ? rawProd._id : rawProd)
      : null,
  };
};

const productDiscount = (p: HomeProduct) => {
  const v = p.variants?.[0];
  const sv = v?.sizeVariants?.[0];
  const mrp = Number(sv?.mrp ?? v?.mrp);
  const offer = Number(sv?.offerPrice ?? v?.offerPrice ?? p.price);
  return mrp > offer && offer > 0 ? Math.round(((mrp - offer) / mrp) * 100) : 0;
};

const formatAddress = (a: any): string => {
  if (!a) return "";
  if (typeof a === "string") return a.trim();
  if (typeof a !== "object") return "";
  return [a.addressLine, a.area, a.city, a.state, a.pincode]
    .filter(Boolean)
    .join(", ");
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function SlidingProductImage({
  images,
  activeIndex,
  style,
}: {
  images: string[];
  activeIndex: number;
  style: any;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [displayedIndex, setDisplayedIndex] = useState(activeIndex);

  useEffect(() => {
    if (activeIndex === displayedIndex) return;
    translateX.setValue(Dimensions.get("window").width);
    setDisplayedIndex(activeIndex);
    Animated.timing(translateX, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [activeIndex]);

  return (
    <Animated.View
      style={{ width: "100%", height: "100%", transform: [{ translateX }] }}
    >
      <Image
        source={{ uri: images[displayedIndex] }}
        style={style}
        contentFit="cover"
      />
    </Animated.View>
  );
}

export default function HomeScreen() {
  console.log("HOME SCREEN LOADED v2");
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { addItem, items: cartItems, changeQuantity } = useCart();
  const { toggle: toggleWishlist, isSaved: isWishlisted } = useWishlist();
  const { storeId, activeStore } = useStore();
  const [activeCategory, setActiveCategory] = useState(FOR_YOU);
  const [categories, setCategories] = useState<
    { id: string; name: string; image?: string; icon?: string }[]
  >([]);
  const [banners, setBanners] = useState<
    {
      id: string;
      name: string;
      image: string;
      color: string;
      categoryId: string | null;
      productId: string | null;
    }[]
  >([]);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [offerBanners, setOfferBanners] = useState<
    { id: string; image: string; productId: string | null }[]
  >([]);
  const [categoryBanners, setCategoryBanners] = useState<
    ReturnType<typeof mapBanner>[]
  >([]);
  const bgAnim = useRef(new Animated.Value(0)).current;
  const prevBannerIndexRef = useRef(0);
  const bannerScrollX = useRef(new Animated.Value(0)).current;
  const bannerScrollRef = useRef<ScrollView>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [products, setProducts] = useState<HomeProduct[]>([]);
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [catLayout, setCatLayout] = useState({ y: 0, h: 0 });
  const [chipsActive, setChipsActive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchSuggestionIndex, setSearchSuggestionIndex] = useState(0);
  const [activeGenderTab, setActiveGenderTab] = useState("Women");
  const [selectedColorIndex, setSelectedColorIndex] = useState<
    Record<string, number>
  >({});
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
  const [headerH, setHeaderH] = useState(90);
  const [adUrl, setAdUrl] = useState<string | null>(null);
  const [adReady, setAdReady] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
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
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/ads/public`);
        const json = await res.json();
        const url = json?.ads?.[0]?.mediaUrl;
        if (active && typeof url === "string" && url) setAdUrl(url);
      } catch (error) {
        console.warn("Failed to load header ad", error);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!token) {
        setUnreadCount(0);
        return;
      }
      let active = true;
      fetchNotifications(token, 1, activeStore?.mongoId ?? storeId ?? undefined)
        .then((d) => {
          const notifications = filterNotificationsForStore(
            d.notifications,
            [activeStore?.mongoId, activeStore?.id, storeId].filter(
              (id): id is string => Boolean(id),
            ),
          );
          if (active)
            setUnreadCount(
              d.unreadCount ?? notifications.filter((n) => !n.isRead).length,
            );
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [token, activeStore?.id, activeStore?.mongoId, storeId]),
  );

  const loadHomeData = async () => {
    if (!storeId) {
      setProducts([]);
      return;
    }
    setRefreshing(true);
    try {
      const [productResult, categoryResult, bannerResult] =
        await Promise.allSettled([
          api.products(storeId),
          api.categories(storeId),
          api.banners(),
        ]);

      const productResponse =
        productResult.status === "fulfilled" ? productResult.value : null;
      const categoryResponse =
        categoryResult.status === "fulfilled" ? categoryResult.value : null;
      const bannerResponse =
        bannerResult.status === "fulfilled" ? bannerResult.value : null;
      console.log("[Banner] raw response", JSON.stringify(bannerResponse));
      try {
        const productsUrl = `${API_BASE_URL}/product/store/${encodeURIComponent(storeId)}/products`;
        const newApiRes = await fetch(productsUrl);
        const newApiJson = await newApiRes.json();

        const apiStore = newApiJson.store;
        console.log("[Store] from products API", JSON.stringify(apiStore));
        const fetchedName =
          apiStore?.storeName ?? apiStore?.name ?? apiStore?.title;
        if (fetchedName) setStoreName(String(fetchedName));
        setStoreAddress(
          formatAddress(
            apiStore?.address ??
              apiStore?.storeAddress ??
              apiStore?.location ??
              apiStore,
          ),
        );

        setProducts(
          (newApiJson.products ?? []).map((product: any) => {
            const variants = product.variants ?? [];
            const colors: HomeProductColor[] = variants
              .filter((v: any) => v.color && v.images?.length)
              .map((v: any) => ({ color: v.color, image: v.images[0] }));

            return {
              id: product._id,
              name: product.name,
              price: product.minOfferPrice ?? 0,
              brand: "ESHOP",
              category: product.category?.name ?? "Collection",
              image:
                product.images?.[0] ??
                colors[0]?.image ??
                `${imageBase}p-pack-EQw1NN7b.jpg`,
              description: product.description ?? "",
              deliveryTime: product.deliveryTime,
              productCode: product.productCode,
              createdAt: product.createdAt,
              colors,
              variants: product.variants ?? [],
            };
          }),
        );
      } catch (error) {
        console.warn("Failed to load products from new API", error);
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
        const filtered = bannerResponse.banners
          .filter((b) => b.isActive)
          .filter((b) => {
            const raw = (b as any).storeId ?? (b as any).store;
            const bannerStoreId = typeof raw === "object" ? raw?._id : raw;
            return (
              !activeStore?.mongoId ||
              !bannerStoreId ||
              bannerStoreId === activeStore.mongoId
            );
          });
        setBanners(filtered.filter((b: any) => !b.offerBanner).map(mapBanner));
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
    setProducts([]);
    setCategories([]);
    setBanners([]);
    setStoreName("");
    setStoreAddress("");
    setActiveCategory(FOR_YOU);
    setSelectedColorIndex({});
    if (!storeId) return;
    void loadHomeData();
  }, [storeId]);

  useEffect(() => {
    if (activeCategory === FOR_YOU) {
      setCategoryBanners([]);
      return;
    }

    let active = true;
    (async () => {
      try {
        const qs = activeStore?.mongoId
          ? `?storeId=${encodeURIComponent(activeStore.mongoId)}`
          : "";
        const res = await fetch(
          `${API_BASE_URL}/banner/public/by-category/${encodeURIComponent(activeCategory)}${qs}`,
        );
        const json = await res.json();
        if (active && Array.isArray(json?.banners)) {
          setCategoryBanners(
            json.banners
              .filter((b: any) => b.isActive !== false)
              .map(mapBanner),
          );
        }
      } catch (error) {
        console.warn("Failed to load category banners", error);
      }
    })();
    return () => {
      active = false;
    };
  }, [activeCategory, activeStore?.mongoId]);

  useEffect(() => {
    const mongoId = activeStore?.mongoId;
    if (!mongoId) {
      setOfferBanners([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const url = `${API_BASE_URL}/banner/public/offer-banners?storeId=${encodeURIComponent(mongoId)}`;
        const res = await fetch(url);
        const json = await res.json();
        console.log("[OfferBanner]", url, JSON.stringify(json));
        if (!active || !Array.isArray(json?.banners)) return;
        setOfferBanners(
          json.banners
            .filter((b: any) => b.isActive !== false)
            .filter((b: any) => {
              const raw = b.storeId;
              const id = typeof raw === "object" ? raw?._id : raw;
              return !id || id === mongoId;
            })
            .map((b: any) => ({
              id: String(b._id),
              image: apiImageUrl(b.image) ?? b.image,
              productId: b.productId
                ? String(
                    typeof b.productId === "object"
                      ? b.productId._id
                      : b.productId,
                  )
                : null,
            })),
        );
      } catch (error) {
        console.warn("Failed to load offer banners", error);
      }
    })();
    return () => {
      active = false;
    };
  }, [activeStore?.mongoId]);

  const categoryItems = useMemo(
    () => [
      {
        id: FOR_YOU,
        name: "For You",
        emoji: undefined as string | undefined,
        icon: "storefront" as const,
        image: undefined as string | undefined,
      },
      ...categories.map((cat, idx) => ({
        id: cat.id,
        name: cat.name,
        emoji: categoryDisplayData[idx % categoryDisplayData.length].emoji as
          | string
          | undefined,
        icon: undefined as "storefront" | undefined,
        image:
          typeof cat.image === "string" && cat.image.trim()
            ? apiImageUrl(cat.image)
            : undefined,
      })),
    ],
    [categories],
  );

  const isForYou = activeCategory === FOR_YOU;
  const activeCategoryObj = categories.find((cat) => cat.id === activeCategory);
  const activeCategoryName = activeCategoryObj?.name ?? "";
  const filteredProducts = products.filter((product) => {
    const name = product?.name ?? "";
    const matchesCategory = isForYou || product.category === activeCategoryName;
    return (
      matchesCategory && name.toLowerCase().includes(query.trim().toLowerCase())
    );
  });
  const forYouBanners = banners.filter((b) => !b.categoryId);
  const visibleBanners =
    isForYou || categoryBanners.length === 0 ? forYouBanners : categoryBanners;
  const inspirationProducts = products.slice(0, 2); // Show only 2 products for SHOP NOW
  const offerImage = offerBanners[0]?.image;
  const flashProducts = useMemo(() => {
    const addedTime = (p: HomeProduct) => {
      const t = p.createdAt ? Date.parse(p.createdAt) : NaN;
      if (!Number.isNaN(t)) return t;
      // MongoDB ObjectId: first 8 hex chars = creation time in seconds
      const fromId = parseInt(String(p.id).slice(0, 8), 16);
      return Number.isNaN(fromId) ? 0 : fromId * 1000;
    };
    return [...products]
      .sort((a, b) => addedTime(b) - addedTime(a))
      .slice(0, 8);
  }, [products]);

  // Auto-slide the hero banners
  useEffect(() => {
    if (visibleBanners.length < 2) return;
    const cardWidth = Dimensions.get("window").width - 48 + 12;
    const timer = setInterval(() => {
      const next = (prevBannerIndexRef.current + 1) % visibleBanners.length;
      bannerScrollRef.current?.scrollTo({
        x: next * cardWidth,
        animated: true,
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [visibleBanners.length, activeCategory]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y ?? 0;
    setStickyHeaderOpacity(Math.min(y / 120, 1));
    scrollY.setValue(y);
    setChipsActive(
      catLayout.h > 0 && y >= catLayout.y + catLayout.h - (insets.top + 78),
    );
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
    router.push({ pathname: "/search", params: { query: normalizedValue } });
  };
  const voice = useVoiceSearch((text, isFinal) => {
    setQuery(text);
    if (isFinal) void submitSearch(text);
  }, searchOpen);

  const selectRecentSearch = (value: string) => {
    setQuery(value);
    setSearchOpen(false);
    router.push({ pathname: "/search", params: { query: value } });
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
          variants: product.variants,
        },
        1,
      );
    } catch (error) {
      console.warn(error);
      Alert.alert(
        "Product Unavailable",
        error instanceof Error
          ? error.message
          : "This product is not available right now.",
      );
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

  // Get the first product for hero banner display
  const heroProduct = products.length > 0 ? products[0] : null;

  // --- Dynamic background gradient based on active banner ---
  const handleBannerScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const cardWidth = Dimensions.get("window").width - 48 + 12; // card + gap
      const x = event.nativeEvent.contentOffset.x;
      bannerScrollX.setValue(x / cardWidth);
      const idx = Math.round(x / cardWidth);
      const clamped = Math.max(0, Math.min(idx, visibleBanners.length - 1));
      if (clamped !== prevBannerIndexRef.current) {
        prevBannerIndexRef.current = clamped;
        setActiveBannerIndex(clamped);
      }
    },
    [visibleBanners.length],
  );

  const selectCategory = (id: string) => {
    bannerScrollX.setValue(0);
    setActiveCategory(id);
    setActiveBannerIndex(0);
    prevBannerIndexRef.current = 0;
  };

  const activeBannerColor =
    visibleBanners.length > 0
      ? (visibleBanners[activeBannerIndex]?.color ?? bannerPresets[0])
      : "#E8875C";

  const topGradientColors = useMemo(
    () => [
      rgba(activeBannerColor, 0.55),
      rgba(activeBannerColor, 0.25),
      rgba(activeBannerColor, 0),
    ],
    [activeBannerColor],
  );

  const renderSearchPill = () => (
    <Pressable
      style={[
        s.searchBar,
        { marginTop: 0, marginBottom: 0, marginHorizontal: 0 },
      ]}
      onPress={() => void openSearch()}
      accessibilityLabel="Open search"
    >
      <SymbolView
        name={{ ios: "magnifyingglass", android: "search", web: "search" }}
        size={20}
        tintColor="#999"
      />
      <TextInput
        value={query}
        editable={false}
        pointerEvents="none"
        placeholder={`Search styles, brands..`}
        placeholderTextColor="#AAAAAA"
        style={s.searchInput}
      />
      <View style={s.searchOrangeBtn}>
        <SymbolView
          name={{ ios: "slider.horizontal.3", android: "tune", web: "tune" }}
          size={16}
          tintColor="#FFFFFF"
        />
      </View>
    </Pressable>
  );

  const pinTop = insets.top + 12; // where the bar stops at the top
  const restTop = headerH + 12; // where it sits under the greeting
  const travel = Math.max(restTop - pinTop, 60);
  const pillTop = scrollY.interpolate({
    inputRange: [0, travel],
    outputRange: [restTop, pinTop],
    extrapolate: "clamp",
  });
  const blurOpacity = scrollY.interpolate({
    inputRange: [travel - 40, travel],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const catBarTop = insets.top + 12 + 54 + 6;
  const revealEnd = Math.max(catLayout.y + catLayout.h - (insets.top + 78), 31);
  const catBarOpacity = scrollY.interpolate({
    inputRange: [revealEnd - 30, revealEnd],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <ThemedView style={s.screen}>
      <View style={s.safeArea}>
        <ScrollView
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            s.scrollContent,
            { paddingBottom: insets.bottom + 120 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadHomeData()}
              tintColor="#E87B4F"
              colors={["#E87B4F"]}
              title="Refreshing..."
              titleColor="#333"
            />
          }
        >
          {/* ─── Top Gradient Background ─── */}
          {/* ─── Top Background: ad media, gradient as fallback ─── */}
          <View style={s.topGradientWrap} pointerEvents="none">
            {adUrl && (
              <>
                <Image
                  source={{ uri: adUrl }}
                  style={[
                    StyleSheet.absoluteFill,
                    { opacity: adReady ? 1 : 0 },
                  ]}
                  contentFit="cover"
                  onLoad={() => setAdReady(true)}
                  onError={() => {
                    setAdUrl(null);
                    setAdReady(false);
                  }}
                />
                {adReady && (
                  <LinearGradient
                    colors={["rgba(250,250,250,0)", "#FAFAFA"]}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 160,
                    }}
                  />
                )}
              </>
            )}

            {!(adUrl && adReady) && (
              <>
                {visibleBanners.map((banner, i) => (
                  <LinearGradient
                    key={banner.id}
                    colors={[
                      rgba(banner.color, 0.55),
                      rgba(banner.color, 0.25),
                      rgba(banner.color, 0),
                    ]}
                    locations={[0, 0.5, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[
                      StyleSheet.absoluteFill,
                      { opacity: i === activeBannerIndex ? 1 : 0 },
                    ]}
                  />
                ))}
                {visibleBanners.length === 0 && (
                  <LinearGradient
                    colors={topGradientColors as [string, string, string]}
                    locations={[0, 0.5, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                )}
              </>
            )}
          </View>

          {/* ─── Header ─── */}
          <View
            style={[s.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}
            onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
          >
            <View style={s.headerLeft}>
              <ThemedText style={s.greeting}>{getGreeting()}</ThemedText>
              <ThemedText style={s.headline} numberOfLines={1}>
                {storeName || activeStore?.name || "Store"}
              </ThemedText>
              {!!storeAddress && (
                <ThemedText style={s.storeAddress} numberOfLines={1}>
                  {storeAddress}
                </ThemedText>
              )}
            </View>
            <View style={s.headerActions}>
              <Pressable
                style={s.headerIconBtn}
                onPress={() => router.push("/cart")}
                accessibilityLabel="Open cart"
              >
                <SymbolView
                  name={{
                    ios: "cart.fill",
                    android: "shopping_cart",
                    web: "shopping_cart",
                  }}
                  size={22}
                  tintColor="#1A1A1A"
                />
              </Pressable>
              <Pressable
                style={s.headerIconBtn}
                onPress={() => router.push("/notifications")}
                accessibilityLabel="Open notifications"
              >
                <SymbolView
                  name={{
                    ios: "bell",
                    android: "notifications",
                    web: "notifications",
                  }}
                  size={22}
                  tintColor="#1A1A1A"
                />
                {unreadCount > 0 && (
                  <View style={s.notifBadge}>
                    <ThemedText style={s.notifBadgeText}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </ThemedText>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
          {/* ─── Search Bar (in page) ─── */}
          {/* space where the floating search bar sits at rest */}
          <View style={{ height: 12 + 54 + 12 + 8 }} />

          {/* ─── Hero Banner ─── */}
          {visibleBanners.length > 0 ? (
            <ScrollView
              ref={bannerScrollRef}
              key={activeCategory}
              horizontal
              pagingEnabled
              snapToInterval={Dimensions.get("window").width - 48 + 12}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              style={s.heroBannerWrap}
              contentContainerStyle={{ gap: 12 }}
              onScroll={handleBannerScroll}
              scrollEventThrottle={16}
            >
              {visibleBanners.map((banner) => (
                <Pressable
                  key={banner.id}
                  style={s.heroCard}
                  disabled={!banner.productId}
                  onPress={() =>
                    banner.productId &&
                    router.push({
                      pathname: "/product/[id]",
                      params: { id: banner.productId },
                    })
                  }
                >
                  <Image
                    source={{ uri: banner.image }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={s.heroBannerWrap}>
              <View style={s.heroCard}>
                {heroProduct ? (
                  <Image
                    source={{ uri: heroProduct.image }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: "#E5E5E5" },
                    ]}
                  />
                )}
              </View>
            </View>
          )}

          {/* ─── Banner Dots ─── */}
          {visibleBanners.length > 1 && (
            <View style={s.bannerDots}>
              {visibleBanners.map((banner, i) => {
                const range = [i - 1, i, i + 1];
                const width = bannerScrollX.interpolate({
                  inputRange: range,
                  outputRange: [6, 18, 6],
                  extrapolate: "clamp",
                });
                const backgroundColor = bannerScrollX.interpolate({
                  inputRange: range,
                  outputRange: ["#D0D0D0", "#E8875C", "#D0D0D0"],
                  extrapolate: "clamp",
                });
                return (
                  <Animated.View
                    key={banner.id}
                    style={[s.bannerDot, { width, backgroundColor }]}
                  />
                );
              })}
            </View>
          )}

          {/* ─── Categories ─── */}
          <View
            style={s.categoriesSection}
            onLayout={(e) =>
              setCatLayout({
                y: e.nativeEvent.layout.y,
                h: e.nativeEvent.layout.height,
              })
            }
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.categoriesRow}
            >
              {categoryItems.map((cat) => (
                <Pressable
                  key={`${cat.id}-${cat.name}`}
                  style={s.categoryItem}
                  onPress={() => selectCategory(cat.id)}
                >
                  <View
                    style={[
                      s.categoryCircle,
                      activeCategory === cat.id && s.categoryCircleActive,
                    ]}
                  >
                    {cat.image ? (
                      <Image
                        key={`${cat.id}-image`}
                        source={{ uri: cat.image }}
                        style={s.categoryCircleImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        recyclingKey={cat.id}
                        transition={0}
                        onError={(e) =>
                          console.warn(
                            "Category image failed",
                            cat.id,
                            cat.image,
                            e,
                          )
                        }
                      />
                    ) : cat.icon ? (
                      <Ionicons
                        name={cat.icon}
                        size={26}
                        color={
                          activeCategory === cat.id ? "#E8875C" : "#444444"
                        }
                      />
                    ) : (
                      <ThemedText style={s.categoryEmoji}>
                        {cat.emoji}
                      </ThemedText>
                    )}
                  </View>
                  <ThemedText style={s.categoryLabel}>{cat.name}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* ─── New Arrivals ─── */}
          {isForYou && flashProducts.length > 0 && (
            <View style={s.flashWrap}>
              <View style={s.flashBanner}>
                <ThemedText style={s.flashTitle}>NEW ARRIVALS</ThemedText>
              </View>
              <ThemedText style={s.flashSub}>JUST LANDED</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.flashRow}
              >
                {flashProducts.map((product) => (
                  <Pressable
                    key={product.id}
                    style={s.flashCard}
                    onPress={() =>
                      router.push({
                        pathname: "/product/[id]",
                        params: { id: product.id },
                      })
                    }
                  >
                    <Image
                      source={{ uri: product.image }}
                      style={s.flashImage}
                      contentFit="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ─── For You ─── */}
          {isForYou && products.length > 0 && (
            <View style={s.forYouSection}>
              <View style={s.featuredHeader}>
                <ThemedText style={s.sectionTitle}>For You</ThemedText>
                <Pressable onPress={() => router.push("/products")}>
                  <ThemedText style={s.seeAllText}>See All</ThemedText>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.forYouRow}
              >
                {products.slice(0, 10).map((product) => {
                  const isSaved = isWishlisted(product.id);
                  return (
                    <Pressable
                      key={product.id}
                      style={s.forYouCard}
                      onPress={() =>
                        router.push({
                          pathname: "/product/[id]",
                          params: { id: product.id },
                        })
                      }
                    >
                      <View style={s.forYouImageWrap}>
                        <Image
                          source={{ uri: product.image }}
                          style={s.forYouImage}
                          contentFit="cover"
                        />
                        <Pressable
                          style={s.heartBtn}
                          onPress={(event) => {
                            event.stopPropagation();
                            void toggleWishlist(product);
                          }}
                        >
                          <Ionicons
                            name={isSaved ? "heart" : "heart-outline"}
                            size={18}
                            color={isSaved ? "#E8634A" : "#444444"}
                          />
                        </Pressable>
                      </View>
                      <ThemedText style={s.forYouName} numberOfLines={1}>
                        {product.name}
                      </ThemedText>
                      <ThemedText style={s.forYouPrice}>
                        {product.price > 0
                          ? `₹${product.price}`
                          : "PRICE ON REQUEST"}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ─── Secondary Banner ─── */}
          {!isForYou &&
          visibleBanners.length <= 1 ? null : visibleBanners.length > 1 ? (
            <View style={s.secondaryBannerWrap}>
              <View style={s.secondaryBannerCard}>
                <LinearGradient
                  colors={
                    buildPalette(visibleBanners[1].color).hero as unknown as [
                      string,
                      string,
                      string,
                    ]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={s.secondaryBannerTextArea}>
                  <View style={s.heroNewBadge}>
                    <ThemedText style={s.heroNewBadgeText}>
                      LIMITED TIME
                    </ThemedText>
                  </View>
                  <ThemedText style={s.secondaryBannerTitle} numberOfLines={2}>
                    {visibleBanners[1].name}
                  </ThemedText>
                  {visibleBanners[1].productId && (
                    <Pressable
                      style={s.heroTryBtn}
                      onPress={() =>
                        router.push({
                          pathname: "/product/[id]",
                          params: { id: visibleBanners[1].productId! },
                        })
                      }
                    >
                      <ThemedText style={s.heroTryBtnText}>SHOP NOW</ThemedText>
                    </Pressable>
                  )}
                </View>
                <Image
                  source={{ uri: offerImage || visibleBanners[1].image }}
                  style={s.secondaryBannerImage}
                  contentFit="cover"
                />
              </View>
            </View>
          ) : (
            <View style={s.secondaryBannerWrap}>
              <View style={s.secondaryBannerCard}>
                <LinearGradient
                  colors={["#d7c3a5", "#d7c3a5", "#d7c3a5"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={s.secondaryBannerTextArea}>
                  <View style={s.heroNewBadge}>
                    <ThemedText style={s.heroNewBadgeText}>
                      LIMITED TIME
                    </ThemedText>
                  </View>
                  <ThemedText style={s.secondaryBannerTitle}>
                    Bundle & Save{"\n"}This Week
                  </ThemedText>
                  <Pressable style={s.heroTryBtn}>
                    <ThemedText style={s.heroTryBtnText}>SHOP NOW</ThemedText>
                  </Pressable>
                </View>
                {!!offerImage && (
                  <Image
                    source={{ uri: offerImage }}
                    style={s.secondaryBannerImage}
                    contentFit="cover"
                  />
                )}
              </View>
            </View>
          )}

          {/* ─── Featured Products ─── */}
          <View style={s.featuredSection}>
            <View style={s.featuredHeader}>
              <ThemedText style={s.sectionTitle}>
                {isForYou ? "Featured Products" : activeCategoryName}
              </ThemedText>
              <Pressable
                onPress={() =>
                  isForYou
                    ? router.push("/products")
                    : router.push({
                        pathname: "/products",
                        params: {
                          categoryId: activeCategory,
                          categoryName: activeCategoryName,
                        },
                      })
                }
              >
                <ThemedText style={s.seeAllText}>See All</ThemedText>
              </Pressable>
            </View>
            <View style={s.productGrid}>
              {filteredProducts.map((product, index) => {
                const isSaved = isWishlisted(product.id);
                const cartItem = cartItems.find(
                  (item) => item.id === product.id,
                );

                return (
                  <View key={product.id} style={s.productSlot}>
                    <Pressable
                      style={s.productCard}
                      onPress={() =>
                        router.push({
                          pathname: "/product/[id]",
                          params: { id: product.id },
                        })
                      }
                    >
                      <View style={s.productImageWrap}>
                        <SlidingProductImage
                          images={
                            product.colors?.length
                              ? product.colors.map((c) => c.image)
                              : [product.image]
                          }
                          activeIndex={selectedColorIndex[product.id] ?? 0}
                          style={s.productImage}
                        />
                        <Pressable
                          style={s.heartBtn}
                          onPress={(event) => {
                            event.stopPropagation();
                            void toggleWishlist(product);
                          }}
                        >
                          <Ionicons
                            name={isSaved ? "heart" : "heart-outline"}
                            size={18}
                            color={isSaved ? "#E8634A" : "#444444"}
                          />
                        </Pressable>
                        {cartItem ? (
                          <View style={s.cartControls}>
                            <Pressable
                              accessibilityLabel={`Remove one ${product.name} from cart`}
                              onPress={(event) => {
                                event.stopPropagation();
                                void changeProductQuantity(product, -1);
                              }}
                              style={s.cartQtyBtn}
                            >
                              <ThemedText style={s.cartQtyBtnText}>
                                −
                              </ThemedText>
                            </Pressable>
                            <ThemedText style={s.cartQtyValue}>
                              {cartItem.quantity}
                            </ThemedText>
                            <Pressable
                              accessibilityLabel={`Add another ${product.name} to cart`}
                              onPress={(event) => {
                                event.stopPropagation();
                                void changeProductQuantity(product, 1);
                              }}
                              style={s.cartQtyBtn}
                            >
                              <ThemedText style={s.cartQtyBtnText}>
                                +
                              </ThemedText>
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable
                            accessibilityLabel={`Add ${product.name} to cart`}
                            style={s.addCartBtn}
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
                              size={13}
                              tintColor="#ffffff"
                            />
                          </Pressable>
                        )}
                      </View>
                      <View style={s.productInfo}>
                        <ThemedText style={s.productName} numberOfLines={1}>
                          {product.name}
                        </ThemedText>
                        <ThemedText style={s.productPrice}>
                          {product.price > 0
                            ? `₹${product.price}`
                            : "PRICE ON REQUEST"}
                        </ThemedText>
                      </View>
                      {product.colors && product.colors.length > 1 && (
                        <View style={s.colorSwatchRow}>
                          {product.colors.map((c, idx) => (
                            <Pressable
                              key={`${c.color}-${idx}`}
                              accessibilityLabel={`Select ${c.color}`}
                              onPress={(event) => {
                                event.stopPropagation();
                                setSelectedColorIndex((prev) => ({
                                  ...prev,
                                  [product.id]: idx,
                                }));
                              }}
                              style={[
                                s.colorSwatch,
                                { backgroundColor: c.color.toLowerCase() },
                                (selectedColorIndex[product.id] ?? 0) === idx &&
                                  s.colorSwatchActive,
                              ]}
                            />
                          ))}
                        </View>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
            {!isForYou && filteredProducts.length === 0 && (
              <ThemedText
                style={{ textAlign: "center", color: "#999", marginTop: 24 }}
              >
                No products in this category yet.
              </ThemedText>
            )}
          </View>
        </ScrollView>
      </View>

      {/* ─── Blur layer: full width, from the very top of the screen ─── */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 12 + 54 + 12,
          opacity: blurOpacity,
          zIndex: 20,
        }}
      >
        <BlurView
          intensity={70}
          tint="light"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ─── The one and only search bar ─── */}
      <Animated.View
        style={{
          position: "absolute",
          top: pillTop,
          left: 24,
          right: 24,
          zIndex: 21,
        }}
      >
        {renderSearchPill()}
      </Animated.View>

      {categories.length > 0 && (
        <Animated.View
          pointerEvents={chipsActive ? "auto" : "none"}
          style={[s.catBar, { top: catBarTop, opacity: catBarOpacity }]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.catBarRow}
            keyboardShouldPersistTaps="handled"
          >
            {[
              { id: FOR_YOU, name: "For You" },
              ...categories.map((c) => ({ id: c.id, name: c.name })),
            ].map((c) => (
              <Pressable
                key={c.id}
                style={s.catBarItem}
                onPress={() => selectCategory(c.id)}
              >
                <ThemedText
                  style={[
                    s.catBarText,
                    activeCategory === c.id && s.catBarTextActive,
                  ]}
                >
                  {c.name}
                </ThemedText>
                {activeCategory === c.id && <View style={s.catBarUnderline} />}
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* ─── Search Modal (unchanged logic) ─── */}
      <Modal
        visible={searchOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setSearchOpen(false)}
      >
        <SafeAreaProvider>
          <SafeAreaView style={s.searchScreen}>
            <View style={s.searchScreenTopBar}>
              <Pressable
                onPress={() => setSearchOpen(false)}
                accessibilityLabel="Close search"
                style={s.searchScreenClose}
              >
                <SymbolView
                  name={{
                    ios: "arrow.left",
                    android: "arrow_back",
                    web: "arrow_back",
                  }}
                  size={22}
                  tintColor="#1A1A1A"
                />
              </Pressable>
              <View style={s.searchScreenInputWrap}>
                <SymbolView
                  name={{
                    ios: "magnifyingglass",
                    android: "search",
                    web: "search",
                  }}
                  size={18}
                  tintColor="#999"
                />
                <TextInput
                  autoFocus
                  value={query}
                  onChangeText={setQuery}
                  placeholder={
                    voice.listening ? "Listening..." : "Search products"
                  }
                  placeholderTextColor="#999"
                  returnKeyType="search"
                  onSubmitEditing={() => void submitSearch(query)}
                  style={s.searchScreenInput}
                />
                <Pressable
                  accessibilityLabel="Voice search"
                  onPress={voice.toggle}
                  hitSlop={10}
                >
                  <SymbolView
                    name={{ ios: "mic.fill", android: "mic", web: "mic" }}
                    size={20}
                    tintColor={voice.listening ? "#E8634A" : "#999"}
                  />
                </Pressable>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.searchScreenScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={s.recentSearchesHeaderRow}>
                <ThemedText style={s.recentSearchesTitle}>
                  Recent Searches
                </ThemedText>
                {recentSearches.length > 0 && (
                  <Pressable onPress={() => void clearRecentSearches()}>
                    <ThemedText style={s.searchEditLink}>Edit</ThemedText>
                  </Pressable>
                )}
              </View>

              {recentSearches.length === 0 ? (
                <ThemedText style={s.noRecentSearches}>
                  No recent searches
                </ThemedText>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.recentSearchesRow}
                >
                  {recentSearches.map((search) => (
                    <Pressable
                      key={search}
                      style={s.recentSearchChip}
                      onPress={() => selectRecentSearch(search)}
                    >
                      <View style={s.recentSearchChipIcon}>
                        <SymbolView
                          name={{
                            ios: "clock",
                            android: "history",
                            web: "history",
                          }}
                          size={20}
                          tintColor="#999"
                        />
                      </View>
                      <ThemedText
                        style={s.recentSearchChipLabel}
                        numberOfLines={1}
                      >
                        {search}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {categories.length > 0 && (
                <View style={s.recommendedSection}>
                  <ThemedText style={s.recentSearchesTitle}>
                    Recommended Stores
                  </ThemedText>
                  <View style={s.recommendedGrid}>
                    {categories.slice(0, 3).map((category) => {
                      const categoryImageUrl = category.image
                        ? apiImageUrl(category.image)
                        : undefined;
                      return (
                        <Pressable
                          key={category.id}
                          style={s.recommendedCard}
                          onPress={() => {
                            setActiveCategory(category.id);
                            setSearchOpen(false);
                          }}
                        >
                          <View style={s.recommendedImageBox}>
                            {categoryImageUrl ? (
                              <Image
                                source={{ uri: categoryImageUrl }}
                                style={s.recommendedImage}
                                contentFit="cover"
                              />
                            ) : (
                              <SymbolView
                                name={{
                                  ios: "bag.fill",
                                  android: "shopping_bag",
                                  web: "shopping_bag",
                                }}
                                size={26}
                                tintColor="#999"
                              />
                            )}
                          </View>
                          <ThemedText
                            style={s.recommendedLabel}
                            numberOfLines={1}
                          >
                            {category.name}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {products.length > 0 && (
                <View style={s.trendingSection}>
                  <ThemedText style={s.recentSearchesTitle}>
                    Trending Today
                  </ThemedText>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.trendingRow}
                  >
                    {products.slice(0, 6).map((product) => (
                      <Pressable
                        key={product.id}
                        style={s.trendingCard}
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
                          style={s.trendingImage}
                          contentFit="cover"
                        />
                        <ThemedText style={s.trendingLabel} numberOfLines={2}>
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

const s = StyleSheet.create({
  /* ─── Layout ─── */
  screen: { flex: 1, backgroundColor: "#FAFAFA" },
  offerBannerWrap: { marginHorizontal: 24, marginBottom: 28 },
  offerBannerImage: {
    width: "100%",
    height: 140,
    borderRadius: 20,
    backgroundColor: "#EEE",
  },
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  topGradientWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 400,
  },

  /* ─── Header ─── */
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: { flex: 1 },
  greeting: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#FFFFFF",
    fontWeight: "500",
    marginBottom: 4,
  },
  headline: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  storeAddress: {
    fontSize: 12,
    fontWeight: "500",
    color: "#FFFFFF",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    position: "relative",
  },

  /* ─── Search Bar ─── */
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 100,
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 20,
    paddingLeft: 18,
    paddingRight: 6,
    height: 54,
    shadowColor: "rgba(0,0,0,0.08)",
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1A1A1A",
    fontWeight: "400",
    marginLeft: 10,
  },
  searchOrangeBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F09148",
    alignItems: "center",
    justifyContent: "center",
  },

  /* ─── Hero Banner ─── */
  heroBannerWrap: {
    marginHorizontal: 24,
    marginBottom: 28,
  },
  heroCard: {
    width: Dimensions.get("window").width - 48,
    height: 200,
    borderRadius: 24,
    overflow: "hidden",
    flexDirection: "row",
    position: "relative",
  },
  heroTextArea: {
    flex: 1,
    padding: 22,
    justifyContent: "center",
    zIndex: 2,
  },
  heroNewBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  heroNewBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  heroProductName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  heroPrice: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 6,
  },
  heroTryBtn: {
    backgroundColor: "#1A1A1A",
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  heroTryBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  heroImage: {
    width: "45%",
    height: "100%",
    position: "absolute",
    right: 0,
    bottom: 0,
  },

  /* ─── Banner Dots ─── */
  bannerDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: -20,
    marginBottom: 12,
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D0D0D0",
  },
  bannerDotActive: {
    width: 18,
    backgroundColor: "#E8875C",
  },

  /* ─── Categories ─── */
  categoriesSection: {
    paddingHorizontal: 0,
    marginBottom: 28,
  },
  categoriesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.3,
  },
  genderTabs: {
    flexDirection: "row",
    gap: 6,
  },
  genderTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    backgroundColor: "transparent",
  },
  genderTabActive: {
    backgroundColor: "#1A1A1A",
    borderColor: "#1A1A1A",
  },
  genderTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666666",
  },
  genderTabTextActive: {
    color: "#FFFFFF",
  },
  categoriesRow: {
    gap: 8,
    paddingRight: 0,
  },
  categoryItem: {
    alignItems: "center",
    width: 68,
  },
  categoryCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F5F0EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  categoryCircleActive: {
    borderColor: "#E8875C",
  },
  categoryCircleImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  categoryEmoji: {
    fontSize: 26,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#444444",
    textAlign: "center",
  },

  /* ─── Featured Products ─── */
  featuredSection: {
    paddingHorizontal: 24,
  },
  featuredHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E8875C",
  },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 16,
    columnGap: 12,
  },
  productSlot: {
    width: "48%",
    minWidth: 150,
  },
  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "rgba(0,0,0,0.06)",
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  productImageWrap: {
    position: "relative",
    aspectRatio: 1,
    backgroundColor: "#F5F2EE",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  heartBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
    elevation: 5,
  },
  addCartBtn: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  cartControls: {
    position: "absolute",
    right: 10,
    bottom: 10,
    height: 32,
    minWidth: 80,
    borderRadius: 16,
    paddingHorizontal: 4,
    backgroundColor: "#1A1A1A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cartQtyBtn: {
    width: 26,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  cartQtyBtnText: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "700",
  },
  cartQtyValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    minWidth: 14,
    textAlign: "center",
  },
  productInfo: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  productName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  colorSwatchRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 2,
  },
  colorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
  },
  colorSwatchActive: {
    borderWidth: 2,
    borderColor: "#E8875C",
  },

  /* ─── Search Modal ─── */
  searchScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  searchScreenTopBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchScreenClose: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  searchScreenInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F4F4F0",
    borderRadius: 100,
    paddingHorizontal: 14,
    height: 44,
  },
  searchScreenInput: {
    flex: 1,
    color: "#1A1A1A",
    fontSize: 16,
    fontWeight: "500",
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
  recentSearchesTitle: {
    color: "#999",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  searchEditLink: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E8875C",
  },
  noRecentSearches: {
    color: "#999",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 12,
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
    backgroundColor: "#F4F4F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  recentSearchChipLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1A1A1A",
    textAlign: "center",
  },
  recommendedSection: {
    marginTop: 28,
    backgroundColor: "#FEF0E6",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 14,
  },
  recommendedImageBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F5F0EB",
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
    color: "#1A1A1A",
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
    borderRadius: 16,
    backgroundColor: "#F4F4F0",
    marginBottom: 8,
  },
  trendingLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  flashWrap: {
    marginHorizontal: 24,
    marginBottom: 28,
    backgroundColor: "#eccd9e",
    borderRadius: 20,
    overflow: "hidden",
    paddingBottom: 16,
  },
  flashBanner: {
    backgroundColor: "#d4561b",
    marginTop: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  flashTitle: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 1,
  },
  flashSub: {
    color: "#410b0b",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  flashRow: {
    gap: 10,
    paddingHorizontal: 12,
  },
  flashCard: {
    width: 170,
    aspectRatio: 0.8,
    borderRadius: 14,
    overflow: "hidden",
  },
  flashImage: { width: "100%", height: "100%" },
  forYouSection: {
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  forYouRow: {
    gap: 14,
    paddingRight: 24,
  },
  forYouCard: {
    width: 140,
  },
  forYouImageWrap: {
    position: "relative",
    aspectRatio: 1,
    backgroundColor: "#F5F2EE",
    borderRadius: 18,
    overflow: "hidden",
  },
  forYouImage: {
    width: "100%",
    height: "100%",
  },
  forYouName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1A1A",
    marginTop: 8,
  },
  forYouPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1A1A1A",
    marginTop: 2,
  },
  secondaryBannerWrap: {
    marginHorizontal: 24,
    marginBottom: 28,
  },
  secondaryBannerCard: {
    width: "100%",
    height: 140,
    borderRadius: 20,
    overflow: "hidden",
    flexDirection: "row",
    position: "relative",
  },
  secondaryBannerTextArea: {
    flex: 1,
    padding: 18,
    justifyContent: "center",
    zIndex: 2,
  },
  secondaryBannerTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
    lineHeight: 21,
    marginBottom: 8,
  },
  secondaryBannerImage: {
    width: "40%",
    height: "100%",
    position: "absolute",
    right: 0,
    bottom: 0,
  },
  notifBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: "#E85D4A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  notifBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  catBarRow: { paddingHorizontal: 24, gap: 22, alignItems: "center" },
  catBarItem: { height: 40, justifyContent: "center" },
  catBarText: { fontSize: 13, fontWeight: "600", color: "#8A8A8A" },
  catBarTextActive: { color: "#1A1A1A", fontWeight: "800" },
  catBarUnderline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: "#E8875C",
    borderRadius: 1,
  },
  catBar: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "transparent",
  },
});
