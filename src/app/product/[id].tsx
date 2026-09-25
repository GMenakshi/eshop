import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { ProductRail } from "@/components/product-rail";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Clipboard,
  Dimensions,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import { api, apiImageUrl, type ApiProduct, type ApiVariant } from "@/lib/api";
import { goBackOrHome } from "@/lib/navigation";
import { useStore } from "@/lib/store-context";

const ink = "#17211D";
const muted = "#748078";
const border = "#D7E0D6";
const CARD_WIDTH = Dimensions.get("window").width - 64;
const ITEM_WIDTH = 320 + 12;
const DOT_SIZE = 8;
const WORM_WIDTH = 20;
const DOT_GAP = 6;

const cleanDescription = (description?: string) =>
  description?.replace(/<[^>]+>/g, "").trim() ||
  "A considered everyday essential with a clean finish and dependable performance.";

type SampleReview = {
  id: string;
  rating: number;
  comment: string;
  author: string;
  date: string;
};

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;

type ReviewView = SampleReview & { images: string[] };

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

function renderStars(rating: number) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  const stars = [];
  for (let i = 0; i < fullStars; i++) {
    stars.push(
      <SymbolView
        key={`full-${i}`}
        name={{ ios: "star.fill", android: "star", web: "star" }}
        size={13}
        tintColor="#FFD700"
      />,
    );
  }
  if (hasHalf) {
    stars.push(
      <SymbolView
        key="half"
        name={{
          ios: "star.leadinghalf.fill",
          android: "star_half",
          web: "star_half",
        }}
        size={13}
        tintColor="#FFD700"
      />,
    );
  }
  for (let i = 0; i < emptyStars; i++) {
    stars.push(
      <SymbolView
        key={`empty-${i}`}
        name={{ ios: "star", android: "star_border", web: "star_border" }}
        size={13}
        tintColor="#C8D2C7"
      />,
    );
  }
  return stars;
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
    else if (s === "EXTRA LARGE" || s === "XLARGE" || s === "XL") sizeShort = "XL";
    else if (s === "XXLARGE" || s === "XXL") sizeShort = "XXL";
    else sizeShort = size;
  }

  if (sizeShort && weight) {
    return `${sizeShort} (${weight})`;
  }
  if (sizeShort) return sizeShort;
  if (weight) return weight;
  return "One Size";
};

export default function ProductViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const { addItem } = useCart();
  const { storeId } = useStore();
  const { toggle, isSaved } = useWishlist();
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);
  const [similar, setSimilar] = useState<ApiProduct[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [cartBounce] = useState(() => new Animated.Value(1));
   const [searchQuery, setSearchQuery] = useState("");
   const [detailsOpen, setDetailsOpen] = useState(true);
   const [showReviewsModal, setShowReviewsModal] = useState(false);
const [scrollX] = useState(() => new Animated.Value(0));
const [reviews, setReviews] = useState<ReviewView[]>([]);
const [ratingStats, setRatingStats] = useState({ average: 0, total: 0 });
  const [forYou, setForYou] = useState<ApiProduct[]>([]);

  const productImages =
    product?.images && product.images.length > 0
      ? product.images
      : product?.image
        ? [product.image]
        : [];

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
          setSimilar(
            allProducts.filter((entry) => entry._id !== id).slice(0, 2),
          );
        }
      })
      .catch(async () => {
        try {
          const list = await api.products(storeId);
          if (active) {
            const selected = list.products.find((entry) => entry._id === id) ?? null;
            setProduct(selected);
            setSelectedVariantIndex(0);
            setSimilar(
              list.products.filter((entry) => entry._id !== id).slice(0, 2),
            );
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
    fetch(`${API_BASE}/product/${id}/reviews`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((payload) => {
        if (!active) return;
        const data = payload as { averageRating?: number; totalReviews?: number };
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

  const variants = product?.variants ?? [];
  const selectedVariant = variants[selectedVariantIndex];

  const currentPrice = selectedVariant?.offerPrice ?? product?.price ?? 0;
  const currentOriginalPrice = selectedVariant?.mrp ?? product?.originalPrice;
  const currentSize = selectedVariant?.size || product?.size || "One Size";
  const currentWeight = selectedVariant?.weight || product?.weight || "N/A";
  const currentStock = selectedVariant?.stock;
  const hasDiscount =
    typeof currentOriginalPrice === "number" &&
    currentOriginalPrice > currentPrice;
  const reviewImages = reviews.flatMap((r) => r.images);
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
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={ink} size="large" />
        <ThemedText style={styles.stateText}>Loading product...</ThemedText>
      </SafeAreaView>
    );
  if (!product)
    return (
      <SafeAreaView style={styles.center}>
        <ThemedText style={styles.stateTitle}>Product unavailable</ThemedText>
        <ThemedText style={styles.stateText}>
          This product could not be loaded.
        </ThemedText>
        <Pressable onPress={goBackOrHome} style={styles.backLink}>
          <ThemedText style={styles.backLinkText}>GO BACK</ThemedText>
        </Pressable>
      </SafeAreaView>
    );

  const categoryLabel =
    product.categoryName || product.categoryId || "Collection";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Go back"
            onPress={goBackOrHome}
            style={styles.backButton}
          >
            <ThemedText style={styles.backText}>‹</ThemedText>
          </Pressable>
          <View style={styles.searchBox}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search products"
              placeholderTextColor="#829087"
              style={styles.searchInput}
            />
          </View>
          <Pressable
            accessibilityLabel="Open wishlist"
            style={styles.wishlistButton}
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

         {productImages.length > 0 ? (
           <>
             <ScrollView
               horizontal
               pagingEnabled
               showsHorizontalScrollIndicator={false}
               contentContainerStyle={styles.galleryRow}
               onScroll={Animated.event(
                 [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                 { useNativeDriver: false },
               )}
               scrollEventThrottle={16}
             >
               {productImages.map((image, index) => (
                 <Image
                   key={`${image}-${index}`}
                   source={{ uri: apiImageUrl(image) }}
                   style={styles.heroImage}
                   contentFit="cover"
                 />
               ))}
              </ScrollView>
              {productImages.length > 1 ? (
                <View style={styles.paginationContainer}>
                  <Animated.View
                    style={[
                      styles.paginationWorm,
                      {
                        left: scrollX.interpolate({
                          inputRange: productImages.map(
                            (_, i) => i * ITEM_WIDTH,
                          ),
                          outputRange: productImages.map(
                            (_, i) =>
                              i * (DOT_SIZE + DOT_GAP) +
                              (DOT_SIZE - WORM_WIDTH) / 2,
                          ),
                          extrapolate: "clamp",
                        }),
                      },
                    ]}
                  />
                  {productImages.map((_, i) => {
                    const inputRange = [
                      (i - 1) * ITEM_WIDTH,
                      i * ITEM_WIDTH,
                      (i + 1) * ITEM_WIDTH,
                    ];
                    const opacity = scrollX.interpolate({
                      inputRange,
                      outputRange: [0.4, 1, 0.4],
                      extrapolate: "clamp",
                    });
                    return (
                      <Animated.View
                        key={`dot-${i}`}
                        style={[styles.paginationDot, { opacity }]}
                      />
                    );
                  })}
                </View>
              ) : null}
            </>
         ) : (
          <View style={styles.imageFallback}>
            <ThemedText style={styles.imageFallbackText}>NO IMAGE</ThemedText>
          </View>
        )}
        <View style={styles.divider} />
        
        <View style={styles.details}>
          <ThemedText style={styles.eyebrow}>
            ESHOP · {categoryLabel}
          </ThemedText>
          <View style={styles.titleRow}>
            <ThemedText style={styles.title}>{product.title}</ThemedText>
            <View style={styles.titleButtons}>
              <Pressable
                accessibilityLabel="Toggle wishlist"
                style={styles.titleIconButton}
                onPress={() => {
                  if (!product) return;
                  toggle({
                    id: product._id,
                    name: product.title || "",
                    brand: product.brandId || "",
                    price: product.price,
                    category: product.categoryName || product.categoryId || "",
                    image: product.image || "",
                    description: product.description || "",
                    unit: product.unit,
                    size: product.size,
                  });
                }}
              >
                <SymbolView
                  name={
                    isSaved(product._id)
                      ? "heart.fill"
                      : "heart"
                  }
                  size={20}
                  tintColor={isSaved(product._id) ? "#D5684A" : ink}
                />
              </Pressable>
              <Pressable
                accessibilityLabel="Share product"
                style={styles.titleIconButton}
                onPress={async () => {
                  try {
                    await Share.share({
                      title: product.title,
                      message: product.title,
                      url: `https://store.esite.com/product/${product._id}`,
                    });
                  } catch (err) {
                    console.warn("Share failed", err);
                  }
                }}
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
          </View>

          <ThemedText style={styles.description}>
            {cleanDescription(product.description)}
          </ThemedText>

          <View style={styles.priceRow}>
            <View style={styles.priceWrap}>
              <ThemedText style={styles.price}>₹{currentPrice}</ThemedText>
              {hasDiscount && (
                <ThemedText style={styles.originalPrice}>
                  ₹{currentOriginalPrice}
                </ThemedText>
              )}
            </View>
            <ThemedText style={styles.stock}>
              {currentStock !== undefined
                ? currentStock > 0
                  ? `STOCK: ${currentStock}`
                  : "OUT OF STOCK"
                : "IN STOCK"}
            </ThemedText>
          </View>



          {/* Variant / Size selector */}
          <View style={styles.variantSection}>
            <ThemedText style={styles.variantHeading}>
              SELECT SIZE / VARIANT
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.variantRow}
            >
              {variants.length > 0 ? (
                variants.map((v, idx) => {
                  const isSelected = idx === selectedVariantIndex;
                  const label = getVariantLabel(v);
                  const isOutOfStock = typeof v.stock === "number" && v.stock <= 0;

                  return (
                    <Pressable
                      key={v._id || idx}
                      style={[
                        styles.variantChip,
                        isSelected && styles.variantChipSelected,
                        isOutOfStock && styles.variantChipDisabled,
                      ]}
                      onPress={() => setSelectedVariantIndex(idx)}
                    >
                      <ThemedText
                        style={[
                          styles.variantChipText,
                          isSelected && styles.variantChipTextSelected,
                        ]}
                      >
                        {label}
                      </ThemedText>
                    </Pressable>
                  );
                })
              ) : (
                <View style={[styles.variantChip, styles.variantChipSelected]}>
                  <ThemedText
                    style={[
                      styles.variantChipText,
                      styles.variantChipTextSelected,
                    ]}
                  >
                    One Size
                  </ThemedText>
                </View>
              )}
            </ScrollView>
          </View>
<View style={styles.divider} />
          {product.productCode ? (
            <View style={styles.couponBanner}>
              <View style={styles.couponBannerLeft}>
                <ThemedText style={styles.couponLabel}>
                  NEW USER COUPON CODE
                </ThemedText>
                <ThemedText style={styles.couponCode}>
                  {product.productCode}
                </ThemedText>
                <ThemedText style={styles.couponTagline}>
                  Grab amazing deals today
                </ThemedText>
              </View>
              <Pressable
                accessibilityLabel="Copy coupon code"
                style={styles.couponCopyButton}
                onPress={() => {
                  Clipboard.setString(product.productCode!);
                  Alert.alert("Copied", "Coupon code copied to clipboard");
                }}
              >
                <Text style={styles.couponCopyText}>COPY</Text>
              </Pressable>
            </View>
          ) : null}

                      <View style={styles.divider} />


          {reviews.length > 0 ? (
          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeader}>
              <ThemedText style={styles.reviewsTitle}>Reviews</ThemedText>
              <View style={styles.ratingSummary}>
                <View style={styles.ratingStars}>
                  {renderStars(ratingStats.average)}
                </View>
                <ThemedText style={styles.ratingValue}>
                  {ratingStats.average.toFixed(1)}
                </ThemedText>
                <ThemedText style={styles.reviewCount}>
                  ({ratingStats.total} {ratingStats.total === 1 ? "review" : "reviews"})
                </ThemedText>
              </View>
            </View>

            {reviewImages.length > 0 && (
              <View style={styles.reviewImagesSubSection}>
                <ThemedText style={styles.reviewImagesTitle}>
                  Customer Photos
                </ThemedText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.reviewImagesRow}
                >
                  {reviewImages.map((img, idx) => (
                    <Image
                      key={`review-img-${idx}`}
                      source={{ uri: apiImageUrl(img) }}
                      style={styles.reviewImageThumb}
                      contentFit="cover"
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + 16}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={[
                styles.reviewList,
                { paddingHorizontal: 8, marginTop: 24 },
              ]}
            >
              {reviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewRatingStars}>
                      {renderStars(review.rating)}
                    </View>
                    <ThemedText style={styles.reviewRatingValue}>
                      {review.rating.toFixed(1)}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.reviewComment}>
                    {review.comment}
                  </ThemedText>
                  <View style={styles.reviewFooter}>
                    <ThemedText style={styles.reviewAuthor}>{review.author}</ThemedText>
                    <ThemedText style={styles.reviewDate}>{review.date}</ThemedText>
                  </View>
                </View>
              ))}
            </ScrollView>

            <Pressable
              accessibilityLabel="See all reviews"
              style={styles.seeAllReviewsButton}
              onPress={() => setShowReviewsModal(true)}
            >
              <ThemedText style={styles.seeAllReviewsText}>See All Reviews</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeader}>
              <ThemedText style={styles.reviewsTitle}>Reviews</ThemedText>
            </View>
            <View style={styles.noReviewsWrap}>
              <ThemedText style={styles.noReviewsText}>
                No reviews have been added yet
              </ThemedText>
            </View>
          </View>
        )}

        <View style={styles.divider} />

          <ThemedText style={styles.similarHeading}>
            You may also like
          </ThemedText>
          <View style={styles.similarRow}>
            {similar.map((entry) => (
              <Pressable
                key={entry._id}
                onPress={() =>
                  router.push({
                    pathname: "/product/[id]",
                    params: { id: entry._id },
                  })
                }
                style={styles.similarCard}
              >
                <Image
                  source={{ uri: apiImageUrl(entry.image) }}
                  style={styles.similarImage}
                  contentFit="cover"
                />
                <ThemedText numberOfLines={1} style={styles.similarName}>
                  {entry.title}
                </ThemedText>
                <ThemedText style={styles.similarPrice}>
                  ₹{entry.price}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.divider} />

          <View style={styles.detailsDropdown}>
            <Pressable
              accessibilityLabel="Toggle product details"
              style={styles.detailsDropdownHeader}
              onPress={() => setDetailsOpen((prev) => !prev)}
            >
              <ThemedText style={styles.detailsDropdownTitle}>
                Product Details
              </ThemedText>
              <ThemedText style={styles.detailsDropdownIcon}>
                {detailsOpen ? "−" : "+"}
              </ThemedText>
            </Pressable>
            {detailsOpen && (
              <View style={styles.infoGrid}>
                <View style={styles.infoCell}>
                  <ThemedText style={styles.infoLabel}>CATEGORY</ThemedText>
                  <ThemedText style={styles.infoValue}>{categoryLabel}</ThemedText>
                </View>
                <View style={styles.infoCell}>
                  <ThemedText style={styles.infoLabel}>UNIT</ThemedText>
                  <ThemedText style={styles.infoValue}>
                    {product.unit || "N/A"}
                  </ThemedText>
                </View>
                <View style={styles.infoCell}>
                  <ThemedText style={styles.infoLabel}>SIZE</ThemedText>
                  <ThemedText style={styles.infoValue}>{currentSize}</ThemedText>
                </View>
                <View style={styles.infoCell}>
                  <ThemedText style={styles.infoLabel}>WEIGHT</ThemedText>
                  <ThemedText style={styles.infoValue}>{currentWeight}</ThemedText>
                </View>
                <View style={styles.infoCell}>
                  <ThemedText style={styles.infoLabel}>DELIVERY</ThemedText>
                  <ThemedText style={styles.infoValue}>
                    {product.deliveryTime || "Same day"}
                  </ThemedText>
                </View>
              </View>
            )}
          </View>

          <Pressable
            style={styles.contactButton}
            onPress={async () => {
              try {
                const rawNumber = "9903419235"; // Store contact number
                const phoneNumber = rawNumber.length === 10 ? `91${rawNumber}` : rawNumber.replace(/[^\d]/g, "");
                const productLink = `https://store-product-frontend.example.com/product/${product._id}`;
                const imageUrl = productImages[0] ?? "";
                const message = `Hello, I am interested in purchasing the following product:\n\n*${product.title || product.title}*\nCode: ${product.productCode || "N/A"}\nPrice: ₹${currentPrice}\n${imageUrl ? `Image: ${imageUrl}\n` : ""}Product Link: ${productLink}\n\nPlease let me know the next steps.`;
                const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
                await Linking.openURL(url);
              } catch (err) {
                console.warn("Failed to open WhatsApp", err);
              }
            }}
          >
            <ThemedText style={styles.contactButtonText}>CONTACT</ThemedText>
          </Pressable>

          <View style={styles.divider} />

          <ProductRail
            title="For You"
            products={forYou.filter((entry) => entry._id !== id)}
          />

          
        </View>

        

      </ScrollView>
      <Animated.View
        style={[styles.bottomBar, { transform: [{ scale: cartBounce }] }]}
      >
        <Pressable
          disabled={adding}
          onPress={addToCart}
          style={styles.addButton}
        >
          <ThemedText style={styles.addText}>
            {adding ? "ADDING..." : "ADD TO CART"}
          </ThemedText>
        </Pressable>

        <Pressable
          disabled={adding}
          onPress={handleBuyNow}
          style={styles.buyNowButton}
        >
          <ThemedText style={styles.buyNowText}>
            BUY NOW · ₹{currentPrice * quantity}
          </ThemedText>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F4ED" },
  content: {
    backgroundColor: "#FFFFFF",
    paddingBottom: 120,
  },
  center: {
    flex: 1,
    backgroundColor: "#F4F4ED",
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
    borderRadius: 3,
    marginTop: 24,
  },
  backLinkText: {
    color: "#F4F4ED",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  topBar: {
    height: 74,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
   galleryRow: {
     paddingHorizontal: 20,
     paddingBottom: 8,
   },
    paginationContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingBottom: 16,
    },
    paginationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#98A79F",
    },
    paginationWorm: {
      position: "absolute",
      width: 20,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#17211D",
      left: 0,
    },
  backButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: ink, fontSize: 28, lineHeight: 29, fontWeight: "300" },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 14,
    backgroundColor: "#E4ECE4",
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: "#17211D", fontSize: 15 },
  wishlistButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  heroImage: {
    width: 320,
    height: 320,
    borderRadius: 24,
    backgroundColor: "#E5ECE4",
    marginRight: 12,
  },
  imageFallback: {
    height: 180,
    marginHorizontal: 24,
    borderRadius: 24,
    backgroundColor: "#E5ECE4",
    alignItems: "center",
    justifyContent: "center",
  },
  imageFallbackText: {
    color: muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  details: { padding: 24 },
  eyebrow: {
    color: muted,
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: "800",
    marginTop: 4,
  },
  title: {
    color: ink,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "800",
    marginTop: 10,
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 6,
  },
  titleButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  titleIconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 12,
  },
  priceWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  price: { color: "#ef0505ff", fontSize: 27, fontWeight: "400" },
  originalPrice: {
    color: "#bab7b7ff",
    fontSize: 15,
    textDecorationLine: "line-through",
    fontWeight: "600",
  },
  stock: {
    color: "#526057",
    backgroundColor: "#D4E8D2",
    paddingHorizontal: 9,
    paddingVertical: 6,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    borderRadius: 10,
  },
  reviewImagesSubSection: {
    marginTop: 20,
  },
  reviewImagesTitle: {
    color: ink,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  reviewImagesRow: {
    flexDirection: "row",
    gap: 10,
    paddingRight: 24,
  },
  reviewImageThumb: {
    width: 100,
    height: 100,
    borderRadius: 10,
    backgroundColor: "#E5ECE4",
  },
  seeAllReviewsButton: {
    alignSelf: "center",
    marginTop: 15,
    paddingHorizontal: 100,
    paddingVertical: 9,
    backgroundColor: "#ffffffff",
    borderWidth: 2,
    borderColor: "#d1d1d1ff",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  seeAllReviewsText: {
    color: "#797979ff",
    fontSize: 14,
    fontWeight: "700",
  },
  variantSection: {
    marginTop: 10,
  },
  variantHeading: {
    color: muted,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "800",
    marginBottom: 10,
  },
  variantRow: {
    flexDirection: "row",
    gap: 10,
  },
  variantChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#C8D2C7",
    backgroundColor: "#FFFFFF",
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  variantChipSelected: {
    borderColor: ink,
    backgroundColor: ink,
  },
  variantChipDisabled: {
    opacity: 0.5,
  },
  variantChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: ink,
  },
  variantChipTextSelected: {
    color: "#FFFFFF",
  },
  codeText: {
    color: muted,
    fontSize: 11,
    marginTop: 14,
    fontWeight: "700",
  },
  couponBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF7F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#FFD1A8",
    gap: 8,
    marginTop: 15,
  },
  couponBannerLeft: {
    flex: 1,
  },
  couponLabel: {
    color: "#CC5200",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  couponCode: {
    color: "#17211D",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 2,
  },
  couponTagline: {
    color: "#6E786F",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  couponCopyButton: {
    backgroundColor: "#CC0000",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  couponCopyText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  description: { color: "#8f8f90ff", fontSize: 16, lineHeight: 24, marginTop: 6 },
  reviewsSection: {
    marginTop: 32,
    padding: 20,
    backgroundColor: "#F0F7FF",
    borderRadius: 16,
  },
  reviewsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  reviewsTitle: {
    color: ink,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  ratingSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ratingStars: {
    flexDirection: "row",
    gap: 2,
  },
  ratingValue: {
    color: ink,
    fontSize: 18,
    fontWeight: "800",
  },
  reviewCount: {
    color: muted,
    fontSize: 12,
    fontWeight: "700",
  },
  reviewList: {
    flexDirection: "row",
    gap: 16,
    paddingRight: 24,
    justifyContent: "center",
  },
  reviewCard: {
    width: CARD_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    gap: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reviewRatingStars: {
    flexDirection: "row",
    gap: 1,
  },
  reviewRatingValue: {
    color: ink,
    fontSize: 12,
    fontWeight: "800",
  },
  reviewComment: {
    color: ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  reviewFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  reviewAuthor: {
    color: ink,
    fontSize: 12,
    fontWeight: "700",
  },
  reviewDate: {
    color: muted,
    fontSize: 11,
    fontWeight: "600",
  },
  detailsDropdown: {
    marginTop: 28,
    backgroundColor: "#FFFDEB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F3E7B3",
    overflow: "hidden",
  },
  detailsDropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailsDropdownTitle: {
    color: ink,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  detailsDropdownIcon: {
    color: ink,
    fontSize: 22,
    fontWeight: "300",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  infoRow: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: border,
    flexDirection: "row",
    gap: 32,
    paddingVertical: 18,
    marginTop: 28,
  },
  infoCell: {
    width: "47%",
  },
  infoLabel: {
    color: muted,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "800",
  },
  infoValue: {
    color: ink,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
    maxWidth: 140,
  },
  contactButton: {
    backgroundColor: "#000000ff",
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 24,
  },
  contactButtonText: {
    color: "#F4F4ED",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  similarHeading: {
    color: ink,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 34,
    marginBottom: 16,
  },
  divider: {
    height: 1.5,
    backgroundColor: "#E3E3E3",
    marginTop: 20,
    marginHorizontal: -4,
  },
  similarRow: { flexDirection: "row", gap: 16 },
  similarCard: { flex: 1 },
  similarImage: {
    width: "100%",
    aspectRatio: 0.86,
    borderRadius: 12,
    backgroundColor: "#E5ECE4",
  },
  similarName: { color: ink, fontSize: 14, fontWeight: "800", marginTop: 9 },
  similarPrice: { color: ink, fontSize: 14, fontWeight: "800", marginTop: 4 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#F4F4ED",
    borderTopWidth: 1,
    borderTopColor: border,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  quantity: { flexDirection: "row", alignItems: "center", gap: 8 },
  quantityButton: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: "#C8D2C7",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityText: { color: ink, fontSize: 20 },
  quantityValue: {
    color: ink,
    fontSize: 16,
    fontWeight: "800",
    minWidth: 14,
    textAlign: "center",
  },
  buyNowButton: {
    flex: 1,
    height: 52,
    backgroundColor: "#C94B3C",
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  buyNowText: {
    color: "#F4F4ED",
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: "900",
  },
  addButton: {
    flex: 1,
    height: 52,
    backgroundColor: ink,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: {
    color: "#F4F4ED",
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: "900",
  },
  noReviewsWrap: {
  backgroundColor: "#FFFFFF",
  borderRadius: 12,
  paddingVertical: 18,
  paddingHorizontal: 14,
  alignItems: "center",
  justifyContent: "center",
  },
  noReviewsText: {
    color: muted,
    fontSize: 13,
    fontWeight: "700",
  },
});
