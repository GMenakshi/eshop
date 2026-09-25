import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { goBackOrHome } from "@/lib/navigation";

const ink = "#17211D";
const muted = "#748078";

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.container}>
        <ThemedText style={styles.title}>Settings</ThemedText>
        <View style={styles.row}>
          <ThemedText style={styles.label}>Notifications</ThemedText>
          <ThemedText style={styles.value}>Enabled</ThemedText>
        </View>
        <View style={styles.row}>
          <ThemedText style={styles.label}>Dark Mode</ThemedText>
          <ThemedText style={styles.value}>Off</ThemedText>
        </View>
        <View style={styles.row}>
          <ThemedText style={styles.label}>Language</ThemedText>
          <ThemedText style={styles.value}>English</ThemedText>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: ink,
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E8E4",
  },
  label: {
    fontSize: 14,
    color: ink,
    fontWeight: "600",
  },
  value: {
    fontSize: 14,
    color: muted,
    fontWeight: "500",
  },
});
