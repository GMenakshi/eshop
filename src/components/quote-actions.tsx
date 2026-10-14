import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store-context";

export function QuoteActions({
  orderId,
  orderNumber,
  total,
  onDone,
}: {
  orderId: string;
  orderNumber?: string;
  total?: number;
  onDone: () => void;
}) {
  const { token } = useAuth();
  const { activeStore } = useStore();
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);

  const respond = (accepted: boolean) => {
    if (!token) return;
    Alert.alert(
      accepted ? "Accept price?" : "Decline price?",
      accepted
        ? `Accept the estimate of ₹${total ?? ""}?`
        : "The store will be asked to send a new estimate.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: accepted ? "Accept" : "Decline",
          style: accepted ? "default" : "destructive",
          onPress: async () => {
            setBusy(accepted ? "accept" : "reject");
            try {
              await api.respondToQuote(token, orderId, accepted);
              onDone();
            } catch (e) {
              Alert.alert(
                "Could not send response",
                e instanceof Error ? e.message : "Please try again.",
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const openWhatsApp = () => {
    const digits = String(activeStore?.phone ?? "").replace(/\D/g, "");
    if (!digits) {
      Alert.alert("Not available", "This store has no WhatsApp number.");
      return;
    }
    const full = digits.length === 10 ? `91${digits}` : digits;
    const text = encodeURIComponent(
      `Hi, about my order #${orderNumber ?? ""} price estimate`,
    );
    Linking.openURL(`https://wa.me/${full}?text=${text}`).catch(() =>
      Alert.alert("Could not open WhatsApp"),
    );
  };

  return (
    <View style={styles.wrap}>
      {typeof total === "number" && (
        <ThemedText style={styles.total}>
          Estimated price: ₹{total.toFixed(2)}
        </ThemedText>
      )}
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, styles.accept]}
          disabled={!!busy}
          onPress={() => respond(true)}
        >
          {busy === "accept" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.btnText}>ACCEPT</ThemedText>
          )}
        </Pressable>
        <Pressable
          style={[styles.btn, styles.reject]}
          disabled={!!busy}
          onPress={() => respond(false)}
        >
          {busy === "reject" ? (
            <ActivityIndicator color="#E53935" />
          ) : (
            <ThemedText style={styles.rejectText}>REJECT</ThemedText>
          )}
        </Pressable>
      </View>
      <Pressable style={styles.wa} onPress={openWhatsApp}>
        <ThemedText style={styles.btnText}>CONTACT ON WHATSAPP</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#FFF8E1",
    borderRadius: 16,
    padding: 14,
    gap: 10,
    marginBottom: 14,
  },
  total: { fontSize: 16, fontWeight: "800", color: "#17211D" },
  row: { flexDirection: "row", gap: 10 },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  accept: { backgroundColor: "#22A45D" },
  reject: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E53935" },
  wa: {
    height: 46,
    borderRadius: 23,
    backgroundColor: "#25D366",
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  rejectText: {
    color: "#E53935",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
});