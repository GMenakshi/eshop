import { Ionicons } from "@expo/vector-icons";
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
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";
import { takePendingSignup } from "@/lib/pending-signup";
import { goBackOrHome } from "@/lib/navigation";

const ink = "#17211D";
const muted = "#748078";

export default function OtpScreen() {
  const { email = "" } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const verify = async () => {
    if (!email || code.length < 4)
      return Alert.alert("Enter your code", "Type the OTP from your email.");
    setLoading(true);
    try {
      await api.verifyOtp(email, code);
      const pending = takePendingSignup(email);
      if (pending) {
        try {
          await signIn(pending.email, pending.password);
          router.replace("/(tabs)");
          return;
        } catch {
          // Auto-login failed, so fall back to the normal sign-in page
        }
      }
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
          <Ionicons name="arrow-back" size={21} color="#C7C7C7" />
        </Pressable>
        <ThemedText style={styles.title}>Verification Code</ThemedText>
        <ThemedText style={styles.subtitle}>
          We have sent the verification code to your email address
        </ThemedText>

        <View style={styles.codeRow}>
          {Array.from({ length: 6 }, (_, index) => (
            <View
              key={index}
              style={[
                styles.codeCell,
                index === Math.min(code.length, 5) && styles.codeCellActive,
              ]}
              pointerEvents="none"
            >
              <ThemedText style={styles.codeDigit}>
                {code[index] ?? ""}
              </ThemedText>
            </View>
          ))}
          <TextInput
            autoFocus
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            accessibilityLabel="Verification code"
            caretHidden
            selectionColor="transparent"
            style={styles.codeInputOverlay}
            value={code}
            onChangeText={setCode}
          />
        </View>

        <Pressable
          disabled={loading}
          onPress={verify}
          style={styles.primaryButton}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.primaryText}>Confirm</ThemedText>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4DCCB" },
  content: {
    flex: 1,
    marginHorizontal: 1,
    paddingHorizontal: 27,
    paddingTop: 10,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  title: {
    color: "#333333",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 32,
  },
  subtitle: {
    color: "#A8A8A8",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    maxWidth: 270,
  },
  codeRow: {
    position: "relative",
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 9,
    marginTop: 32,
  },
  codeCell: {
    flex: 1,
    maxWidth: 54,
    height: 51,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E3E3E3",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  codeCellActive: {
    borderColor: "#FF925D",
  },
  codeDigit: {
    color: "#797979",
    fontSize: 17,
    fontWeight: "700",
  },
  codeInputOverlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.02,
    color: "transparent",
    fontSize: 1,
    padding: 0,
  },
  primaryButton: {
    height: 51,
    backgroundColor: "#FF8248",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
    shadowColor: "#E96836",
    shadowOpacity: 0.18,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
