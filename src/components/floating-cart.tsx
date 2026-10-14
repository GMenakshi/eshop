import { router, usePathname } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { useCart } from "@/context/cart-context";

const COLLAPSED_W = 62;
const EXPANDED_W = 248;
const HEIGHT = 62;
const OFFSCREEN = 280;

export function FloatingCart() {
  const { items } = useCart();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isCartScreen =
    pathname.endsWith("/cart") || pathname.endsWith("/orders");
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const visible = itemCount > 0 && !isCartScreen;

  // stays true while the exit animation is playing
  const [mounted, setMounted] = useState(false);

  // keep the last count so the label doesn't flash "0 items" while closing
  const lastCount = useRef(itemCount);
  if (itemCount > 0) lastCount.current = itemCount;
  const displayCount = itemCount > 0 ? itemCount : lastCount.current;

  // layout (JS driven)
  const width = useRef(new Animated.Value(COLLAPSED_W)).current;

  // everything below is native driven
  const enterY = useRef(new Animated.Value(OFFSCREEN)).current;
  const enterOpacity = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textX = useRef(new Animated.Value(-14)).current;
  const arrowScale = useRef(new Animated.Value(0)).current;
  const arrowOpacity = useRef(new Animated.Value(0)).current;
  const iconWiggle = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;

  const navigating = useRef(false);
  const running = useRef<Animated.CompositeAnimation | null>(null);
  const prevCount = useRef(itemCount);

  const resetHidden = () => {
    running.current?.stop();
    width.setValue(COLLAPSED_W);
    enterY.setValue(OFFSCREEN);
    enterOpacity.setValue(0);
    pressScale.setValue(1);
    textOpacity.setValue(0);
    textX.setValue(-14);
    arrowScale.setValue(0);
    arrowOpacity.setValue(0);
    iconWiggle.setValue(0);
  };

  useEffect(() => {
    navigating.current = false;

    // ---------- ENTRANCE ----------
    if (visible) {
      resetHidden();
      setMounted(true);

      const fast = { restDisplacementThreshold: 0.01, restSpeedThreshold: 0.01 };

      const anim = Animated.parallel([
        // drop up from the bottom
        Animated.spring(enterY, {
          toValue: 0,
          damping: 18,
          stiffness: 420,
          mass: 0.6,
          restDisplacementThreshold: 0.5,
          restSpeedThreshold: 0.5,
          useNativeDriver: true,
        }),
        Animated.timing(enterOpacity, {
          toValue: 1,
          duration: 70,
          useNativeDriver: true,
        }),
        // expand
        Animated.sequence([
          Animated.delay(30),
          Animated.spring(width, {
            toValue: EXPANDED_W,
            damping: 18,
            stiffness: 420,
            mass: 0.6,
            restDisplacementThreshold: 1,
            restSpeedThreshold: 1,
            useNativeDriver: false,
          }),
        ]),
        // text
        Animated.sequence([
          Animated.delay(50),
          Animated.parallel([
            Animated.timing(textOpacity, {
              toValue: 1,
              duration: 90,
              useNativeDriver: true,
            }),
            Animated.spring(textX, {
              toValue: 0,
              damping: 18,
              stiffness: 420,
              ...fast,
              useNativeDriver: true,
            }),
          ]),
        ]),
        // icon wiggle
        Animated.sequence([
          Animated.delay(50),
          Animated.timing(iconWiggle, {
            toValue: 1,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(iconWiggle, {
            toValue: -1,
            duration: 60,
            useNativeDriver: true,
          }),
          Animated.spring(iconWiggle, {
            toValue: 0,
            damping: 9,
            stiffness: 420,
            ...fast,
            useNativeDriver: true,
          }),
        ]),
        // arrow pop
        Animated.sequence([
          Animated.delay(70),
          Animated.parallel([
            Animated.timing(arrowOpacity, {
              toValue: 1,
              duration: 60,
              useNativeDriver: true,
            }),
            Animated.spring(arrowScale, {
              toValue: 1,
              damping: 10,
              stiffness: 450,
              mass: 0.6,
              ...fast,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]);

      running.current = anim;
      anim.start();
      return () => anim.stop();
    }

    // ---------- EXIT (cart emptied): exact reverse of the entrance ----------
    const emptied = itemCount === 0 && !isCartScreen;
    if (mounted && emptied) {
      running.current?.stop();
      pressScale.setValue(1);

      const anim = Animated.parallel([
        // 1. arrow shrinks away first
        Animated.timing(arrowScale, {
          toValue: 0,
          duration: 70,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(arrowOpacity, {
          toValue: 0,
          duration: 70,
          useNativeDriver: true,
        }),
        // 2. text slides back and fades
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(textX, {
          toValue: -14,
          duration: 80,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        // 3. pill collapses back to a circle
        Animated.sequence([
          Animated.delay(40),
          Animated.timing(width, {
            toValue: COLLAPSED_W,
            duration: 130,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: false,
          }),
        ]),
        // 4. drops down off the bottom
        Animated.sequence([
          Animated.delay(110),
          Animated.parallel([
            Animated.timing(enterY, {
              toValue: OFFSCREEN,
              duration: 190,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.delay(100),
              Animated.timing(enterOpacity, {
                toValue: 0,
                duration: 90,
                useNativeDriver: true,
              }),
            ]),
          ]),
        ]),
      ]);

      running.current = anim;
      anim.start(({ finished }) => {
        if (finished) {
          resetHidden();
          setMounted(false);
        }
      });
      return () => anim.stop();
    }

    // ---------- instant hide (e.g. opening the cart screen) ----------
    resetHidden();
    setMounted(false);
  }, [visible]);

  // the count badge pops when the number changes
  useEffect(() => {
    if (visible && itemCount !== prevCount.current) {
      badgeScale.setValue(0.6);
      Animated.spring(badgeScale, {
        toValue: 1,
        damping: 6,
        stiffness: 400,
        useNativeDriver: true,
      }).start();
    }
    prevCount.current = itemCount;
  }, [itemCount]);

  const zoomIn = () =>
    Animated.timing(pressScale, {
      toValue: 1.04,
      duration: 60,
      useNativeDriver: true,
    }).start();

  const openCart = () => {
    if (navigating.current) return;
    navigating.current = true;
    zoomIn();
    router.push("/cart"); // navigate immediately, no waiting
  };

  if (!visible && !mounted) return null;

  const wiggle = iconWiggle.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-14deg", "0deg", "14deg"],
  });

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          alignItems: "center",
          bottom: Math.max(insets.bottom, 8) + 84,
          opacity: enterOpacity,
          transform: [{ translateY: enterY }, { scale: pressScale }],
        }}
      >
        <Animated.View style={{ width, height: HEIGHT }}>
          <Pressable
            disabled={!visible}
            accessibilityLabel={`View cart with ${displayCount} item${displayCount === 1 ? "" : "s"}`}
            onPress={openCart}
            onPressIn={zoomIn}
            onPressOut={() => {
              // if the finger slid off without tapping, go back to normal size
              if (!navigating.current) {
                Animated.timing(pressScale, {
                  toValue: 1,
                  duration: 70,
                  useNativeDriver: true,
                }).start();
              }
            }}
            style={styles.pill}
          >
            <View style={styles.row}>
              <Animated.View
                style={[styles.iconWrap, { transform: [{ rotate: wiggle }] }]}
              >
                <SymbolView
                  name={{
                    ios: "bag.fill",
                    android: "shopping_cart",
                    web: "shopping_cart",
                  }}
                  size={21}
                  tintColor="#FFFFFF"
                />
                <Animated.View
                  style={[styles.badge, { transform: [{ scale: badgeScale }] }]}
                >
                  <ThemedText style={styles.badgeText}>
                    {displayCount}
                  </ThemedText>
                </Animated.View>
              </Animated.View>

              <Animated.View
                style={[
                  styles.copy,
                  { opacity: textOpacity, transform: [{ translateX: textX }] },
                ]}
              >
                <ThemedText style={styles.title} numberOfLines={1}>
                  View cart
                </ThemedText>
                <ThemedText style={styles.subtitle} numberOfLines={1}>
                  · {displayCount} item{displayCount === 1 ? "" : "s"}
                </ThemedText>
              </Animated.View>

              <Animated.View
                style={[
                  styles.arrowWrap,
                  {
                    opacity: arrowOpacity,
                    transform: [{ scale: arrowScale }],
                  },
                ]}
              >
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={18}
                  tintColor="#FFFFFF"
                />
              </Animated.View>
            </View>
          </Pressable>
        </Animated.View>
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
  pill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 100,
    overflow: "hidden",
    backgroundColor: "rgba(45,40,34,0.92)",
  },
  row: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: EXPANDED_W,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 13,
    paddingRight: 14,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#000000",
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
    backgroundColor: "#F09148",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#17211D", fontSize: 10, fontWeight: "900" },
  copy: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  title: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  subtitle: { color: "#D9CBBE", fontSize: 12, fontWeight: "600" },
  arrowWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
});