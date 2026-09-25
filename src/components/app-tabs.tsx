import { Tabs, router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FloatingCart } from "@/components/floating-cart";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";

export default function AppTabs() {
  return (
    <>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="explore" options={{ title: "Categories" }} />
        <Tabs.Screen name="cart" options={{ href: null }} />
        <Tabs.Screen name="orders" options={{ title: "Orders" }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
      <FloatingCart />
    </>
  );
}

const tabIcons = {
  index: { ios: "house.fill", android: "home", web: "home" },
  explore: {
    ios: "square.grid.3x3.fill",
    android: "apps",
    web: "apps",
  },
  cart: { ios: "bag.fill", android: "shopping_cart", web: "shopping_cart" },
  orders: {
    ios: "shippingbox.fill",
    android: "inventory",
    web: "inventory",
  },
} as const;

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const visibleRoutes = state.routes.filter(
    (route: { name: string }) =>
      route.name !== "profile" && route.name !== "cart",
  );

  return (
    <View
      style={[styles.bottomArea, { paddingBottom: Math.max(insets.bottom, 8) }]}
    >
      <View style={styles.tabPill}>
        {visibleRoutes.map(
          (route: { key: string; name: keyof typeof tabIcons }) => {
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
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
                onPress={onPress}
                style={[styles.tabItem, focused && styles.tabItemActive]}
              >
                <SymbolView
                  name={tabIcons[route.name]}
                  size={22}
                  tintColor={focused ? "#17211D" : "#26352E"}
                />
                {route.name !== "index" && (
                  <ThemedText
                    style={[styles.tabLabel, focused && styles.tabLabelActive]}
                  >
                    {route.name === "explore"
                      ? "Categories"
                      : route.name.charAt(0).toUpperCase() +
                        route.name.slice(1)}
                  </ThemedText>
                )}
              </Pressable>
            );
          },
        )}
      </View>
      <Pressable
        accessibilityLabel="Open profile"
        onPress={() => router.push(token ? "/profile" : "/sign-in")}
        style={styles.profileButton}
      >
        <SymbolView
          name={{
            ios: "person.crop.circle.fill",
            android: "account_circle",
            web: "account_circle",
          }}
          size={34}
          tintColor="#FFFFFF"
        />
        {/* <ThemedText style={styles.profileLabel}>Profile</ThemedText> */}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: "rgba(244, 244, 237, 0.65)",
    backdropFilter: "blur(20px)",
  },
  tabPill: {
    flex: 1,
    minHeight: 66,
    padding: 5,
    borderRadius: 38,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(215, 224, 214, 0.5)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  tabItem: {
    minWidth: 64,
    minHeight: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 7,
  },
  tabItemActive: { backgroundColor: "#E8EFE7" },
  tabLabel: { color: "#526057", fontSize: 10, fontWeight: "700" },
  tabLabelActive: { color: "#3bb585", fontWeight: "900" },
  profileButton: {
    width: 56,
    height: 56,
    borderRadius: 38,
    backgroundColor: "#210263",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  profileLabel: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
});
