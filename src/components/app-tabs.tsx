import { FloatingCart } from "@/components/floating-cart";
import { StoreUnavailable } from "@/components/store-unavailable";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { useStore } from "@/lib/store-context";
import { BlurView } from "expo-blur";
import { Tabs, router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ORANGE = "#E8763A";
const INK = "#1A1A1A";
const IDLE = "#5F6368";
const PILL_PAD = 4;

export default function AppTabs() {
  const { storeUnavailable } = useStore();

  return (
    <>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
        screenLayout={({ route, children }) =>
          storeUnavailable && route.name !== "profile" ? (
            <StoreUnavailable />
          ) : (
            children
          )
        }
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="explore" options={{ title: "Categories" }} />
        <Tabs.Screen name="orders" options={{ title: "Orders" }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
      {!storeUnavailable && <FloatingCart />}
    </>
  );
}

const tabIcons = {
  index: {
    idle: { ios: "house", android: "home", web: "home" },
    active: { ios: "house.fill", android: "home", web: "home" },
    label: "Home",
  },
  explore: {
    idle: { ios: "square.grid.3x3", android: "apps", web: "apps" },
    active: { ios: "square.grid.3x3.fill", android: "apps", web: "apps" },
    label: "Categories",
  },
  orders: {
    idle: { ios: "shippingbox", android: "inventory", web: "inventory" },
    active: { ios: "shippingbox.fill", android: "inventory", web: "inventory" },
    label: "Orders",
  },
} as const;

type TabName = keyof typeof tabIcons;

function TabItem({
  index,
  name,
  focused,
  position,
  onPress,
}: {
  index: number;
  name: TabName;
  focused: boolean;
  position: Animated.Value;
  onPress: () => void;
}) {
  const cfg = tabIcons[name];
  const pressScale = useRef(new Animated.Value(1)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  // small hop when this tab becomes active
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!focused) return;
    hop.setValue(0);
    Animated.sequence([
      Animated.timing(hop, {
        toValue: -5,
        duration: 110,
        useNativeDriver: true,
      }),
      Animated.spring(hop, {
        toValue: 0,
        friction: 4,
        tension: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  // all of these follow the sliding position, so they animate in sync with it
  const activeAmount = position.interpolate({
    inputRange: [index - 1, index, index + 1],
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });
  const idleAmount = position.interpolate({
    inputRange: [index - 1, index, index + 1],
    outputRange: [1, 0, 1],
    extrapolate: "clamp",
  });
  const iconScale = position.interpolate({
    inputRange: [index - 1, index, index + 1],
    outputRange: [1, 1.18, 1],
    extrapolate: "clamp",
  });
  const labelOpacity = position.interpolate({
    inputRange: [index - 1, index, index + 1],
    outputRange: [0.55, 1, 0.55],
    extrapolate: "clamp",
  });
  const labelLift = position.interpolate({
    inputRange: [index - 1, index, index + 1],
    outputRange: [0, -1, 0],
    extrapolate: "clamp",
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onPressIn={() =>
        Animated.spring(pressScale, {
          toValue: 0.88,
          speed: 60,
          bounciness: 0,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.spring(pressScale, {
          toValue: 1,
          speed: 24,
          bounciness: 14,
          useNativeDriver: true,
        }).start()
      }
      style={styles.tabItem}
    >
      <Animated.View
        style={{ alignItems: "center", transform: [{ scale: pressScale }] }}
      >
        <Animated.View
          style={[
            styles.iconBox,
            { transform: [{ translateY: hop }, { scale: iconScale }] },
          ]}
        >
          <Animated.View style={[styles.iconLayer, { opacity: idleAmount }]}>
            <SymbolView name={cfg.idle} size={21} tintColor={IDLE} />
          </Animated.View>
          <Animated.View style={[styles.iconLayer, { opacity: activeAmount }]}>
            <SymbolView name={cfg.active} size={21} tintColor={ORANGE} />
          </Animated.View>
        </Animated.View>
        <Animated.View
          style={{
            opacity: labelOpacity,
            transform: [{ translateY: labelLift }],
          }}
        >
          <ThemedText style={styles.tabLabel} numberOfLines={1}>
            {cfg.label}
          </ThemedText>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const visibleRoutes = state.routes.filter(
    (route: { name: string }) => route.name !== "profile",
  );
  const count = visibleRoutes.length;

  const currentKey = state.routes[state.index]?.key;
  const activeVisible = visibleRoutes.findIndex(
    (r: { key: string }) => r.key === currentKey,
  );

  const [pillW, setPillW] = useState(0);
  const tabW = pillW > 0 ? (pillW - PILL_PAD * 2) / count : 0;

  const position = useRef(
    new Animated.Value(Math.max(activeVisible, 0)),
  ).current;
  const stretch = useRef(new Animated.Value(0)).current;
  const indicatorOpacity = useRef(
    new Animated.Value(activeVisible >= 0 ? 1 : 0),
  ).current;
  const enter = useRef(new Animated.Value(0)).current;
  const profileScale = useRef(new Animated.Value(1)).current;
  const firstRun = useRef(true);

  // bar slides up and fades in once
  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      damping: 15,
      stiffness: 130,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (activeVisible >= 0) {
      Animated.spring(position, {
        toValue: activeVisible,
        damping: 15,
        stiffness: 190,
        mass: 0.85,
        useNativeDriver: true,
      }).start();

      // liquid stretch: the highlight stretches while it travels, then snaps back
      if (!firstRun.current) {
        stretch.setValue(0);
        Animated.sequence([
          Animated.timing(stretch, {
            toValue: 1,
            duration: 130,
            useNativeDriver: true,
          }),
          Animated.spring(stretch, {
            toValue: 0,
            friction: 5,
            tension: 150,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
    firstRun.current = false;
    Animated.timing(indicatorOpacity, {
      toValue: activeVisible >= 0 ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [activeVisible]);

  const stretchX = stretch.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.22],
  });
  const stretchY = stretch.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.9],
  });

  return (
    <Animated.View
      style={[
        styles.bottomArea,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [70, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View
        style={styles.tabPill}
        onLayout={(e) => setPillW(e.nativeEvent.layout.width)}
      >
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />

        {tabW > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              {
                width: tabW,
                opacity: indicatorOpacity,
                transform: [
                  { translateX: Animated.multiply(position, tabW) },
                  { scaleX: stretchX },
                  { scaleY: stretchY },
                ],
              },
            ]}
          >
            {/* soft top sheen for a glassy look */}
            <View style={styles.indicatorSheen} />
          </Animated.View>
        )}

        {visibleRoutes.map(
          (route: { key: string; name: TabName }, i: number) => {
            const routeIndex = state.routes.findIndex(
              (entry: { key: string }) => entry.key === route.key,
            );
            const focused = state.index === routeIndex;
            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };
            return (
              <TabItem
                key={route.key}
                index={i}
                name={route.name}
                focused={focused}
                position={position}
                onPress={onPress}
              />
            );
          },
        )}
      </View>

      <Pressable
        accessibilityLabel="Open profile"
        onPress={() => router.push(token ? "/profile" : "/sign-in")}
        onPressIn={() =>
          Animated.spring(profileScale, {
            toValue: 0.88,
            speed: 60,
            bounciness: 0,
            useNativeDriver: true,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(profileScale, {
            toValue: 1,
            speed: 24,
            bounciness: 14,
            useNativeDriver: true,
          }).start()
        }
      >
        <Animated.View
          style={[styles.profileButton, { transform: [{ scale: profileScale }] }]}
        >
          <SymbolView
            name={{
              ios: "person.crop.circle.fill",
              android: "account_circle",
              web: "account_circle",
            }}
            size={30}
            tintColor="#FFFFFF"
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bottomArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: "transparent",
  },
  tabPill: {
    flex: 1,
    height: 56,
    padding: PILL_PAD,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  indicator: {
    position: "absolute",
    top: PILL_PAD,
    bottom: PILL_PAD,
    left: PILL_PAD,
    borderRadius: 26,
    backgroundColor: "rgba(255,222,196,0.8)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
    overflow: "hidden",
  },
  indicatorSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "45%",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  tabItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: { width: 24, height: 24, marginBottom: 2 },
  iconLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: { color: INK, fontSize: 10, fontWeight: "800" },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F09148",
    alignItems: "center",
    justifyContent: "center",
  },
});