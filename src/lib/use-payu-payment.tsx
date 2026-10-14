import { router } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, StyleSheet, View } from "react-native";

import { PayuWebView, type PayuPayment } from "@/components/payu-webview";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";

type Info = { id: string; total: string; name: string };

export function usePayuPayment() {
  const { token } = useAuth();
  const [payment, setPayment] = useState<PayuPayment | null>(null);
  const [verifying, setVerifying] = useState(false);
  const info = useRef<Info | null>(null);

  const start = async (id: string, total: string, name: string) => {
    if (!token) return;
    info.current = { id, total, name };
    try {
      const data = await api.initiatePayment(token, id);
      setPayment({ paymentUrl: data.paymentUrl, payuParams: data.payuParams });
    } catch (e) {
      Alert.alert(
        "Payment could not start",
        `${e instanceof Error ? e.message : "Please try again."} Your order is saved. You can pay from the Orders page.`,
      );
      router.replace("/orders" as any);
    }
  };

  // always verify with the server; never trust the redirect URL
  const finish = async (cancelled: boolean) => {
    const i = info.current;
    setPayment(null);
    if (!token || !i) return;
    setVerifying(true);
    try {
      let status = "";
      // PayU can confirm a few seconds late, so re-check unless the user cancelled
      for (let n = 0; n < (cancelled ? 1 : 4); n++) {
        const res = await api.verifyPayment(token, i.id);
        status = res.order?.paymentStatus ?? "";
        if (status === "PAID" || status === "FAILED") break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      setVerifying(false);
      if (status === "PAID") {
        router.replace({
          pathname: "/order-success" as any,
          params: { orderId: i.id, total: i.total, itemName: i.name, paid: "1" },
        });
      } else {
        router.replace({
          pathname: "/payment-failed" as any,
          params: { orderId: i.id, total: i.total, itemName: i.name, status },
        });
      }
    } catch {
      setVerifying(false);
      Alert.alert(
        "Could not confirm payment",
        "Please check your Orders page for the status.",
      );
      router.replace("/orders" as any);
    }
  };

  const element = (
    <>
      {payment && (
        <PayuWebView
          payment={payment}
          onDone={() => void finish(false)}
          onCancel={() => void finish(true)}
        />
      )}
      <Modal visible={verifying} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <ActivityIndicator size="large" color="#f19c87" />
            <ThemedText style={styles.title}>Confirming your payment</ThemedText>
            <ThemedText style={styles.sub}>
              Please don't close the app. This takes a few seconds.
            </ThemedText>
          </View>
        </View>
      </Modal>
    </>
  );

  return { start, element };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  title: { color: "#17211D", fontSize: 18, fontWeight: "800" },
  sub: { color: "#748078", fontSize: 13, textAlign: "center" },
});