import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { API_BASE_URL } from "@/lib/api";

const getRemarks = (o: any): string => {
  if (!o) return "";
  if (o.status === "CANCELLED") return o.cancelReason?.trim() || "";
  const entry = [...(o.statusHistory ?? [])]
    .reverse()
    .find((h: any) => h.status === "CONFIRMED");
  return entry?.note?.trim() || "";
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [order, setOrder] = useState<any>(null);
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
        {["CONFIRMED", "CANCELLED"].includes(order?.order?.status) &&
          !!getRemarks(order?.order) && (
            <View
              style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 12,
                backgroundColor:
                  order.order.status === "CANCELLED" ? "#FFEBEE" : "#E8F8EF",
              }}
            >
              <ThemedText
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color:
                    order.order.status === "CANCELLED" ? "#D32F2F" : "#22A45D",
                }}
              >
                {order.order.status === "CANCELLED"
                  ? order.order.cancelledBy === "USER"
                    ? "CANCELLED BY YOU"
                    : "REJECTED BY STORE"
                  : "APPROVED BY STORE"}
              </ThemedText>
              <ThemedText style={{ fontSize: 13, marginTop: 4 }}>
                {getRemarks(order.order)}
              </ThemedText>
            </View>
          )}
        {order != null && (
          <ThemedText>{JSON.stringify(order, null, 2)}</ThemedText>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
