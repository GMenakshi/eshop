import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { API_BASE_URL } from "@/lib/api";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [order, setOrder] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    fetch(`${API_BASE_URL}/order/my-orders/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then(setOrder)
      .catch((e) => setError(e.message));
  }, [token, id]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F4ED" }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {!order && !error && <ActivityIndicator />}
        {error && <ThemedText>{error}</ThemedText>}
        {order != null && <ThemedText>{JSON.stringify(order, null, 2)}</ThemedText>}
      </ScrollView>
    </SafeAreaView>
  );
}