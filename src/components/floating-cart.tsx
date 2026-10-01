import { router, usePathname } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { useCart } from "@/context/cart-context";

export function FloatingCart() {
  const { items } = useCart();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  // hidden on the cart and orders screens
  const isCartScreen = pathname.endsWith("/cart") || pathname.endsWith("/orders");
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const opacity = useRef(new Animated.Value(itemCount > 0 ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(itemCount > 0 ? 1 : 0.85)).current;
  const navigating = useRef(false);

  const openCart = () => {
    if (navigating.current) return;
    navigating.current = true;

    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1.05,
        tension: 260,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.88,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished) router.push("/cart");
      else navigating.current = false;
    });
  };

  useEffect(() => {
    navigating.current = false;
    if (!isCartScreen) {
      if (itemCount > 0) {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            tension: 200,
            friction: 14,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.85,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
  }, [pathname, itemCount, isCartScreen]);

  if (!itemCount || isCartScreen) return null;

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          alignItems: "center",
          transform: [{ scale }],
          opacity,
          bottom: Math.max(insets.bottom, 8) + 84,
        }}
      >
        <Pressable
          accessibilityLabel={`View cart with ${itemCount} item${itemCount === 1 ? "" : "s"}`}
          onPress={openCart}
          disabled={navigating.current}
          style={styles.cartButton}
        >
          <View style={styles.iconWrap}>
            <SymbolView
              name={{
                ios: "bag.fill",
                android: "shopping_cart",
                web: "shopping_cart",
              }}
              size={21}
              tintColor="#FFFFFF"
            />
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>{itemCount}</ThemedText>
            </View>
          </View>
                    <View style={styles.copy}>
            <ThemedText style={styles.title} numberOfLines={1}>
              View cart
            </ThemedText>
            <ThemedText style={styles.subtitle} numberOfLines={1}>
              · {itemCount} item{itemCount === 1 ? "" : "s"}
            </ThemedText>
          </View>
          <View style={styles.arrowWrap}>
            <SymbolView
              name={{
                ios: "chevron.right",
                android: "chevron_right",
                web: "chevron_right",
              }}
              size={18}
              tintColor="#FFFFFF"
            />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    elevation: 20,
  },
    cartButton: {
    alignSelf: "center",
    minHeight: 62,
    borderRadius: 100,
    paddingHorizontal: 14,
    backgroundColor: "rgba(69, 63, 54, 0.6)",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 14,
        shadowOffset: { width: 0, height: 7 },
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 1)",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#ff7b00dc",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#17211D", fontSize: 10, fontWeight: "900" },
    copy: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  subtitle: { color: "#B9C8BF", fontSize: 12, fontWeight: "600" },
  arrowWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
});
