import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useStore } from "@/lib/store-context";

function NoStoreAvailable() {
  return (
    <View style={styles.container}>
      <ThemedText style={styles.title}>NO STORE AVAILABLE</ThemedText>
    </View>
  );
}

export default function StoreEntryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { setStoreId, ready, storeId, hasStoreError } = useStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!id || !ready) return;

    let active = true;
    void setStoreId(id).then((success) => {
      if (active) setChecked(true);
      if (active && success) setChecked(true);
    });

    return () => {
      active = false;
    };
  }, [id, ready, setStoreId]);

  if (!ready) return null;
  if (hasStoreError || (checked && !storeId)) return <NoStoreAvailable />;
  if (storeId === id) return <Redirect href="/(tabs)" />;

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F4ED",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#17211D",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
  },
});
