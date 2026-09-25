import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";

const navItems = [
  { label: "Home", icon: { ios: "house.fill", android: "home", web: "home" } },
  {
    label: "Order Again",
    icon: { ios: "bag.fill", android: "shopping_bag", web: "shopping_bag" },
  },
  {
    label: "Categories",
    icon: { ios: "square.grid.2x2.fill", android: "apps", web: "apps" },
  },
  {
    label: "Print",
    icon: { ios: "printer.fill", android: "print", web: "print" },
  },
  {
    label: "district",
    icon: { ios: "location.fill", android: "location_on", web: "location_on" },
  },
] as const;

export function HomeBottomNav() {
  return (
    <View style={styles.bottomNav}>
      {navItems.map((item) => (
        <Pressable key={item.label} style={styles.navItem}>
          <SymbolView
            name={item.icon}
            size={22}
            tintColor={item.label === "Home" ? "#111827" : "#667085"}
          />
          <ThemedText
            style={[
              styles.navText,
              item.label === "Home" && styles.navTextActive,
            ]}
          >
            {item.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 10,
    marginTop: 18,
    backgroundColor: "#f4f2ee",
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  navText: {
    fontSize: 12,
    color: "#667085",
    fontWeight: "700",
  },
  navTextActive: {
    color: "#111827",
  },
});
