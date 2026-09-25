import { Image } from "expo-image";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
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
import { apiImageUrl } from "@/lib/api";

export default function WishlistScreen() {
  const { items, toggle, loading } = useWishlist();

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
            {items.map((product) => (
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
                  <ThemedText style={styles.price}>₹{product.price}</ThemedText>
                  {product.isAvailable === false && (
                    <ThemedText style={styles.unavailable}>
                      Unavailable
                    </ThemedText>
                  )}
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => toggle(product)}
                  >
                    <ThemedText style={styles.removeText}>Remove</ThemedText>
                  </Pressable>
                </View>
              </Pressable>
            ))}
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
  emptyTitle: {
    color: "#17211D",
    fontSize: 22,
    fontWeight: "700",
  },
  emptySubtitle: {
    color: "#6E786F",
    fontSize: 14,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  card: {
    width: "46%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E0E4DC",
    overflow: "hidden",
  },
  visual: {
    padding: 14,
    minHeight: 140,
    backgroundColor: "#F6F3F2",
    position: "relative",
  },
  illustration: {
    width: "100%",
    height: 110,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.4)",
    alignSelf: "center",
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
  meta: {
    padding: 12,
  },
  productName: {
    color: "#17211D",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 6,
  },
  price: {
    color: "#17211D",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },
  unavailable: {
    color: "#B84A36",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
  },
  removeButton: {
    marginTop: 8,
    backgroundColor: "#E8EFE7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  removeText: {
    color: "#17211D",
    fontSize: 11,
    fontWeight: "700",
  },
});