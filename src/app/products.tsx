import { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { api, DEFAULT_STORE_ID, apiImageUrl, type ApiProduct } from "@/lib/api";

export default function ProductsScreen() {
  const router = useRouter();
  const { categoryId, categoryName } = useLocalSearchParams<{
    categoryId?: string;
    categoryName?: string;
  }>();
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        let response;
        if (categoryId && categoryId !== "all") {
          response = await api.productsByCategory(
            DEFAULT_STORE_ID,
            categoryId,
          );
        } else {
          response = await api.products(DEFAULT_STORE_ID);
        }
        if (mounted) setProducts(response.products ?? []);
      } catch {
        if (mounted) setProducts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [categoryId]);

  const filtered = products.filter((product) =>
    product.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <Stack.Screen
        options={{
          title: categoryName || "Products",
          headerShown: true,
          headerStyle: { backgroundColor: "#F4F4ED" },
          headerTintColor: "#17211D",
        }}
      />
      <View style={styles.searchBox}>
        
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search products"
          placeholderTextColor="#829087"
          style={styles.searchInput}
        />
      </View>
      {loading ? (
        <ThemedText style={styles.empty}>Loading products…</ThemedText>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          ListEmptyComponent={
            <ThemedText style={styles.empty}>No products found.</ThemedText>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/product/[id]",
                  params: { id: item._id },
                })
              }
            >
              {item.image ? (
                <Image
                  source={{ uri: apiImageUrl(item.image) }}
                  style={styles.image}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.imagePlaceholder} />
              )}
              <ThemedText style={styles.title} numberOfLines={2}>
                {item.title}
              </ThemedText>
              <ThemedText style={styles.price}>
                ₹{item.price}
              </ThemedText>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F4ED" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 16,
    marginBottom: 12,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: "#E4ECE4",
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: "#17211D", fontSize: 15 },
  grid: { padding: 16, gap: 14 },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E0E4DC",
    maxWidth: "46%",
  },
  image: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    backgroundColor: "#E8EFE7",
    marginBottom: 8,
  },
  imagePlaceholder: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    backgroundColor: "#E8EFE7",
    marginBottom: 8,
  },
  title: {
    color: "#17211D",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  price: {
    color: "#17211D",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
  },
  empty: { color: "#6E786F", fontSize: 14, textAlign: "center", marginTop: 40 },
});