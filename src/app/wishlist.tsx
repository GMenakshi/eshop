import { Image } from "expo-image";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { useWishlist } from "@/context/wishlist-context";
import { API_BASE_URL, apiImageUrl } from "@/lib/api";
import { useStore } from "@/lib/store-context";

const DEFAULT_RATING = 4.0; // shown when the API sends no rating

type Live = { price: number; rating: number };

const pickPrice = (raw: any): number => {
  const candidates = [
    raw?.minOfferPrice,
    raw?.price,
    raw?.variants?.[0]?.sizeVariants?.[0]?.offerPrice,
    raw?.variants?.[0]?.offerPrice,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
};

const pickRating = (raw: any): number => {
  const n = Number(raw?.rating ?? raw?.averageRating);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export default function WishlistScreen() {
  const { items, toggle, loading } = useWishlist();
  const { storeId } = useStore();
  const [live, setLive] = useState<Record<string, Live>>({});

  // Wishlist entries can be saved without a usable price, so read the
  // current price and rating from the store's product list.
  useEffect(() => {
    if (!storeId) return;
    let active = true;
    fetch(
      `${API_BASE_URL}/product/store/${encodeURIComponent(storeId)}/products`,
    )
      .then((r) => r.json())
      .then((json) => {
        if (!active) return;
        const map: Record<string, Live> = {};
        for (const p of json?.products ?? []) {
          if (p?._id)
            map[String(p._id)] = {
              price: pickPrice(p),
              rating: pickRating(p),
            };
        }
        setLive(map);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [storeId]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>Wishlist</ThemedText>
          <ThemedText style={styles.count}>
            {items.length} {items.length === 1 ? "item" : "items"}
          </ThemedText>
        </View>

        {loading && items.length === 0 ? (
          <ActivityIndicator color="#17211D" style={{ marginTop: 60 }} />
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <SymbolView
              name={{ ios: "heart", android: "favorite", web: "favorite" }}
              size={48}
              tintColor="#6E786F"
            />
            <ThemedText style={styles.emptyTitle}>
              Your wishlist is empty
            </ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Tap the heart on any product to save it here.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map((product) => {
              const p = product as any;
              const entry = live[String(product.id)];
              const price = entry?.price || pickPrice(p);
              const rating =
                entry?.rating || pickRating(p) || DEFAULT_RATING;

              return (
                <Pressable
                  key={product.id}
                  style={styles.card}
                  onPress={() =>
                    router.push({
                      pathname: "/product/[id]",
                      params: { id: product.id },
                    })
                  }
                >
                  <View style={styles.visual}>
                    {product.image ? (
                      <Image
                        source={{ uri: apiImageUrl(product.image) }}
                        style={styles.illustration}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.illustration} />
                    )}
                    <Pressable
                      style={styles.heartBadge}
                      onPress={() => toggle(product)}
                    >
                      <SymbolView
                        name={{
                          ios: "heart.fill",
                          android: "favorite",
                          web: "favorite",
                        }}
                        size={16}
                        tintColor="#D5684A"
                      />
                    </Pressable>
                  </View>

                  <View style={styles.meta}>
                    <ThemedText style={styles.productName} numberOfLines={2}>
                      {product.name}
                    </ThemedText>
                    <View style={styles.bottomRow}>
                      <ThemedText style={styles.price} numberOfLines={1}>
                        {price > 0 ? `₹${price}` : "Order to know Price"}
                      </ThemedText>
                      <View style={styles.ratingBadge}>
                        <ThemedText style={styles.ratingText}>
                          {rating.toFixed(1)}
                        </ThemedText>
                        <ThemedText style={styles.ratingStar}>★</ThemedText>
                      </View>
                    </View>
                    {product.isAvailable === false && (
                      <View style={styles.unavailableBadge}>
                        <ThemedText style={styles.unavailable}>
                          Unavailable
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F4ED" },
  content: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    color: "#17211D",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -1.2,
  },
  count: { color: "#6E786F", fontSize: 14, fontWeight: "700" },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: { color: "#17211D", fontSize: 22, fontWeight: "700" },
  emptySubtitle: { color: "#6E786F", fontSize: 14, textAlign: "center" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },
  card: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "rgba(0,0,0,0.08)",
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  visual: { aspectRatio: 1, backgroundColor: "#F6F3F2", position: "relative" },
  illustration: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  heartBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { padding: 12, gap: 6 },
  productName: {
    color: "#17211D",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  price: { flexShrink: 1, color: "#17211D", fontSize: 16, fontWeight: "800" },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#E8F8EF",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingText: { color: "#17211D", fontSize: 11, fontWeight: "800" },
  ratingStar: { color: "#22A45D", fontSize: 11 },
  unavailableBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FBEAE6",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  unavailable: { color: "#B84A36", fontSize: 11, fontWeight: "800" },
});