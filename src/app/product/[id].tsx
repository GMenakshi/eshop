import { ImageViewer } from "@/components/image-viewer";
import { ProductRail } from "@/components/product-rail";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import {
  API_BASE_URL,
  api,
  apiImageUrl,
  type ApiDelivery,
  type ApiProduct,
  type ApiVariant,
} from "@/lib/api";
import { formatDeliveryDate } from "@/lib/delivery";
import { goBackOrHome } from "@/lib/navigation";
import { getPriceTiers } from "@/lib/price-tiers";
import { gstBreakup, gstRate, pickGst } from "@/lib/gst";
import { addRecentlyViewed, getRecentlyViewedIds } from "@/lib/recently-viewed";
import { useStore } from "@/lib/store-context";
import { usePincode } from "@/lib/use-pincode";
import { deliveryDateText, shippingChargeText } from "@/lib/delivery-text";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { getColors } from "react-native-image-colors";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  Share,
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
const muted = "#999999";
const accent = "#E8634A";
const bgLight = "#F8F6F3";
const screenWidth = Dimensions.get("window").width;
const GLASS_H = 190; // height of the frosted zone at the top of the card

const withAlpha = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(245,185,121,${a})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const cleanDescription = (description?: string) =>
  description?.replace(/<[^>]+>/g, "").trim() ||
  "A considered everyday essential with a clean finish and dependable performance.";

type ReviewView = {
  id: string;
  rating: number;
  comment: string;
  author: string;
  date: string;
  images: string[];
};

function reviewsFromPayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload))
    return payload.filter((e): e is Record<string, unknown> =>
      Boolean(e && typeof e === "object"),
    );
  if (!payload || typeof payload !== "object") return [];
  return reviewsFromPayload((payload as Record<string, unknown>).reviews);
}

function toReviewView(
  record: Record<string, unknown>,
  index: number,
): ReviewView {
  const user = record.userId as Record<string, unknown> | string | undefined;
  const author =
    typeof user === "object" && user && typeof user.name === "string"
      ? user.name
      : "Customer";
  const image = typeof record.image === "string" ? record.image : "";
  return {
    id: String(record._id ?? index),
    rating: Number(record.rating) || 0,
    comment: String(record.comment ?? ""),
    author,
    date: record.createdAt
      ? new Date(String(record.createdAt)).toISOString().slice(0, 10)
      : "",
    images: image ? [image] : [],
  };
}

const getVariantLabel = (variant: ApiVariant) => {
  const size = variant.size?.trim();
  const weight = variant.weight?.trim();
  let sizeShort = "";
  if (size) {
    const s = size.toUpperCase();
    if (s === "SMALL" || s === "S") sizeShort = "S";
    else if (s === "MEDIUM" || s === "M") sizeShort = "M";
    else if (s === "LARGE" || s === "L") sizeShort = "L";
    else if (s === "EXTRA LARGE" || s === "XLARGE" || s === "XL")
      sizeShort = "XL";
    else if (s === "XXLARGE" || s === "XXL") sizeShort = "XXL";
    else sizeShort = size;
  }
  if (sizeShort && weight) return `${sizeShort} (${weight})`;
  if (sizeShort) return sizeShort;
  if (weight) return weight;
  return "One Size";
};

const getSimilarDiscount = (entry: ApiProduct) => {
  const original = entry.originalPrice;
  const price = entry.price;
  if (price > 0 && typeof original === "number" && original > price) {
    return Math.round(((original - price) / original) * 100);
  }
  return null;
};

const getCategoryKey = (p: any): string => {
  const c = p?.categoryId ?? p?.category;
  if (!c) return "";
  return typeof c === "object" ? String(c._id ?? c.id ?? "") : String(c);
};

const pickSimilar = (
  all: ApiProduct[],
  current: ApiProduct | null | undefined,
  currentId: string,
) => {
  const others = all.filter((e) => e._id !== currentId);
  const key = getCategoryKey(current);
  if (!key) return others;
  const sameCategory = others.filter((e) => getCategoryKey(e) === key);
  return sameCategory.length > 0 ? sameCategory : others;
};

type MediaItem = { type: "image" | "video"; uri: string };

function VideoSlide({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    const sub = player.addListener("statusChange", ({ status, error }) => {
      console.log("VIDEO STATUS:", status, uri, error?.message);
    });
    return () => sub.remove();
  }, [player, uri]);

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  return (
    <VideoView
      player={player}
      style={st.heroVideo}
      contentFit="contain"
      nativeControls
      surfaceType="textureView"
    />
  );
}

/** Render filled + empty stars */
function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Text
        key={i}
        style={{
          fontSize: size,
          color: i <= Math.round(rating) ? "#F5A623" : "#D8D8D8",
        }}
      >
        ★
      </Text>,
    );
  }
  return <View style={{ flexDirection: "row", gap: 1 }}>{stars}</View>;
}

export default function ProductViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const [deliveryExpanded, setDeliveryExpanded] = useState(true);
  const { addItem, items: cartItems } = useCart();
  const { storeId, activeStore } = useStore();
  const pincode = usePincode();
  const { toggle, isSaved } = useWishlist();
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [similar, setSimilar] = useState<ApiProduct[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [qtyText, setQtyText] = useState("1");
  // keep the box in step when + / − or a tier chip changes the quantity
  useEffect(() => {
    setQtyText(String(quantity));
  }, [quantity]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showCartToast, setShowCartToast] = useState(false);
  const [cartBounce] = useState(() => new Animated.Value(1));
  const cartToastAnim = useRef(new Animated.Value(0)).current;
  const [scrollX] = useState(() => new Animated.Value(0));
  const scrollY = useRef(new Animated.Value(0)).current;
  const [reviews, setReviews] = useState<ReviewView[]>([]);
  const [ratingStats, setRatingStats] = useState({ average: 0, total: 0 });
  const [forYou, setForYou] = useState<ApiProduct[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [benefitsOpen, setBenefitsOpen] = useState(false);
  const galleryRef = useRef<ScrollView>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [deliveryCheck, setDeliveryCheck] = useState<{
    deliverable: boolean;
    message: string | null;
    delivery: ApiDelivery | null;
  } | null>(null);
  // If the product has color variants, ALWAYS use the selected color's images
  // (never fall back to product.images when variants exist).
  // Only use product.images / product.image when there are NO variants at all.
  const colorVariantsForImages = (product as any)?.variants ?? [];
  const selectedColorForImages = colorVariantsForImages[selectedColorIndex];

  // Variant images — only use them if the selected variant actually has images
  const variantImages: string[] = selectedColorForImages?.images ?? [];

  // Main product images — the top-level images array or single image field
  const mainImages: string[] =
    product?.images && product.images.length > 0
      ? product.images
      : product?.image
        ? [product.image]
        : [];

  // If variants exist AND the selected variant has its own images, show those.
  // Otherwise fall back to the product's main images.
  const productImages: string[] =
    colorVariantsForImages.length > 0 && variantImages.length > 0
      ? variantImages
      : mainImages;

  // Videos: from the selected color variant and/or the product itself
  const rawVideos: string[] = [
    ...(selectedColorForImages?.videos ?? []),
    ...((product as any)?.videos ?? []),
    ...((product as any)?.video ? [(product as any).video] : []),
  ];
  const productVideos = Array.from(new Set(rawVideos.filter(Boolean)));

  const isVideoUrl = (u: string) =>
    /\.(mp4|mov|m4v|webm|m3u8)(\?.*)?$/i.test(u) ||
    u.includes("/video/upload/");

  const allUrls = Array.from(
    new Set([...productImages, ...productVideos].filter(Boolean)),
  );

  const mediaItems: MediaItem[] = allUrls.map((uri) => ({
    type: isVideoUrl(uri) ? "video" : "image",
    uri,
  }));

  const imageItems = mediaItems.filter((m) => m.type === "image");
  const viewerImages = imageItems.map((m) => apiImageUrl(m.uri) ?? m.uri);

  const [tint, setTint] = useState("#F5B979");
  const heroUri = (() => {
    const m = mediaItems[galleryIndex];
    const u = m?.type === "image" ? m.uri : imageItems[0]?.uri;
    return u ? apiImageUrl(u) : undefined;
  })();

  useEffect(() => {
    if (!heroUri) return;
    let active = true;
    getColors(heroUri, {
      fallback: "#F5B979",
      cache: true,
      key: heroUri,
      quality: "low",
    })
      .then((c: any) => {
        if (!active) return;
        const col =
          c.platform === "ios"
            ? (c.background ?? c.primary)
            : (c.vibrant ?? c.dominant ?? c.average);
        if (col) setTint(col);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [heroUri]);

  useEffect(() => {
    if (!id || !storeId) return;
    let active = true;
    api
      .product(storeId, id, pincode)
      .then(async (response) => {
        let selected = response.product ?? response.data;
        let allProducts: ApiProduct[] = [];
        if (!selected) {
          const list = await api.products(storeId, 1, pincode);
          allProducts = list.products;
          selected = allProducts.find((entry) => entry._id === id);
        }
        if (!allProducts.length)
          allProducts = (await api.products(storeId, 1, pincode)).products;
        if (active) {
          setProduct(selected ?? null);
          setSelectedVariantIndex(0);
          setSelectedColorIndex(0);
          setSimilar(pickSimilar(allProducts, selected, id));
        }
      })
      .catch(async () => {
        try {
          const list = await api.products(storeId);
          if (active) {
            const selected =
              list.products.find((entry) => entry._id === id) ?? null;
            setProduct(selected);
            setSelectedVariantIndex(0);
            setSelectedColorIndex(0);
            setSimilar(pickSimilar(list.products, selected, id));
          }
        } catch {
          if (active) setProduct(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, storeId, pincode]);

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    api
      .allProducts(storeId, pincode)
      .then((catalog) => {
        if (active) setForYou(catalog);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [storeId, pincode]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetch(`${API_BASE_URL}/product/${id}/reviews`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((payload) => {
        if (!active) return;
        const data = payload as {
          averageRating?: number;
          totalReviews?: number;
        };
        setReviews(reviewsFromPayload(payload).map(toReviewView));
        setRatingStats({
          average: Number(data.averageRating) || 0,
          total: Number(data.totalReviews) || 0,
        });
      })
      .catch(() => {
        if (active) {
          setReviews([]);
          setRatingStats({ average: 0, total: 0 });
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !storeId) return;
    let active = true;
    (async () => {
      const ids = await getRecentlyViewedIds(storeId);
      if (active) setRecentIds(ids.filter((x) => x !== id));
      await addRecentlyViewed(storeId, id);
    })();
    return () => {
      active = false;
    };
  }, [id, storeId, pincode]);

  useEffect(() => {
    if (!showCartToast) {
      Animated.timing(cartToastAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.sequence([
      Animated.timing(cartToastAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.delay(1800),
      Animated.timing(cartToastAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => setShowCartToast(false));
  }, [showCartToast, cartToastAnim]);

  // If the single-product API drops priceTiers, read them from the list API
  useEffect(() => {
    if (!product || !storeId) return;
    const existing = (product as any).priceTiers;
    if (Array.isArray(existing) && existing.length > 0) return;
    let active = true;
    fetch(
      `${API_BASE_URL}/product/store/${encodeURIComponent(storeId)}/products`,
    )
      .then((r) => r.json())
      .then((json) => {
        const match = (json?.products ?? []).find(
          (p: any) => p._id === product._id,
        );
        if (active && match?.priceTiers?.length) {
          setProduct((prev) =>
            prev ? ({ ...prev, priceTiers: match.priceTiers } as any) : prev,
          );
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [product?._id, storeId]);

  const recentProducts = recentIds
    .map((rid) => forYou.find((p) => p._id === rid))
    .filter(Boolean) as ApiProduct[];

  // product.variants is now treated as an array of COLOR groups,
  // each with its own images and its own sizeVariants (size/weight/price/stock)
  const colorVariants = (product as any)?.variants ?? [];
  const hasColorVariants = colorVariants.length > 0;
  const selectedColorVariant =
    colorVariants[selectedColorIndex] ?? colorVariants[0];

  const sizeVariants = selectedColorVariant?.sizeVariants ?? [];
  const selectedVariant = sizeVariants[selectedVariantIndex] ?? sizeVariants[0];

  // quantity-based price tiers, e.g. 1-82 pcs = ₹X, 83-110 pcs = ₹Y
  const priceTiers = getPriceTiers(
    selectedVariant,
    selectedColorVariant,
    product,
  );
  const hasTiers = priceTiers.length > 0;
  useEffect(() => {
    if (product && priceTiers.length === 0) {
      console.log(
        "NO TIERS FOUND. product =",
        JSON.stringify(product).slice(0, 2500),
      );
    }
  }, [product]);
  // highest tier whose minimum you've reached; past the last max it stays on the last tier
  const activeTierIndex = hasTiers
    ? Math.max(
        0,
        priceTiers.reduce(
          (found, t, i) => (quantity >= t.minQty ? i : found),
          0,
        ),
      )
    : -1;
  const tierLabel = (t: { minQty: number; maxQty: number | null }) =>
    t.maxQty == null ? `${t.minQty}+` : `${t.minQty} - ${t.maxQty}`;
  const unitLabel = product?.unit ? String(product.unit) : "pcs";

  const currentPrice = hasTiers
    ? priceTiers[activeTierIndex].price
    : (selectedVariant?.offerPrice ?? product?.price ?? 0);
  const totalPrice = currentPrice * quantity;
  const priceOnRequest = !(currentPrice > 0);
  const taxGst = pickGst(
    selectedVariant?.effectiveGst,
    selectedColorVariant?.effectiveGst,
    product?.gst,
  );
  const taxRate = gstRate(taxGst);
  const gstInclusive = Boolean(product?.gstInclusive);
  const taxInfo = gstBreakup(currentPrice, quantity, taxRate, gstInclusive);
  const currentOriginalPrice = selectedVariant?.mrp ?? product?.originalPrice;
  const currentSize = selectedVariant?.size || product?.size || "One Size";
  const currentWeight = selectedVariant?.weight || product?.weight || "N/A";
  const currentStock = selectedVariant?.currentStock;
  const hasDiscount =
    !priceOnRequest &&
    !hasTiers &&
    typeof currentOriginalPrice === "number" &&
    currentOriginalPrice > currentPrice;
  const discountPercent =
    hasDiscount && currentOriginalPrice > 0
      ? Math.round(
          ((currentOriginalPrice - currentPrice) / currentOriginalPrice) * 100,
        )
      : 0;
  const categoryLabel =
    product?.categoryName || product?.categoryId || "Collection";

  const outOfStock = typeof currentStock === "number" && currentStock <= 0;
  const notDeliverable = deliveryCheck
    ? deliveryCheck.deliverable === false
    : product?.delivery?.deliverable === false;
  const liveDelivery = deliveryCheck?.delivery ?? product?.delivery;
  const maxQty =
    typeof currentStock === "number" && currentStock > 0
      ? currentStock
      : Number.POSITIVE_INFINITY;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const tierBasePrice = hasTiers ? priceTiers[0].price : 0;
  const referencePrice =
    typeof currentOriginalPrice === "number" &&
    currentOriginalPrice > currentPrice
      ? currentOriginalPrice
      : tierBasePrice > currentPrice
        ? tierBasePrice
        : 0;
  const hasOffer = !priceOnRequest && referencePrice > currentPrice;
  const totalOriginal = round2(referencePrice * quantity);
  const totalSaved = hasOffer
    ? round2((referencePrice - currentPrice) * quantity)
    : 0;
  const offerPercent = hasOffer
    ? Math.round(((referencePrice - currentPrice) / referencePrice) * 100)
    : 0;

  useEffect(() => {
    if (Number.isFinite(maxQty) && quantity > maxQty) setQuantity(maxQty);
  }, [maxQty]);

  const currentVariantId =
    selectedVariant?._id ??
    selectedVariant?.id ??
    selectedColorVariant?._id ??
    selectedColorVariant?.id ??
    product?.variantId;
  useEffect(() => {
    if (!product?._id || !pincode || !storeId) {
      setDeliveryCheck(null);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      try {
        const res = await api.deliveryCheck({
          storeUniqueId: String(storeId),
          pincode: String(pincode),
          productId: product._id,
          variantId: currentVariantId ? String(currentVariantId) : undefined,
          quantity,
          itemsTotal: Math.round(totalPrice * 100) / 100,
        });
        if (active && res.success)
          setDeliveryCheck({
            deliverable: res.deliverable,
            message: res.message,
            delivery: res.delivery,
          });
      } catch {
        /* keep the list estimate */
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [product?._id, currentVariantId, quantity, pincode, storeId, Math.round(totalPrice)]);

  const addedToCart = cartItems.some((item) => {
    if (item.id !== product?._id) return false;
    if (!currentVariantId) return true;
    const itemVariantId =
      "variantId" in item.product ? item.product.variantId : undefined;
    return itemVariantId === currentVariantId;
  });

  const savedAddress = user?.address;
  const hasSavedAddress =
    savedAddress &&
    (savedAddress.addressLine || savedAddress.city || savedAddress.pincode);
  const addressPreview = hasSavedAddress
    ? `${savedAddress.addressLine}${savedAddress.area ? `, ${savedAddress.area}` : ""}`
    : "Add a delivery address";

  const handleColorSelect = (index: number) => {
    setSelectedColorIndex(index);
    setSelectedVariantIndex(0); // reset size selection when color changes
    setGalleryIndex(0); // reset image carousel to first photo
  };

  const shareProduct = async () => {
    if (!product) return;
    const imageUrl = (
      apiImageUrl(productImages[0] ?? product.image) ?? ""
    ).replace(/ /g, "%20");
    const description = product.description
      ?.replace(/<[^>]+>/g, "")
      .trim()
      .slice(0, 150);
    const lines = [
      `*${product.title}*`,
      hasDiscount
        ? `Price: ₹${currentPrice} (MRP ₹${currentOriginalPrice}, ${discountPercent}% off)`
        : `Price: ₹${currentPrice}`,
      selectedColorVariant?.color ? `Color: ${selectedColorVariant.color}` : "",
      currentSize && currentSize !== "One Size" ? `Size: ${currentSize}` : "",
      currentWeight && currentWeight !== "N/A"
        ? `Weight: ${currentWeight}`
        : "",
      product.productCode ? `Code: ${product.productCode}` : "",
      description ? description : "",
      imageUrl ? `Image: ${imageUrl}` : "",
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join("\n"), title: product.title });
    } catch {}
  };

  const addToCart = async () => {
    if (!product) return;
    if (!token) {
      router.push("/sign-in");
      return;
    }
    if (notDeliverable) {
      Alert.alert(
        "Not deliverable",
        "This product can't be delivered to your pincode.",
      );
      return;
    }
    if (outOfStock) {
      Alert.alert("Out of stock", "This product is currently out of stock.");
      return;
    }
    if (quantity > maxQty) {
      Alert.alert("Limited stock", `Only ${currentStock} available.`);
      return;
    }
    setAdding(true);
    try {
      const variantId =
        selectedVariant?._id ??
        selectedVariant?.id ??
        selectedColorVariant?._id ??
        selectedColorVariant?.id ??
        product.variantId;
      const selectedImage =
        selectedColorVariant?.images?.[0] ?? productImages[0] ?? product.image;
      const productToAdd = {
        ...product,
        priceTiers,
        gst: taxGst,
        gstInclusive,
        variantId,
        color: selectedColorVariant?.color,
        colorVariantId: selectedColorVariant?._id ?? selectedColorVariant?.id,
        image: selectedImage,
        images: selectedImage ? [selectedImage] : product.images,
        price: currentPrice,
        originalPrice: currentOriginalPrice,
        size: currentSize,
        weight: currentWeight,
      };
      await addItem(productToAdd, quantity);
      Animated.sequence([
        Animated.spring(cartBounce, { toValue: 1.18, useNativeDriver: true }),
        Animated.spring(cartBounce, { toValue: 1, useNativeDriver: true }),
      ]).start();
      setShowCartToast(true);
    } catch (error) {
      Alert.alert(
        "Could not add product",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (!token) {
      router.push("/sign-in");
      return;
    }
    if (notDeliverable) {
      Alert.alert(
        "Not deliverable",
        "This product can't be delivered to your pincode.",
      );
      return;
    }
    if (outOfStock) {
      Alert.alert("Out of stock", "This product is currently out of stock.");
      return;
    }
    if (quantity > maxQty) {
      Alert.alert("Limited stock", `Only ${currentStock} available.`);
      return;
    }
    router.push({
      pathname: "/checkout",
      params: {
        isBuyNow: "true",
        productId: product._id,
        variantId: currentVariantId ?? "",
        quantity: String(quantity),
        codOnly: priceOnRequest ? "true" : "false",
      },
    });
  };

  if (loading)
    return (
      <SafeAreaView style={st.center}>
        <ActivityIndicator color={accent} size="large" />
        <ThemedText style={st.stateText}>Loading product...</ThemedText>
      </SafeAreaView>
    );
  if (!product)
    return (
      <SafeAreaView style={st.center}>
        <ThemedText style={st.stateTitle}>Product unavailable</ThemedText>
        <ThemedText style={st.stateText}>
          This product could not be loaded.
        </ThemedText>
        <Pressable onPress={goBackOrHome} style={st.backLink}>
          <ThemedText style={st.backLinkText}>GO BACK</ThemedText>
        </Pressable>
      </SafeAreaView>
    );

  const descriptionText = cleanDescription(product.description);

  // keeps the image (and back button) pinned while the content scrolls over it
  const heroTranslate = scrollY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolateLeft: "clamp",
  });
  const blurOpacity = scrollY.interpolate({
    inputRange: [0, 260],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const glassOpacity = scrollY.interpolate({
    inputRange: [0, 220],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const whiteOpacity = scrollY.interpolate({
    inputRange: [0, 220],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const currentMedia = mediaItems[galleryIndex];
  const blurUri = apiImageUrl(
    currentMedia?.type === "image" ? currentMedia.uri : imageItems[0]?.uri,
  );

  return (
    <SafeAreaView style={st.screen} edges={["top"]}>
      <Animated.ScrollView
        contentContainerStyle={[
          st.scrollContent,
          { paddingBottom: 110 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
      >
        {/* ─── Top Bar ─── */}
        <Animated.View
          style={[st.topBar, { transform: [{ translateY: heroTranslate }] }]}
        >
          <Pressable
            accessibilityLabel="Go back"
            onPress={goBackOrHome}
            style={st.topBarBtn}
          >
            <SymbolView
              name={{
                ios: "chevron.left",
                android: "arrow_back",
                web: "arrow_back",
              }}
              size={20}
              tintColor={ink}
            />
          </Pressable>
          {/* <View style={st.topBarCenter}>
            <SymbolView
              name={{
                ios: "magnifyingglass",
                android: "search",
                web: "search",
              }}
              size={16}
              tintColor={muted}
            />
            <ThemedText style={st.topBarSearchText} numberOfLines={1}>
              What are you looking for?
            </ThemedText>
          </View> */}
        </Animated.View>

        {/* ─── Product Image Gallery ─── */}
        <Animated.View
          style={[
            st.imageStage,
            { transform: [{ translateY: heroTranslate }] },
          ]}
        >
          {mediaItems.length > 0 ? (
            <ScrollView
              ref={galleryRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                {
                  useNativeDriver: false,
                  listener: (e: any) =>
                    setGalleryIndex(
                      Math.round(e.nativeEvent.contentOffset.x / screenWidth),
                    ),
                },
              )}
              scrollEventThrottle={16}
            >
              {mediaItems.map((item, index) => (
                <View key={`${item.uri}-${index}`} style={st.imageSlide}>
                  {item.type === "video" ? (
                    <VideoSlide
                      uri={apiImageUrl(item.uri) ?? item.uri}
                      active={galleryIndex === index}
                    />
                  ) : (
                    <Pressable
                      onPress={() =>
                        setViewerIndex(
                          imageItems.findIndex((m) => m.uri === item.uri),
                        )
                      }
                    >
                      <Image
                        source={{ uri: apiImageUrl(item.uri) }}
                        style={st.heroImage}
                        contentFit="cover"
                      />
                    </Pressable>
                  )}
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={st.imageSlide}>
              <ThemedText style={st.imageFallbackText}>NO IMAGE</ThemedText>
            </View>
          )}

          {/* mild gradient at the bottom of the image */}
          <LinearGradient
            pointerEvents="none"
            colors={[withAlpha(tint, 0), withAlpha(tint, 0.5)]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 160 }}
          />

          {/* blur + dim that fades in while scrolling */}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { opacity: blurOpacity }]}
          >
            {!!blurUri && (
              <Image
                source={{ uri: blurUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                blurRadius={40}
              />
            )}
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.25)" }]}
            />
          </Animated.View>
        </Animated.View>

        {/* ─── Image Thumbnails / Dots ─── */}
        {mediaItems.length > 1 && (
          <Animated.View
            style={[st.thumbPinned, { transform: [{ translateY: heroTranslate }] }]}
          >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.thumbRow}
          >
            {mediaItems.map((item, i) => (
              <Pressable
                key={`thumb-${i}`}
                style={[st.thumbItem, i === galleryIndex && st.thumbItemActive]}
                onPress={() => {
                  setGalleryIndex(i);
                  galleryRef.current?.scrollTo({
                    x: i * screenWidth,
                    animated: true,
                  });
                }}
              >
                {item.type === "video" ? (
                  <View style={st.thumbVideo}>
                    <Text style={st.thumbPlay}>▶</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: apiImageUrl(item.uri) }}
                    style={st.thumbImage}
                    contentFit="cover"
                  />
                )}
              </Pressable>
            ))}
          </ScrollView>
          </Animated.View>
        )}

        {/* ─── Product Info Sheet ─── */}
        <View style={st.infoSheet}>
          {/* solid white below the glass zone */}
          <View pointerEvents="none" style={st.sheetWhite} />

          {/* frosted glass + mild gradient (fades out on scroll) */}
          <Animated.View
            pointerEvents="none"
            style={[st.glassZone, { opacity: glassOpacity }]}
          >
            <BlurView
              intensity={45}
              tint="light"
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={[
                withAlpha(tint, 0.4),
                withAlpha(tint, 0.14),
                "rgba(255,255,255,1)",
              ]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* turns the glass zone solid white as you scroll */}
          <Animated.View
            pointerEvents="none"
            style={[st.glassZone, { backgroundColor: "#FFFFFF", opacity: whiteOpacity }]}
          />
          {/* Title + Rating Row */}
          <View style={st.titleRow}>
            <View style={st.titleRowLeft}>
              <ThemedText style={st.productTitle} numberOfLines={2}>
                {product.title}
              </ThemedText>
              <View style={st.ratingRow}>
                <StarRating rating={ratingStats.average || 4.8} />
                <ThemedText style={st.ratingText}>
                  {ratingStats.average > 0
                    ? ratingStats.average.toFixed(1)
                    : "4.8"}
                </ThemedText>
                <View style={st.ratingDivider} />
                <ThemedText style={st.reviewCountText}>
                  {ratingStats.total > 0
                    ? `${ratingStats.total} reviews`
                    : "50 reviews"}
                </ThemedText>
              </View>
            </View>
            <View style={st.titleActions}>
              <Pressable
                accessibilityLabel="Share product"
                style={st.wishlistBtn}
                onPress={shareProduct}
              >
                <SymbolView
                  name={{
                    ios: "square.and.arrow.up",
                    android: "share",
                    web: "share",
                  }}
                  size={20}
                  tintColor={ink}
                />
              </Pressable>
              <Pressable
                accessibilityLabel="Toggle wishlist"
                style={st.wishlistBtn}
                onPress={() =>
                  toggle({
                    id: product._id,
                    name: product.title || "",
                    brand: product.brandId || "",
                    price: currentPrice,
                    category: categoryLabel,
                    image: productImages[0] ?? product.image ?? "",
                    description: product.description || "",
                    unit: product.unit,
                    size: currentSize,
                  })
                }
              >
                <SymbolView
                  name={
                    isSaved(product._id)
                      ? {
                          ios: "heart.fill",
                          android: "favorite",
                          web: "favorite",
                        }
                      : {
                          ios: "heart",
                          android: "favorite_border",
                          web: "favorite_border",
                        }
                  }
                  size={20}
                  tintColor={isSaved(product._id) ? accent : "#CCCCCC"}
                />
              </Pressable>
            </View>
          </View>

          {notDeliverable && (
            <ThemedText
              style={{ color: "#E53935", fontWeight: "700", marginTop: 10 }}
            >
              {deliveryCheck?.message ??
                `Not deliverable to your pincode (${pincode})`}
            </ThemedText>
          )}

          {hasColorVariants && (
            <View style={st.colorSection}>
              <ThemedText style={st.colorSectionTitle}>
                Selected Color:{" "}
                <ThemedText style={st.colorSectionValue}>
                  {selectedColorVariant?.color}
                </ThemedText>
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={st.colorRow}
              >
                {colorVariants.map((variant: any, index: number) => {
                  const isSelected = index === selectedColorIndex;
                  const swatchImage = variant.images?.[0];
                  return (
                    <Pressable
                      key={variant._id || variant.color || index}
                      onPress={() => handleColorSelect(index)}
                      style={[
                        st.colorSwatchOuter,
                        isSelected && st.colorSwatchOuterSelected,
                      ]}
                    >
                      {swatchImage ? (
                        <Image
                          source={{ uri: apiImageUrl(swatchImage) }}
                          style={st.colorSwatchImage}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={st.colorSwatch} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ─── Product Size / Variants ─── */}
          {sizeVariants.length > 0 && (
            <View style={st.sizeSection}>
              <View style={st.sizeSectionHeader}>
                <ThemedText style={st.sizeSectionTitle}>
                  Product Size
                </ThemedText>
                <Pressable>
                  <ThemedText style={st.sizeGuideLink}>Size Guide</ThemedText>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={st.variantRow}
              >
                {sizeVariants.map((v: any, idx: number) => {
                  const isSelected = idx === selectedVariantIndex;
                  const isOutOfStock =
                    typeof v.currentStock === "number" && v.currentStock <= 0;
                  return (
                    <Pressable
                      key={v._id || idx}
                      style={[
                        st.variantChip,
                        isSelected && st.variantChipSelected,
                        isOutOfStock && st.variantChipDisabled,
                      ]}
                      onPress={() => setSelectedVariantIndex(idx)}
                    >
                      <ThemedText
                        style={[
                          st.variantChipText,
                          isSelected && st.variantChipTextSelected,
                        ]}
                      >
                        {getVariantLabel(v)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
          {/* ─── Price Tiers (quantity pricing) ─── */}
          {hasTiers && !priceOnRequest && (
            <View style={st.sizeSection}>
              <View style={st.sizeSectionHeader}>
                <ThemedText style={st.sizeSectionTitle}>
                  Buy More, Pay Less
                </ThemedText>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={st.variantRow}
              >
                {priceTiers.map((t, idx) => {
                  const isSelected = idx === activeTierIndex;
                  return (
                    <Pressable
                      key={`tier-${idx}`}
                      style={[
                        st.variantChip,
                        st.tierChip,
                        isSelected && st.variantChipSelected,
                      ]}
                      onPress={() => setQuantity(Math.min(maxQty, t.minQty))}
                    >
                      <ThemedText
                        style={[
                          st.tierQty,
                          isSelected && st.variantChipTextSelected,
                        ]}
                      >
                        {tierLabel(t)} {unitLabel}
                      </ThemedText>
                      <ThemedText
                        style={[
                          st.tierPrice,
                          isSelected && st.variantChipTextSelected,
                        ]}
                      >
                        ₹{t.price}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ─── Quantity (always shown) ─── */}
          <View style={st.qtyRow}>
            <ThemedText style={st.qtyLabel}>Quantity</ThemedText>
            <View style={st.qtyBox}>
              <Pressable
                style={[st.qtyBtn, outOfStock && st.qtyBtnDisabled]}
                disabled={outOfStock}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <ThemedText style={st.qtyBtnText}>−</ThemedText>
              </Pressable>
              <TextInput
                value={qtyText}
                onChangeText={(t) => {
                  const digits = t.replace(/\D/g, "").slice(0, 5);
                  setQtyText(digits);
                  if (digits)
                    setQuantity(
                      Math.min(maxQty, Math.max(1, parseInt(digits, 10))),
                    );
                }}
                onBlur={() => setQtyText(String(quantity))}
                keyboardType="number-pad"
                editable={!outOfStock}
                selectTextOnFocus
                maxLength={5}
                style={st.qtyInput}
              />
              <Pressable
                style={[
                  st.qtyBtn,
                  (outOfStock || quantity >= maxQty) && st.qtyBtnDisabled,
                ]}
                disabled={outOfStock || quantity >= maxQty}
                onPress={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              >
                <ThemedText style={st.qtyBtnText}>+</ThemedText>
              </Pressable>
            </View>
          </View>

          {/* ─── Product Description ─── */}
          <View style={st.descSection}>
            <ThemedText style={st.descTitle}>Product Description</ThemedText>
            <ThemedText
              style={st.descText}
              numberOfLines={descExpanded ? undefined : 3}
            >
              {descriptionText}
            </ThemedText>
            {descriptionText.length > 120 && (
              <Pressable onPress={() => setDescExpanded(!descExpanded)}>
                <ThemedText style={st.descReadMore}>
                  {descExpanded ? "Show less" : "Read more"}
                </ThemedText>
              </Pressable>
            )}
          </View>

          {/* ─── Price block ─── */}
          {!priceOnRequest && (hasTiers || hasOffer) && (
            <LinearGradient
              colors={["#D4145A", "#F15A24"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.dealBadge}
            >
              <Text style={st.dealBadgeText}>
                {hasTiers ? "Bulk deal" : "Special price"}
              </Text>
            </LinearGradient>
          )}

          <View style={st.ppRow}>
            {hasOffer && (
              <View style={st.ppPercentRow}>
                <Ionicons name="arrow-down" size={22} color="#22A45D" />
                <ThemedText style={st.ppPercent}>{offerPercent}%</ThemedText>
              </View>
            )}
            {hasOffer && (
              <ThemedText style={st.ppOriginal}>₹{totalOriginal}</ThemedText>
            )}
            <ThemedText style={priceOnRequest ? st.ppContact : st.ppPrice}>
              {priceOnRequest ? "Order to know Price" : `₹${round2(totalPrice)}`}
            </ThemedText>
            {!priceOnRequest && quantity > 1 && (
              <ThemedText style={st.ppTotal}>
                (₹{currentPrice} × {quantity})
              </ThemedText>
            )}
          </View>

          {hasOffer && (
            <View style={st.ppSave}>
              <View style={st.ppSaveIcon}>
                <Text style={st.ppSaveIconText}>%</Text>
              </View>
              <ThemedText style={st.ppSaveText}>
                <ThemedText style={st.ppSaveAmount}>
                  ₹{totalSaved} off{" "}
                </ThemedText>
                applied for you
              </ThemedText>
            </View>
          )}

          {!priceOnRequest && taxInfo.rate > 0 && (
            <View style={st.gstBox}>
              <ThemedText style={st.gstText}>
                {gstInclusive ? "Incl." : "+"} GST {taxInfo.rate}%: ₹{taxInfo.gst}
              </ThemedText>
              <ThemedText style={st.gstTotal}>
                Total payable: ₹{taxInfo.total}
              </ThemedText>
            </View>
          )}

          {priceOnRequest && (
            <View style={st.codOnlyBox}>
              <Ionicons name="cash-outline" size={17} color="#B26A00" />
              <ThemedText style={st.codOnlyText}>
                You can pay for this only after the store confirms the price. COD & Online pyament available.
              </ThemedText>
            </View>
          )}

          {/* ─── Additional benefits ─── */}
          <Pressable
            style={st.bnHeader}
            onPress={() => setBenefitsOpen((v) => !v)}
          >
            <ThemedText style={st.bnTitle}>
              Additional benefits on this purchase
            </ThemedText>
            <Ionicons
              name={benefitsOpen ? "chevron-up" : "chevron-down"}
              size={20}
              color={ink}
            />
          </Pressable>
          {benefitsOpen && (
            <View style={st.bnBody}>
              <View style={st.bnRow}>
                <Ionicons name="cash-outline" size={17} color="#22A45D" />
                <ThemedText style={st.bnText}>
                  Cash on Delivery available
                </ThemedText>
              </View>
              {hasOffer && (
                <View style={st.bnRow}>
                  <Ionicons name="pricetag-outline" size={17} color="#22A45D" />
                  <ThemedText style={st.bnText}>
                    You save ₹{totalSaved} ({offerPercent}%) on this order
                  </ThemedText>
                </View>
              )}
              {hasTiers && (
                <View style={st.bnRow}>
                  <Ionicons name="layers-outline" size={17} color="#22A45D" />
                  <ThemedText style={st.bnText}>
                    Buy {priceTiers[priceTiers.length - 1].minQty}+ {unitLabel}{" "}
                    at ₹{priceTiers[priceTiers.length - 1].price} each
                  </ThemedText>
                </View>
              )}
              {!!activeStore?.phone && (
                <View style={st.bnRow}>
                  <Ionicons name="logo-whatsapp" size={17} color="#22A45D" />
                  <ThemedText style={st.bnText}>
                    Chat with the store on WhatsApp
                  </ThemedText>
                </View>
              )}
            </View>
          )}

          {/* ─── Delivery details (compact) ─── */}
          <View style={st.dlSection}>
            <Pressable
              style={st.dlHeader}
              onPress={() => setDeliveryExpanded((v) => !v)}
            >
              <ThemedText style={st.dlTitle}>Delivery details</ThemedText>
              <View style={st.dlChevronBtn}>
                <Ionicons
                  name={deliveryExpanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={ink}
                />
              </View>
            </Pressable>

            {deliveryExpanded && (
              <View style={st.dlCard}>
                <Pressable
                  style={st.dlRow}
                  onPress={() => router.push("/profile")}
                >
                  <View style={st.dlIconBox}>
                    <Ionicons name="home-outline" size={14} color={ink} />
                  </View>
                  <View style={st.dlTextWrap}>
                    {!!hasSavedAddress && (
                      <ThemedText style={st.dlBadge}>HOME </ThemedText>
                    )}
                    <ThemedText style={st.dlText} numberOfLines={1}>
                      {addressPreview}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={muted} />
                </Pressable>

                <View style={st.dlDivider} />

                <View style={st.dlRow}>
                  <View style={st.dlIconBox}>
                    <Ionicons name="car-outline" size={14} color={ink} />
                  </View>
                  <ThemedText style={st.dlText}>
                    Delivery by{" "}
                    <ThemedText style={[st.dlText, st.dlBold]}>
                      {deliveryDateText(liveDelivery, product.deliveryTime)}
                    </ThemedText>
                  </ThemedText>
                </View>

                {!!shippingChargeText(liveDelivery) && (
                  <>
                    <View style={st.dlDivider} />
                    <View style={st.dlRow}>
                      <View style={st.dlIconBox}>
                        <Ionicons name="pricetag-outline" size={14} color={ink} />
                      </View>
                      <ThemedText style={st.dlText} numberOfLines={2}>
                        {shippingChargeText(liveDelivery)}
                        {liveDelivery?.shippingNote
                          ? ` · ${liveDelivery.shippingNote}`
                          : ""}
                      </ThemedText>
                    </View>
                  </>
                )}

                {!!activeStore?.name && (
                  <>
                    <View style={st.dlDivider} />
                    <View style={st.dlRow}>
                      <View style={st.dlIconBox}>
                        <Ionicons
                          name="storefront-outline"
                          size={14}
                          color={ink}
                        />
                      </View>
                      <ThemedText style={st.dlText} numberOfLines={1}>
                        Sold By{" "}
                        <ThemedText style={[st.dlText, st.dlBold]}>
                          {activeStore.name}
                        </ThemedText>
                      </ThemedText>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>

          {/* ─── Contact via WhatsApp ─── */}
          <Pressable
            style={st.contactRow}
            onPress={async () => {
              try {
                const rawNumber = (activeStore?.phone ?? "").replace(
                  /[^\d]/g,
                  "",
                );
                if (!rawNumber) {
                  Alert.alert(
                    "WhatsApp not available",
                    "This store hasn't added a WhatsApp number yet.",
                  );
                  return;
                }
                const phoneNumber =
                  rawNumber.length === 10
                    ? `91${rawNumber}`
                    : rawNumber.replace(/[^\d]/g, "");
                const productLink = `https://store-product-frontend.example.com/product/${product._id}`;
                const imageUrl = productImages[0] ?? "";
                const message = `Hello, I am interested in purchasing the following product:\n\n*${product.title}*\nCode: ${product.productCode || "N/A"}\nPrice: ₹${currentPrice}\n${imageUrl ? `Image: ${imageUrl}\n` : ""}Product Link: ${productLink}\n\nPlease let me know the next steps.`;
                const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
                await Linking.openURL(url);
              } catch (err) {
                console.warn("Failed to open WhatsApp", err);
              }
            }}
          >
            <View style={st.contactRowLeft}>
              <View style={st.contactIconCircle}>
                <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
              </View>
              <View>
                <ThemedText style={st.contactLabel}>
                  Have a question?
                </ThemedText>
                <ThemedText style={st.contactSublabel}>
                  Chat with us on WhatsApp
                </ThemedText>
              </View>
            </View>
            <SymbolView
              name={{
                ios: "chevron.right",
                android: "chevron_right",
                web: "chevron_right",
              }}
              size={16}
              tintColor={muted}
            />
          </Pressable>

          {similar.length > 0 && (
            <View style={st.similarScrollSection}>
              <View style={st.similarScrollHeader}>
                <ThemedText style={st.similarScrollTitle}>
                  Similar Products
                </ThemedText>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/products",
                      params: {
                        mode: "similar",
                        categoryId: getCategoryKey(product),
                        categoryName: "Similar Products",
                        excludeId: product._id,
                      },
                    })
                  }
                >
                  <ThemedText style={st.seeAllText}>See all</ThemedText>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={st.similarScrollRow}
              >
                {similar.map((entry) => {
                  const discount = getSimilarDiscount(entry);
                  return (
                    <Pressable
                      key={entry._id}
                      onPress={() =>
                        router.push({
                          pathname: "/product/[id]",
                          params: { id: entry._id },
                        })
                      }
                      style={st.similarScrollCard}
                    >
                      <View style={st.similarScrollImageWrap}>
                        <Image
                          source={{ uri: apiImageUrl(entry.image) }}
                          style={st.similarScrollImage}
                          contentFit="cover"
                        />
                        <View style={st.similarScrollRatingBadge}>
                          <ThemedText style={st.similarScrollRatingText}>
                            {(entry.rating ?? 3.8).toFixed(1)}
                          </ThemedText>
                          <Text style={st.similarScrollRatingStar}>★</Text>
                        </View>
                      </View>

                      <ThemedText
                        style={st.similarScrollName}
                        numberOfLines={1}
                      >
                        {entry.title}
                      </ThemedText>

                      {discount !== null && (
                        <ThemedText style={st.similarScrollDiscount}>
                          {discount}% OFF
                        </ThemedText>
                      )}

                      <View style={st.similarScrollPriceRow}>
                        {typeof entry.originalPrice === "number" &&
                          entry.originalPrice > entry.price && (
                            <ThemedText style={st.similarScrollOriginalPrice}>
                              ₹{entry.originalPrice}
                            </ThemedText>
                          )}
                        <ThemedText style={st.similarScrollPrice}>
                          {entry.price > 0
                            ? `₹${entry.price}`
                            : "Order to know Price"}
                        </ThemedText>
                      </View>

                      <ThemedText style={st.similarScrollDeliveryText}>
                        Get it by{" "}
                        <ThemedText style={st.similarScrollDeliveryDate}>
                          {deliveryDateText(entry.delivery, entry.deliveryTime)}
                        </ThemedText>
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ─── Product Details Table ─── */}
          <View style={st.detailsSection}>
            <Pressable
              style={st.detailsHeader}
              onPress={() => setDetailsExpanded((v) => !v)}
            >
              <ThemedText style={st.detailsSectionTitle}>
                Product Details
              </ThemedText>
              <View style={st.detailsChevronBtn}>
                <SymbolView
                  name={{
                    ios: detailsExpanded ? "chevron.up" : "chevron.down",
                    android: detailsExpanded ? "expand_less" : "expand_more",
                    web: detailsExpanded ? "expand_less" : "expand_more",
                  }}
                  size={16}
                  tintColor={ink}
                />
              </View>
            </Pressable>

            {detailsExpanded && (
              <View style={st.detailsBody}>
                {[
                  { label: "Brand", value: product.brandId || "—" },
                  { label: "Size", value: currentSize },
                  {
                    label: "Weight",
                    value:
                      currentWeight !== "N/A" ? String(currentWeight) : "—",
                  },
                  { label: "Category", value: categoryLabel },
                  {
                    label: "Delivery",
                    value: deliveryDateText(liveDelivery, product.deliveryTime),
                  },
                  {
                    label: "Stock",
                    value:
                      currentStock !== undefined
                        ? currentStock > 0
                          ? `${currentStock} available`
                          : "Out of stock"
                        : "In stock",
                  },
                  ...(product.productCode
                    ? [{ label: "Product Code", value: product.productCode }]
                    : []),
                ].map((row, idx, arr) => (
                  <View
                    key={row.label}
                    style={[
                      st.detailRow,
                      idx === arr.length - 1 && st.detailRowLast,
                    ]}
                  >
                    <ThemedText style={st.detailLabel}>{row.label}</ThemedText>
                    <ThemedText style={st.detailValue} numberOfLines={1}>
                      {row.value}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ─── Coupon Banner ─── */}
          {/* {!!product.productCode && (
            <View style={st.couponBanner}>
              <View style={st.couponLeft}>
                <ThemedText style={st.couponLabel}>COUPON CODE</ThemedText>
                <ThemedText style={st.couponCode}>{product.productCode}</ThemedText>
              </View>
              <Pressable
                style={st.couponCopyBtn}
                onPress={() => {
                  Clipboard.setString(product.productCode!);
                  Alert.alert("Copied", "Coupon code copied to clipboard");
                }}
              >
                <Text style={st.couponCopyText}>COPY</Text>
              </Pressable>
            </View>
          )} */}

          {/* ─── Reviews Section ─── */}
          <View style={st.reviewsSection}>
            <View style={st.reviewsSectionHeader}>
              <ThemedText style={st.reviewsSectionTitle}>Reviews</ThemedText>
              {ratingStats.total > 0 && (
                <View style={st.reviewsBadge}>
                  <Text style={st.reviewsBadgeStar}>★</Text>
                  <ThemedText style={st.reviewsBadgeText}>
                    {ratingStats.average.toFixed(1)} ({ratingStats.total})
                  </ThemedText>
                </View>
              )}
            </View>
            {reviews.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={st.reviewList}
              >
                {reviews.map((review) => (
                  <View key={review.id} style={st.reviewCard}>
                    <View style={st.reviewCardHeader}>
                      <View style={st.reviewAvatarCircle}>
                        <ThemedText style={st.reviewAvatarText}>
                          {review.author.charAt(0).toUpperCase()}
                        </ThemedText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={st.reviewAuthorName}>
                          {review.author}
                        </ThemedText>
                        {review.date ? (
                          <ThemedText style={st.reviewDate}>
                            {review.date}
                          </ThemedText>
                        ) : null}
                      </View>
                    </View>
                    <View style={st.reviewStarsRow}>
                      <StarRating rating={review.rating} size={12} />
                    </View>
                    <ThemedText style={st.reviewCommentText} numberOfLines={3}>
                      {review.comment || "Great product!"}
                    </ThemedText>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={st.noReviewsBox}>
                <ThemedText style={st.noReviewsText}>
                  No reviews yet. Be the first to review!
                </ThemedText>
              </View>
            )}
          </View>

          {/* ─── For You Rail ─── */}
          {recentProducts.length > 0 && (
            <View style={st.similarScrollSection}>
              <View style={st.similarScrollHeader}>
                <ThemedText style={st.similarScrollTitle}>
                  Recently Viewed
                </ThemedText>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/products",
                      params: {
                        mode: "recent",
                        categoryName: "Recently Viewed",
                      },
                    })
                  }
                >
                  <ThemedText style={st.seeAllText}>See all</ThemedText>
                </Pressable>
              </View>
              <ProductRail
                title=""
                products={recentProducts}
                showArrow={false}
              />{" "}
            </View>
          )}

          {/* ─── Similar Products ─── */}
          {similar.length > 0 && (
            <View style={st.similarSection}>
              <ThemedText style={st.similarHeading}>
                You may also like
              </ThemedText>
              <View style={st.similarGrid}>
                {similar.map((entry) => (
                  <Pressable
                    key={entry._id}
                    onPress={() =>
                      router.push({
                        pathname: "/product/[id]",
                        params: { id: entry._id },
                      })
                    }
                    style={st.similarGridCard}
                  >
                    <Image
                      source={{ uri: apiImageUrl(entry.image) }}
                      style={st.similarImage}
                      contentFit="cover"
                    />
                    <ThemedText numberOfLines={1} style={st.similarName}>
                      {entry.title}
                    </ThemedText>
                    <ThemedText style={st.similarPrice}>
                      {entry.price > 0
                        ? `₹${entry.price}`
                        : "Order to know Price"}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* ─── Bottom Action Bar ─── */}
      <Animated.View
        style={[
          st.bottomBar,
          {
            paddingBottom: Math.max(insets.bottom, 8) + 12,
            transform: [{ scale: cartBounce }],
          },
        ]}
      >
        <Pressable
          disabled={adding}
          onPress={addedToCart ? () => router.push("/cart") : addToCart}
          style={[st.addToCartBtn, addedToCart && st.goToCartBtn]}
        >
          <ThemedText
            style={[st.addToCartText, addedToCart && st.goToCartText]}
          >
            {adding ? "Adding..." : addedToCart ? "Go to Cart" : "Add to Cart"}
          </ThemedText>
        </Pressable>
        <Pressable
          disabled={adding}
          onPress={handleBuyNow}
          style={st.buyNowBtn}
        >
          <ThemedText style={st.buyNowText}>Order Now</ThemedText>
        </Pressable>
      </Animated.View>

      {showCartToast && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            st.toastOverlay,
            {
              opacity: cartToastAnim,
              transform: [
                {
                  translateY: cartToastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={st.toastCard}>
            <ThemedText style={st.toastText}>Item added to cart</ThemedText>
            <Pressable
              onPress={() => {
                setShowCartToast(false);
                router.push("/cart");
              }}
              style={st.toastButton}
            >
              <ThemedText style={st.toastButtonText}>Go to cart</ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      )}
      <ImageViewer
        images={viewerImages}
        startIndex={Math.max(0, viewerIndex ?? 0)}
        visible={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  /* ─── Layout ─── */
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContent: { paddingBottom: 110 },
  center: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  stateTitle: { color: ink, fontSize: 24, fontWeight: "800" },
  stateText: { color: muted, fontSize: 15, marginTop: 10 },
  backLink: {
    backgroundColor: ink,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  backLinkText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  /* ─── Top Bar ─── */
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    height: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarCenter: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 8,
  },
  topBarSearchText: {
    color: "#BBBBBB",
    fontSize: 13,
    fontWeight: "500",
  },

  /* ─── Image Gallery ─── */
  imageStage: {
    height: 380,
    backgroundColor: bgLight,
  },
  imageSlide: {
    width: screenWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  heroImage: {
    width: screenWidth,
    height: 380,
  },
  heroVideo: {
    width: screenWidth * 0.9,
    height: 300,
  },
  thumbVideo: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbPlay: {
    color: "#FFFFFF",
    fontSize: 18,
  },
  imageFallbackText: {
    color: muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },

  /* ─── Thumbnails ─── */
  thumbRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
  },
  thumbItem: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: bgLight,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbItemActive: {
    borderColor: accent,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },

  /* ─── Info Sheet ─── */
infoSheet: {
  paddingHorizontal: 24,
  paddingTop: 26,
  marginTop: -2,
  zIndex: 2,
  overflow: "hidden",
  backgroundColor: "transparent",
},
  sheetWhite: {
    position: "absolute",
    left: 0,
    right: 0,
    top: GLASS_H,
    bottom: 0,
    backgroundColor: "#FFFFFF",
  },
  glassZone: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: GLASS_H,
  },
  thumbPinned: { position: "absolute", top: 214, left: 0, right: 0, zIndex: 1 },

  /* Title */
  productTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: ink,
    letterSpacing: -0.2,
    lineHeight: 26,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  titleRowLeft: {
    flex: 1,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },

  /* Rating Row */
  ratingText: {
    fontSize: 13,
    fontWeight: "700",
    color: ink,
  },
  ratingDivider: {
    width: 1,
    height: 14,
    backgroundColor: "#E0E0E0",
    marginHorizontal: 4,
  },
  reviewCountText: {
    fontSize: 13,
    fontWeight: "500",
    color: muted,
  },
  titleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  wishlistBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#EEEEEE",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Price + Quantity */
  priceGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 24,
  },
  discountPercentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  discountArrow: {
    color: "#22A45D",
    fontSize: 18,
    fontWeight: "800",
  },
  discountPercentText: {
    color: "#22A45D",
    fontSize: 20,
    fontWeight: "800",
  },
  priceOriginal: {
    fontSize: 18,
    fontWeight: "700",
    color: "#B5B5B5",
    textDecorationLine: "line-through",
  },
  priceMain: {
    fontSize: 22,
    fontWeight: "800",
    color: ink,
  },
  couponAppliedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#E8F8EF",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  couponAppliedIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#22A45D",
    alignItems: "center",
    justifyContent: "center",
  },
  couponAppliedIconText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  couponAppliedText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1A1A1A",
  },
  couponAppliedAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1A1A1A",
  },

  /* ─── Size / Variants ─── */
  sizeSection: {
    marginTop: 4,
  },
  sizeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sizeSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: ink,
  },
  sizeGuideLink: {
    fontSize: 13,
    fontWeight: "600",
    color: accent,
  },
  variantRow: {
    flexDirection: "row",
    gap: 10,
  },
  variantChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
    backgroundColor: "#FFFFFF",
  },
  variantChipSelected: {
    borderColor: accent,
    backgroundColor: accent,
  },
  variantChipDisabled: { opacity: 0.4 },
  variantChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: ink,
  },
  variantChipTextSelected: {
    color: "#FFFFFF",
  },

  /* ─── Description ─── */
  descSection: {
    marginTop: 12,
    // backgroundColor: "#F3F8FC",
    // borderWidth: 1,
    // borderColor: "#DCEBF5",
    // borderRadius: 16,
    // padding: 14,
  },
  descTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: ink,
    marginBottom: 10,
  },
  descText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#777777",
    fontWeight: "400",
  },
  descReadMore: {
    fontSize: 13,
    fontWeight: "700",
    color: accent,
    marginTop: 6,
  },

  /* ─── Product Details Table ─── */
  detailsSection: {
    marginTop: 24,
    backgroundColor: "#F3F8FC",
    borderWidth: 1,
    borderColor: "#DCEBF5",
    borderRadius: 16,
    padding: 14,
  },
  detailsSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: ink,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: {
    color: muted,
    fontSize: 13,
    fontWeight: "600",
  },
  detailValue: {
    color: ink,
    fontSize: 13,
    fontWeight: "700",
    maxWidth: "55%",
    textAlign: "right",
  },

  /* ─── Coupon ─── */
  couponBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF5EE",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#FFD9BA",
    gap: 8,
    marginTop: 24,
  },
  couponLeft: { flex: 1 },
  couponLabel: {
    color: accent,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  couponCode: {
    color: ink,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 2,
  },
  couponCopyBtn: {
    backgroundColor: accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  couponCopyText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  /* ─── Reviews ─── */
  reviewsSection: {
    marginTop: 28,
  },
  reviewsSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  reviewsSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: ink,
  },
  reviewsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF8F0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  reviewsBadgeStar: {
    fontSize: 12,
    color: "#F5A623",
  },
  reviewsBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: ink,
  },
  reviewList: {
    flexDirection: "row",
    gap: 12,
    paddingRight: 24,
  },
  reviewCard: {
    width: 240,
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  reviewCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  reviewAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: accent,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  reviewAuthorName: {
    color: ink,
    fontSize: 13,
    fontWeight: "700",
  },
  reviewDate: {
    color: muted,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  reviewStarsRow: {
    marginBottom: 6,
  },
  reviewCommentText: {
    color: "#666666",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "400",
  },
  noReviewsBox: {
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  noReviewsText: {
    color: muted,
    fontSize: 13,
    fontWeight: "600",
  },

  /* ─── Contact ─── */
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9F9F9",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  contactRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  contactIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#25D366",
    alignItems: "center",
    justifyContent: "center",
  },
  contactLabel: {
    color: ink,
    fontSize: 14,
    fontWeight: "700",
  },
  contactSublabel: {
    color: muted,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },

  /* ─── Similar ─── */
  similarSection: {
    marginTop: 28,
  },
  similarHeading: {
    color: ink,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 14,
  },
  similarRow: {
    flexDirection: "row",
    gap: 14,
  },
  similarCard: { flex: 1 },
  similarImage: {
    width: "100%",
    aspectRatio: 0.86,
    borderRadius: 0, // ← changed from 16
    backgroundColor: bgLight,
  },
  similarName: {
    color: ink,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
  },
  similarPrice: {
    color: ink,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3,
  },

  /* ─── Bottom Bar ─── */
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    flexDirection: "row",
    gap: 12,
  },
  toastOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 86,
    paddingHorizontal: 16,
    zIndex: 30,
  },
  toastCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  toastText: {
    flex: 1,
    marginRight: 12,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  toastButton: {
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  toastButtonText: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  addToCartBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: ink,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  goToCartBtn: { backgroundColor: ink },
  goToCartText: { color: "#FFFFFF" },
  addToCartText: {
    color: ink,
    fontSize: 14,
    fontWeight: "700",
  },
  buyNowBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: accent,
    alignItems: "center",
    justifyContent: "center",
  },
  buyNowText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  dealBadge: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 22,
  },
  dealBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  ppRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  ppPercentRow: { flexDirection: "row", alignItems: "center" },
  ppPercent: { color: "#22A45D", fontSize: 24, fontWeight: "800" },
  ppOriginal: {
    color: "#8A8A8A",
    fontSize: 20,
    fontWeight: "600",
    textDecorationLine: "line-through",
  },
  ppPrice: { color: ink, fontSize: 28, fontWeight: "800" },
  ppContact: { color: accent, fontSize: 22, fontWeight: "800" },
  codOnlyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF4DC",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 14,
  },
  codOnlyText: {
    flex: 1,
    color: ink,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
  },
  ppTotal: { color: muted, fontSize: 14, fontWeight: "600" },
  gstBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F3F8FC",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
  },
  gstText: { fontSize: 13, fontWeight: "600", color: muted },
  gstTotal: { fontSize: 14, fontWeight: "800", color: ink },
  ppSave: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#E6F8EE",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 14,
  },
  ppSaveIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#22A45D",
    alignItems: "center",
    justifyContent: "center",
  },
  ppSaveIconText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  ppSaveText: { fontSize: 14, color: ink },
  ppSaveAmount: { fontWeight: "800", color: ink },

  bnHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F5F5F5",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 14,
  },
  bnTitle: {
    flex: 1,
    color: ink,
    fontSize: 14,
    fontWeight: "700",
    marginRight: 8,
  },
  bnBody: {
    backgroundColor: "#F5F5F5",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 6,
    gap: 10,
  },
  bnRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  bnText: { flex: 1, color: ink, fontSize: 13, fontWeight: "500" },

  dlSection: { marginTop: 18 },
  dlHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dlTitle: { fontSize: 15, fontWeight: "800", color: ink },
  dlChevronBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  dlCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E4E4E4",
    borderRadius: 14,
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
  },
  dlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  dlIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  dlTextWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  dlBadge: { fontSize: 12, fontWeight: "800", color: ink },
  dlText: { flex: 1, fontSize: 12, fontWeight: "500", color: ink },
  dlBold: { fontWeight: "600", color: "#1B7F4B" },
  dlDivider: { height: 1, backgroundColor: "#EFEFEF" },
  deliverySection: {
    marginTop: 24,
    backgroundColor: "#F3F8FC",
    borderWidth: 1,
    borderColor: "#DCEBF5",
    borderRadius: 16,
    padding: 14,
  },
  deliveryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deliveryTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: ink,
  },
  deliveryChevronBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  deliveryCard: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#C9E0EE",
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
  },
  deliveryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  deliveryIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  deliveryRowTextWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  deliveryRowBadge: {
    fontSize: 13,
    fontWeight: "800",
    color: ink,
  },
  deliveryRowText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "500",
    color: ink,
  },
  deliveryRowTextBold: {
    fontWeight: "800",
  },
  deliveryDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
  },

  colorSection: {
    marginTop: 0,
    marginBottom: 8,
  },
  colorSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: muted,
    marginBottom: 10,
  },
  colorSectionValue: {
    fontSize: 14,
    fontWeight: "800",
    color: ink,
  },
  colorRow: {
    flexDirection: "row",
    gap: 12,
  },
  colorSwatchOuter: {
    width: 84,
    height: 84,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#EEEEEE",
    overflow: "hidden",
    backgroundColor: bgLight,
  },
  colorSwatchOuterSelected: {
    borderColor: ink,
    borderWidth: 3,
  },
  colorSwatch: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E5E5E5",
  },
  colorSwatchImage: {
    width: "100%",
    height: "100%",
  },

  similarScrollSection: {
    marginTop: 28,
  },
  similarScrollHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  similarScrollTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: ink,
  },
  similarScrollArrowBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ink,
    alignItems: "center",
    justifyContent: "center",
  },
  similarScrollRow: {
    flexDirection: "row",
    gap: 16,
    paddingRight: 24,
  },
  similarScrollCard: {
    width: 160,
  },
  similarScrollRatingBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FFFFFF",
    borderRadius: 0, // ← changed from 8, optional — badge pill shape
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  similarScrollImage: {
    width: "100%",
    height: 170,
  },

  similarScrollRatingText: {
    fontSize: 13,
    fontWeight: "800",
    color: ink,
  },
  similarScrollRatingStar: {
    fontSize: 12,
    color: "#22A45D",
  },
  similarScrollName: {
    fontSize: 14,
    fontWeight: "700",
    color: ink,
    marginTop: 10,
  },
  similarScrollDiscount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#22A45D",
    marginTop: 4,
  },
  similarScrollPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  similarScrollOriginalPrice: {
    fontSize: 12,
    fontWeight: "600",
    color: muted,
    textDecorationLine: "line-through",
  },
  similarScrollPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: ink,
  },
  similarScrollDeliveryText: {
    fontSize: 12,
    fontWeight: "500",
    color: muted,
    marginTop: 4,
  },
  similarScrollDeliveryDate: {
    fontWeight: "800",
    color: ink,
  },
  detailsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detailsChevronBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  detailsBody: {
    marginTop: 6,
  },
  similarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 20,
  },
  similarGridCard: {
    width: "48%",
  },
  similarScrollImageWrap: {
    position: "relative",
    borderRadius: 0,
    overflow: "hidden",
    backgroundColor: bgLight,
  },
  priceQuantityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  seeAllText: { fontSize: 14, fontWeight: "700", color: accent },
  tierChip: { alignItems: "center", minWidth: 96 },
  tierQty: { fontSize: 12, fontWeight: "600", color: muted },
  tierPrice: { fontSize: 15, fontWeight: "800", color: ink, marginTop: 2 },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  qtyLabel: { fontSize: 14, fontWeight: "600", color: muted },
  qtyBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
    borderRadius: 12,
  },
  qtyBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { fontSize: 20, fontWeight: "700", color: ink },
  qtyBtnDisabled: { opacity: 0.3 },
  qtyValue: {
    minWidth: 34,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
    color: ink,
  },
  priceTotal: { fontSize: 14, fontWeight: "600", color: muted },
  qtyInput: {
    minWidth: 56,
    height: 38,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
    color: ink,
    paddingVertical: 0,
  },
});
