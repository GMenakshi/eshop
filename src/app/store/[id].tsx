import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useStore } from "@/lib/store-context";

export default function StoreEntryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { joinStore, ready, stores } = useStore();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready || !id) return;
    let active = true;
    setFailed(false);

    joinStore(id)
      .then((ok) => {
        if (!active) return;
        if (ok) router.replace("/(tabs)");
        else setFailed(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
    // joinStore intentionally omitted: it is not memoized and would re-trigger the effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, id, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (!id) return <Redirect href="/(tabs)" />;

  if (failed) {
    return (
      <View style={styles.container}>
        <ThemedText style={styles.title}>NO STORE AVAILABLE</ThemedText>
        <Pressable onPress={retry}>
          <ThemedText style={styles.link}>Try again</ThemedText>
        </Pressable>
        <Pressable onPress={() => router.replace("/(tabs)")}>
          <ThemedText style={styles.link}>
            {stores.length > 0 ? "Back to my stores" : "Go home"}
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator />
      <ThemedText style={styles.hint}>Opening store…</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F4ED",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  title: {
    color: "#17211D",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  link: { color: "#E8875C", fontWeight: "700" },
  hint: { color: "#17211D", opacity: 0.6 },
});