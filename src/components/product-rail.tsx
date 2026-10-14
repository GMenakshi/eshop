import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { apiImageUrl, type ApiProduct } from "@/lib/api";
import { deliveryDateText } from "@/lib/delivery-text";

const ink = "#1A1A1A";
const muted = "#999999";
const bgLight = "#F8F6F3";

const getDiscount = (product: ApiProduct) => {
  const original = product.originalPrice;
  const price = product.price;
  if (typeof original === "number" && original > price) {
    return Math.round(((original - price) / original) * 100);
  }
  return null;
};

export function ProductRail({
  title,
  products,
  showArrow = true,
  onSeeAll,
}: {
  title: string;
  products: ApiProduct[];
  showArrow?: boolean;
  onSeeAll?: () => void;
}) {
  return (
    <View style={styles.section}>
      {(Boolean(title) || showArrow) && (
        <View style={styles.header}>
          <ThemedText style={styles.heading}>{title}</ThemedText>
          {showArrow && (
            <Pressable
              onPress={() => (onSeeAll ? onSeeAll() : router.push("/products"))}
              hitSlop={8}
            >
              <ThemedText style={styles.seeAllText}>See all</ThemedText>
            </Pressable>
          )}
        </View>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {products.map((product) => {
          const discount = getDiscount(product);
          return (
            <Pressable
              key={product._id}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/product/[id]",
                  params: { id: product._id },
                })
              }
            >
              <View style={styles.imageWrap}>
                <Image
                  source={{ uri: apiImageUrl(product.image) }}
                  style={styles.image}
                  contentFit="cover"
                />
                <View style={styles.ratingBadge}>
                  <ThemedText style={styles.ratingText}>
                    {(product.rating ?? 3.8).toFixed(1)}
                  </ThemedText>
                  <Text style={styles.ratingStar}>★</Text>
                </View>
              </View>

              <ThemedText style={styles.name} numberOfLines={1}>
                {product.title}
              </ThemedText>

              {discount !== null && (
                <ThemedText style={styles.discount}>{discount}% OFF</ThemedText>
              )}

              <View style={styles.priceRow}>
                {typeof product.originalPrice === "number" &&
                  product.originalPrice > product.price && (
                    <ThemedText style={styles.originalPrice}>
                      ₹{product.originalPrice}
                    </ThemedText>
                  )}
                <ThemedText style={styles.price}>
                  {product.price > 0
                    ? `₹${product.price}`
                    : "CLICK ORDER FOR PRICE"}
                </ThemedText>
              </View>

              {product.delivery?.deliverable === false ? (
                <ThemedText style={[styles.deliveryText, { color: "#E53935" }]}>
                  Not deliverable to your pincode
                </ThemedText>
              ) : (
                (!!product.delivery || !!product.deliveryTime) && (
                  <ThemedText style={styles.deliveryText}>
                    Get it by{" "}
                    <ThemedText style={styles.deliveryDate}>
                      {deliveryDateText(product.delivery, product.deliveryTime)}
                    </ThemedText>
                  </ThemedText>
                )
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: "800",
    color: ink,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E8875C",
  },
  row: {
    flexDirection: "row",
    gap: 16,
    paddingRight: 24,
  },
  card: {
    width: 160,
  },
  imageWrap: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: bgLight,
  },
  image: {
    width: "100%",
    height: 170,
  },
  ratingBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "800",
    color: ink,
  },
  ratingStar: {
    fontSize: 12,
    color: "#22A45D",
  },
  name: {
    fontSize: 14,
    fontWeight: "700",
    color: ink,
    marginTop: 10,
  },
  discount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#22A45D",
    marginTop: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  originalPrice: {
    fontSize: 12,
    fontWeight: "600",
    color: muted,
    textDecorationLine: "line-through",
  },
  price: {
    fontSize: 16,
    fontWeight: "800",
    color: ink,
  },
  deliveryText: {
    fontSize: 12,
    fontWeight: "400",
    color: "#8A8A8A",
    letterSpacing: 0.1,
    marginTop: 4,
  },
  deliveryDate: {
    fontWeight: "600",
    color: "#1B7F4B",
  },
});
