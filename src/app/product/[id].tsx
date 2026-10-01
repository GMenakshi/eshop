import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { VideoView, useVideoPlayer } from "expo-video";
import { ProductRail } from "@/components/product-rail";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Clipboard,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import {
  api,
  apiImageUrl,
  API_BASE_URL,
  type ApiProduct,
  type ApiVariant,
} from "@/lib/api";
import { goBackOrHome } from "@/lib/navigation";
import { useStore } from "@/lib/store-context";
import { addRecentlyViewed, getRecentlyViewedIds } from "@/lib/recently-viewed";

const ink = "#1A1A1A";
const muted = "#999999";
const accent = "#E8634A";
const bgLight = "#F8F6F3";
const screenWidth = Dimensions.get("window").width;

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
  if (typeof original === "number" && original > price) {
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
  const { addItem } = useCart();
  const { storeId, activeStore } = useStore();
  const { toggle, isSaved } = useWishlist();
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [similar, setSimilar] = useState<ApiProduct[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [cartBounce] = useState(() => new Animated.Value(1));
  const [scrollX] = useState(() => new Animated.Value(0));
  const [reviews, setReviews] = useState<ReviewView[]>([]);
  const [ratingStats, setRatingStats] = useState({ average: 0, total: 0 });
  const [forYou, setForYou] = useState<ApiProduct[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const galleryRef = useRef<ScrollView>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
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

  useEffect(() => {
    if (!id || !storeId) return;
    let active = true;
    api
      .product(storeId, id)
      .then(async (response) => {
        let selected = response.product ?? response.data;
        let allProducts: ApiProduct[] = [];
        if (!selected) {
          const list = await api.products(storeId);
          allProducts = list.products;
          selected = allProducts.find((entry) => entry._id === id);
        }
        if (!allProducts.length)
          allProducts = (await api.products(storeId)).products;
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
  }, [id, storeId]);

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    api
      .allProducts(storeId)
      .then((catalog) => {
        if (active) setForYou(catalog);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [storeId]);

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
  }, [id, storeId]);

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

  const currentPrice = selectedVariant?.offerPrice ?? product?.price ?? 0;
  const currentOriginalPrice = selectedVariant?.mrp ?? product?.originalPrice;
  const currentSize = selectedVariant?.size || product?.size || "One Size";
  const currentWeight = selectedVariant?.weight || product?.weight || "N/A";
  const currentStock = selectedVariant?.currentStock;
  const hasDiscount =
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
    const imageUrl = (apiImageUrl(productImages[0] ?? product.image) ?? "").replace(
      / /g,
      "%20",
    );
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
      currentWeight && currentWeight !== "N/A" ? `Weight: ${currentWeight}` : "",
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
    setAdding(true);
    try {
      const variantId = selectedVariant?._id ?? product.variantId;
      const productToAdd = {
        ...product,
        variantId,
        color: selectedColorVariant?.color,
        colorVariantId: selectedColorVariant?._id,
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
      Alert.alert("Added to cart", "Your product is ready in the cart.");
    } catch (error) {
      Alert.alert(
        "Could not add product",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;
    if (!token) {
      router.push("/sign-in");
      return;
    }
    setAdding(true);
    try {
      const variantId = selectedVariant?._id ?? product.variantId;
      const productToAdd = {
        ...product,
        variantId,
        price: currentPrice,
        originalPrice: currentOriginalPrice,
        size: currentSize,
        weight: currentWeight,
      };
      await addItem(productToAdd, quantity);
      router.push("/checkout");
    } catch (error) {
      Alert.alert(
        "Could not add product",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setAdding(false);
    }
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

  return (
    <SafeAreaView style={st.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          st.scrollContent,
          { paddingBottom: 110 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Top Bar ─── */}
        <View style={st.topBar}>
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
          <View style={st.topBarCenter}>
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
          </View>
          <Pressable
            accessibilityLabel="Share product"
            style={st.topBarBtn}
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
        </View>

        {/* ─── Product Image Gallery ─── */}
        <View style={st.imageStage}>
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
                    <Image
                      source={{ uri: apiImageUrl(item.uri) }}
                      style={st.heroImage}
                      contentFit="contain"
                    />
                  )}
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={st.imageSlide}>
              <ThemedText style={st.imageFallbackText}>NO IMAGE</ThemedText>
            </View>
          )}
        </View>

        {/* ─── Image Thumbnails / Dots ─── */}
        {mediaItems.length > 1 && (
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
        )}

        {/* ─── Product Info Sheet ─── */}
        <View style={st.infoSheet}>
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

          {/* Price + Quantity Row */}
          <View style={st.priceQuantityRow}>
            <View style={st.priceGroup}>
              {hasDiscount && (
                <ThemedText style={st.priceOriginal}>
                  ₹{currentOriginalPrice}
                </ThemedText>
              )}
              <ThemedText style={st.priceMain}>₹{currentPrice}</ThemedText>
            </View>
            {/* <View style={st.quantitySelector}>
    <Pressable
      style={st.qtyBtn}
      onPress={() => setQuantity((q) => Math.max(1, q - 1))}
      accessibilityLabel="Decrease quantity"
    >
      <ThemedText style={st.qtyBtnText}>−</ThemedText>
    </Pressable>
    <ThemedText style={st.qtyValue}>{quantity}</ThemedText>
    <Pressable
      style={st.qtyBtn}
      onPress={() => setQuantity((q) => q + 1)}
      accessibilityLabel="Increase quantity"
    >
      <ThemedText style={st.qtyBtnText}>+</ThemedText>
    </Pressable>
  </View> */}
          </View>

          {hasDiscount && (
            <View style={st.couponAppliedBanner}>
              <View style={st.couponAppliedIcon}>
                <Text style={st.couponAppliedIconText}>%</Text>
              </View>
              <ThemedText style={st.couponAppliedText}>
                <ThemedText style={st.couponAppliedAmount}>
                  ₹{currentOriginalPrice - currentPrice} off{" "}
                </ThemedText>
                applied for you
              </ThemedText>
            </View>
          )}

          <View style={st.deliverySection}>
            <Pressable
              style={st.deliveryHeader}
              onPress={() => setDeliveryExpanded((v) => !v)}
            >
              <ThemedText style={st.deliveryTitle}>Delivery details</ThemedText>
              <View style={st.deliveryChevronBtn}>
                <SymbolView
                  name={{
                    ios: deliveryExpanded ? "chevron.up" : "chevron.down",
                    android: deliveryExpanded ? "expand_less" : "expand_more",
                    web: deliveryExpanded ? "expand_less" : "expand_more",
                  }}
                  size={16}
                  tintColor={ink}
                />
              </View>
            </Pressable>

            {deliveryExpanded && (
              <View style={st.deliveryCard}>
                <Pressable
                  style={st.deliveryRow}
                  onPress={() => router.push("/profile")}
                >
                  <View style={st.deliveryIconBox}>
                    <SymbolView
                      name={{ ios: "house.fill", android: "home", web: "home" }}
                      size={16}
                      tintColor={ink}
                    />
                  </View>
                  <View style={st.deliveryRowTextWrap}>
                    {!!hasSavedAddress && (
                      <ThemedText style={st.deliveryRowBadge}>HOME </ThemedText>
                    )}
                    <ThemedText style={st.deliveryRowText} numberOfLines={1}>
                      {addressPreview}
                    </ThemedText>
                  </View>
                  <SymbolView
                    name={{
                      ios: "chevron.right",
                      android: "chevron_right",
                      web: "chevron_right",
                    }}
                    size={14}
                    tintColor={muted}
                  />
                </Pressable>

                <View style={st.deliveryDivider} />

                <View style={st.deliveryRow}>
                  <View style={st.deliveryIconBox}>
                    <SymbolView
                      name={{
                        ios: "shippingbox.fill",
                        android: "local_shipping",
                        web: "local_shipping",
                      }}
                      size={16}
                      tintColor={ink}
                    />
                  </View>
                  <ThemedText style={st.deliveryRowText}>
                    Delivery by{" "}
                    <ThemedText style={st.deliveryRowTextBold}>
                      {product.deliveryTime || "Same day"}
                    </ThemedText>
                  </ThemedText>
                </View>

                <View style={st.deliveryDivider} />

                {/* <View style={st.deliveryRow}>
        <View style={st.deliveryIconBox}>
          <SymbolView
            name={{ ios: "storefront.fill", android: "storefront", web: "storefront" }}
            size={16}
            tintColor={ink}
          />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={st.deliveryRowText}>
            Sold By {product.brandId || categoryLabel}
          </ThemedText>
        </View>
      </View> */}
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
                          ₹{entry.price}
                        </ThemedText>
                      </View>

                      <ThemedText style={st.similarScrollDeliveryText}>
                        Get it by{" "}
                        <ThemedText style={st.similarScrollDeliveryDate}>
                          {entry.deliveryTime || "Same day"}
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
                    value: product.deliveryTime || "Same day",
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
                      ₹{entry.price}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

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
          onPress={addToCart}
          style={st.addToCartBtn}
        >
          <ThemedText style={st.addToCartText}>
            {adding ? "Adding..." : "Add to Cart"}
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
    height: 320,
    backgroundColor: bgLight,
  },
  imageSlide: {
    width: screenWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  heroImage: {
    width: screenWidth * 0.7,
    height: 300,
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
    paddingTop: 20,
    backgroundColor: "#FFFFFF",
  },

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
    marginTop: 24,
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
    paddingVertical: 14,
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
    marginBottom: 20,
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
});
