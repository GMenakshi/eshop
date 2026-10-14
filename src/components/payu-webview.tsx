import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { ThemedText } from "@/components/themed-text";

export type PayuPayment = {
  paymentUrl: string;
  payuParams: Record<string, string>;
};

const escapeHtml = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildHtml = (paymentUrl: string, params: Record<string, string>) => `
<!DOCTYPE html>
<html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body onload="document.forms[0].submit()">
    <form method="POST" action="${escapeHtml(paymentUrl)}">
      ${Object.entries(params)
        .map(
          ([k, v]) =>
            `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}" />`,
        )
        .join("")}
    </form>
    <p style="text-align:center;margin-top:40px;font-family:sans-serif">
      Redirecting to payment...
    </p>
  </body>
</html>`;

const queryParam = (url: string, key: string) => {
  const match = url.match(new RegExp(`[?&]${key}=([^&#]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

export function PayuWebView({
  payment,
  onDone,
  onCancel,
}: {
  payment: PayuPayment;
  onDone: (result: {
    status: string | null;
    orderId: string | null;
    txnid: string | null;
  }) => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const finished = useRef(false);

  const handleNavigation = (req: { url: string }) => {
    const url = req.url;

    // backend redirect: .../payment/result?status=..&orderId=..&txnid=..
    if (url.includes("/payment/result")) {
      if (!finished.current) {
        finished.current = true;
        onDone({
          status: queryParam(url, "status"),
          orderId: queryParam(url, "orderId"),
          txnid: queryParam(url, "txnid"),
        });
      }
      return false;
    }

    // UPI apps (GPay / PhonePe / Paytm): hand off to the system
    if (!/^(https?:|about:|data:)/i.test(url)) {
      Linking.openURL(url).catch(() =>
        Alert.alert("App not found", "Please use another payment option."),
      );
      return false;
    }
    return true;
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} hitSlop={10}>
            <ThemedText style={styles.close}>✕ Cancel</ThemedText>
          </Pressable>
        </View>
        <WebView
          originWhitelist={["*"]}
          source={{
            html: buildHtml(payment.paymentUrl, payment.payuParams),
            baseUrl: payment.paymentUrl,
          }}
          onShouldStartLoadWithRequest={handleNavigation}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
        />
        {loading && <ActivityIndicator size="large" style={styles.loader} />}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  close: { fontSize: 16, color: "#D32F2F", fontWeight: "700" },
  loader: { position: "absolute", top: "50%", alignSelf: "center" },
});