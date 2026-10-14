import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";

const ink = "#17211D";
const brand = "#f19c87";

export function StoreUnavailable() {
  return (
    <View style={styles.screen}>
      <View style={styles.iconCircle}>
        <Ionicons name="storefront-outline" size={52} color={brand} />
        <View style={styles.badge}>
          <Ionicons name="close" size={16} color="#FFFFFF" />
        </View>
      </View>
      <ThemedText style={styles.title}>
        The store no more exists in the app
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
    backgroundColor: "#F2F2F2",
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#FFF5F2",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e29190",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#F2F2F2",
  },
  title: {
    color: ink,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
});