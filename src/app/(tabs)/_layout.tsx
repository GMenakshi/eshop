import { StyleSheet, View } from "react-native";

import AppTabs from "@/components/app-tabs";
import { ThemedText } from "@/components/themed-text";
import { useStore } from "@/lib/store-context";

export default function TabsLayout() {
  const { ready, storeId } = useStore();

  if (!ready) return null;

  if (!storeId) {
    return (
      <View style={styles.container}>
        <ThemedText style={styles.text}>
          Open the store link shared by your store to get started.
        </ThemedText>
      </View>
    );
  }
  return <AppTabs />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4ED", alignItems: "center", justifyContent: "center", padding: 24 },
  text: { color: "#17211D", fontSize: 18, fontWeight: "700", textAlign: "center" },
});