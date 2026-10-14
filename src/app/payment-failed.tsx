import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { usePayuPayment } from "@/lib/use-payu-payment";

export default function PaymentFailedScreen() {
  const { orderId, total, itemName, status } = useLocalSearchParams<{
    orderId?: string;
    total?: string;
    itemName?: string;
    status?: string;
  }>();
  const payu = usePayuPayment();
  const pending = status === "INITIATED" || status === "PENDING" || !status;

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.body}>
        <View style={s.iconWrap}>
          <Ionicons name="close" size={44} color="#fff" />
        </View>
        <ThemedText style={s.title}>
          {pending ? "Payment not completed" : "Payment failed"}
        </ThemedText>
        <ThemedText style={s.sub}>
          {pending
            ? "We didn't receive a confirmation for your payment."
            : "Your payment could not be processed."}{" "}
          Your order is saved. If money was deducted, please contact the store.
        </ThemedText>
        {!!total && <ThemedText style={s.amount}>₹{total}</ThemedText>}
        <ThemedText style={s.note}>
          Unpaid orders are cancelled automatically after 30 minutes.
        </ThemedText>
      </View>

      <View style={s.actions}>
        {!!orderId && (
          <Pressable
            style={s.primary}
            onPress={() =>
              void payu.start(String(orderId), String(total ?? ""), String(itemName ?? "Order"))
            }
          >
            <ThemedText style={s.primaryText}>Retry payment</ThemedText>
          </Pressable>
        )}
        <Pressable style={s.outline} onPress={() => router.replace("/orders" as any)}>
          <ThemedText style={s.outlineText}>View my orders</ThemedText>
        </Pressable>
      </View>
      {payu.element}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F2F2F2", padding: 24 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#E53935",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: { color: "#17211D", fontSize: 24, fontWeight: "800" },
  sub: { color: "#748078", fontSize: 14, textAlign: "center", lineHeight: 21 },
  amount: { color: "#17211D", fontSize: 22, fontWeight: "900", marginTop: 4 },
  note: { color: "#999", fontSize: 12, textAlign: "center" },
  actions: { gap: 12 },
  primary: {
    height: 54,
    borderRadius: 27,
    backgroundColor: "#f19c87",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  outline: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: "#17211D",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: { color: "#17211D", fontSize: 15, fontWeight: "800" },
});






























