import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { apiImageUrl, type ApiProduct } from "@/lib/api";

export function ProductRail({
  title,
  products,
}: {
  title: string;
  products: ApiProduct[];
}) {
  const { token } = useAuth();
  const { addItem } = useCart();

  return (
    <View style={styles.section}>
      <ThemedText style={styles.heading}>{title}</ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {products.map((product) => (
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
            <Image
              source={{ uri: apiImageUrl(product.image) }}
              style={styles.image}
              contentFit="cover"
            />
            <ThemedText numberOfLines={1} style={styles.name}>
              {product.title}
            </ThemedText>
            <ThemedText numberOfLines={2} style={styles.description}>
              {product.description || "No description available"}
            </ThemedText>
            <ThemedText numberOfLines={4} style={styles.parameters}>
              Category: {product.categoryName || product.categoryId || "N/A"}
              {"\n"}Unit: {product.unit || "N/A"} · Size:{" "}
              {product.size || "N/A"}
              {"\n"}Weight: {product.weight || "N/A"}
              {"\n"}Delivery: {product.deliveryTime || "N/A"}
            </ThemedText>
            <View style={styles.footer}>
              <ThemedText style={styles.price}>
                {product.price > 0 ? `₹${product.price}` : "PRICE ON REQUEST"}
              </ThemedText>
              <Pressable
                accessibilityLabel={`Add ${product.title} to cart`}
                onPress={(event) => {
                  event.stopPropagation();
                  if (!token) {
                    router.push("/sign-in");
                    return;
                  }
                  void addItem(product);
                }}
                style={styles.add}
              >
                <ThemedText style={styles.addText}>+</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 30 },
  heading: {
    color: "#17211D",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 14,
  },
  row: { gap: 12, paddingRight: 24 },
  card: {
    width: 154,
    backgroundColor: "#E8EFE7",
    borderWidth: 1,
    borderColor: "#D7E0D6",
    borderRadius: 12,
    padding: 9,
  },
  image: {
    width: "100%",
    height: 142,
    borderRadius: 8,
    backgroundColor: "#E1E9E0",
  },
  name: { color: "#17211D", fontSize: 13, fontWeight: "800", marginTop: 9 },
  description: { color: "#748078", fontSize: 11, lineHeight: 15, marginTop: 5 },
  parameters: { color: "#526057", fontSize: 10, lineHeight: 14, marginTop: 7 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  price: { color: "#17211D", fontSize: 14, fontWeight: "800" },
  add: {
    width: 30,
    height: 30,
    borderRadius: 3,
    backgroundColor: "#17211D",
    alignItems: "center",
    justifyContent: "center",
  },
  addText: {
    color: "#F4F4ED",
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "400",
  },
});
