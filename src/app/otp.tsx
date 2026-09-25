import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { api } from "@/lib/api";
import { goBackOrHome } from "@/lib/navigation";

const ink = "#17211D";
const muted = "#748078";

export default function OtpScreen() {
  const { email = "" } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (!email || code.length < 4)
      return Alert.alert("Enter your code", "Type the OTP from your email.");
    setLoading(true);
    try {
      await api.verifyOtp(email, code);
      router.replace({ pathname: "/sign-in", params: { email } });
    } catch (error) {
      Alert.alert(
        "Verification failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Pressable
          accessibilityLabel="Go back"
          onPress={goBackOrHome}
          style={styles.backButton}
        >
          <ThemedText style={styles.backText}>Back</ThemedText>
        </Pressable>
        <ThemedText style={styles.eyebrow}>VERIFY YOUR ACCOUNT</ThemedText>
        <ThemedText style={styles.title}>One last{`\n`}check.</ThemedText>
        <ThemedText style={styles.subtitle}>
          Enter the six-digit code we sent to your email address.
        </ThemedText>
        <TextInput
          autoFocus
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000000"
          placeholderTextColor="#9AA49C"
          style={styles.codeInput}
          value={code}
          onChangeText={setCode}
        />
        <Pressable
          disabled={loading}
          onPress={verify}
          style={styles.primaryButton}
        >
          {loading ? (
            <ActivityIndicator color="#F4F4ED" />
          ) : (
            <ThemedText style={styles.primaryText}>VERIFY CODE</ThemedText>
          )}
        </Pressable>
        <Pressable onPress={() => setCode("")} style={styles.resend}>
          <ThemedText style={styles.resendText}>Resend code</ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F4ED" },
  content: { flex: 1, padding: 24 },
  backButton: { alignSelf: "flex-start", marginBottom: 42 },
  backText: {
    color: ink,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  eyebrow: {
    color: muted,
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: "700",
    marginBottom: 18,
  },
  title: {
    color: ink,
    fontSize: 44,
    lineHeight: 43,
    fontWeight: "800",
    letterSpacing: -1.4,
  },
  subtitle: {
    color: muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 18,
    maxWidth: 310,
  },
  codeInput: {
    height: 64,
    borderBottomWidth: 1,
    borderBottomColor: "#B9C7B9",
    color: ink,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 12,
    marginTop: 42,
    paddingHorizontal: 8,
  },
  primaryButton: {
    height: 52,
    backgroundColor: ink,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
  },
  primaryText: {
    color: "#F4F4ED",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.2,
  },
  resend: { alignSelf: "center", marginTop: 24 },
  resendText: { color: ink, fontSize: 14, fontWeight: "700" },
});
