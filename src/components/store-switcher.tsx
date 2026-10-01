import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useStore } from "@/lib/store-context";

export function StoreSwitcher() {
  const { stores, storeId, switchStore } = useStore();
  if (stores.length < 2) return null;

  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.heading}>MY STORES</ThemedText>
      {stores.map((s) => {
        const active = s.id === storeId;
        return (
          <Pressable
            key={s.id}
            style={[styles.row, active && styles.rowActive]}
            onPress={async () => {
              if (active) return;
              await switchStore(s.id);
              router.replace("/(tabs)");
            }}
          >
            <ThemedText style={[styles.name, active && styles.nameActive]}>
              {s.name ?? s.id}
            </ThemedText>
            {active && <ThemedText style={styles.badge}>Active</ThemedText>}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginVertical: 16 },
  heading: { color: "#999", fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E4DC",
  },
  rowActive: { borderColor: "#E8875C" },
  name: { color: "#17211D", fontWeight: "600" },
  nameActive: { fontWeight: "800" },
  badge: { color: "#E8875C", fontWeight: "700" },
});