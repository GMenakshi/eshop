import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { goBackOrHome } from "@/lib/navigation";

const addresses = [
  {
    label: "Home",
    detail: "148 Orchard St, Brooklyn, NY 11201",
    default: true,
  },
  {
    label: "Office",
    detail: "10 Hudson Yards, New York, NY 10001",
    default: false,
  },
  {
    label: "Parents",
    detail: "87 Main St, Jersey City, NJ 07302",
    default: false,
  },
];

export default function AddressScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <ThemedText style={styles.eyebrow}>ESHOP / DELIVERY</ThemedText>
            <ThemedText style={styles.title}>Choose address</ThemedText>
          </View>
          <Pressable onPress={goBackOrHome}>
            <ThemedText style={styles.close}>Done</ThemedText>
          </Pressable>
        </View>

        <View style={styles.list}>
          {addresses.map((item) => (
            <Pressable key={item.label} style={styles.addressCard}>
              <View style={styles.row}>
                <ThemedText style={styles.label}>{item.label}</ThemedText>
                {item.default && (
                  <View style={styles.badge}>
                    <ThemedText style={styles.badgeText}>Default</ThemedText>
                  </View>
                )}
              </View>
              <ThemedText style={styles.detail}>{item.detail}</ThemedText>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.addButton}>
          <ThemedText style={styles.addButtonText}>
            + ADD NEW ADDRESS
          </ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F4ED" },
  content: { flex: 1, padding: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 28,
  },
  eyebrow: {
    color: "#748078",
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: "700",
    marginBottom: 14,
  },
  title: {
    color: "#17211D",
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "800",
    letterSpacing: -1.2,
  },
  close: {
    color: "#17211D",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  list: {
    gap: 14,
  },
  addressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E7E1",
    padding: 18,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    color: "#17211D",
    fontSize: 16,
    fontWeight: "800",
  },
  badge: {
    backgroundColor: "#E8EFE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: "#17211D",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  detail: {
    color: "#526057",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  addButton: {
    marginTop: 24,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#17211D",
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    color: "#F4F4ED",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
});
