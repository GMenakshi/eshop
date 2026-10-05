import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { API_BASE_URL } from "@/lib/api";
import { goBackOrHome } from "@/lib/navigation";

const ink = "#17211D";
const muted = "#748078";
const accent = "#FF8248";

type Step = "email" | "otp" | "choice" | "password";

async function post(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_BASE_URL}/login/forgot-password/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON response
  }
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message ?? "Something went wrong. Please try again.");
  }
  return json;
}

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { applySession } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(params.email ?? "");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const run = async (task: () => Promise<void>, errorTitle: string) => {
    setLoading(true);
    try {
      await task();
    } catch (error) {
      Alert.alert(
        errorTitle,
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const cleanEmail = email.trim();

  const sendOtp = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return Alert.alert("Invalid email", "Enter a valid email address.");
    }
    void run(async () => {
      await post("send-otp", { email: cleanEmail, role: "USER" });
      setOtp("");
      setCooldown(30);
      setStep("otp");
    }, "Could not send code");
  };

  const verifyOtp = () => {
    if (otp.length < 4) {
      return Alert.alert("Enter your code", "Type the OTP from your email.");
    }
    void run(async () => {
      const json = await post("verify-otp", {
        email: cleanEmail,
        role: "USER",
        otp,
      });
      if (!json?.resetToken) throw new Error("Verification failed.");
      setResetToken(json.resetToken);
      setStep("choice");
    }, "Verification failed");
  };

  const loginDirectly = () =>
    void run(async () => {
      const json = await post("login-with-otp", { resetToken });
      if (!json?.token) throw new Error("Login failed. Please try again.");
      await applySession(json.token, json.user ?? {}, cleanEmail);
      router.dismissAll();
      router.replace("/(tabs)");
    }, "Could not log in");

  const changePassword = () => {
    if (password.length < 6) {
      return Alert.alert(
        "Weak password",
        "Password must be at least 6 characters.",
      );
    }
    if (password !== confirmPassword) {
      return Alert.alert("Passwords don't match", "Re-enter both passwords.");
    }
    void run(async () => {
      const json = await post("reset-password", {
        resetToken,
        password,
        confirmPassword,
      });
      Alert.alert(
        "Password changed",
        json?.message ?? "Please log in with your new password.",
        [
          {
            text: "Log in",
            onPress: () =>
              router.replace({
                pathname: "/sign-in",
                params: { email: cleanEmail },
              }),
          },
        ],
      );
    }, "Could not change password");
  };

  const goBack = () => {
    if (step === "otp") setStep("email");
    else if (step === "choice") setStep("otp");
    else if (step === "password") setStep("choice");
    else goBackOrHome();
  };

  const titles: Record<Step, { title: string; subtitle: string }> = {
    email: {
      title: "Forgot Password",
      subtitle: "Enter your email and we'll send you a verification code.",
    },
    otp: {
      title: "Verification Code",
      subtitle: `We sent a code to ${cleanEmail}`,
    },
    choice: {
      title: "Code verified",
      subtitle: "How would you like to continue?",
    },
    password: {
      title: "New Password",
      subtitle: "Choose a new password for your account.",
    },
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topRow}>
            <Pressable
              onPress={goBack}
              hitSlop={10}
              accessibilityLabel="Back"
              style={styles.iconBtn}
            >
              <Ionicons name="arrow-back" size={21} color={ink} />
            </Pressable>
            <Pressable
              onPress={goBackOrHome}
              hitSlop={10}
              accessibilityLabel="Close"
              style={styles.iconBtn}
            >
              <Ionicons name="close" size={22} color={ink} />
            </Pressable>
          </View>

          <ThemedText style={styles.title}>{titles[step].title}</ThemedText>
          <ThemedText style={styles.subtitle}>
            {titles[step].subtitle}
          </ThemedText>

          {step === "email" && (
            <>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="Email address"
                placeholderTextColor={muted}
                style={styles.input}
                value={email}
                onChangeText={setEmail}
              />
              <Button label="Send code" loading={loading} onPress={sendOtp} />
            </>
          )}

          {step === "otp" && (
            <>
              <TextInput
                autoFocus
                keyboardType="number-pad"
                maxLength={6}
                textContentType="oneTimeCode"
                placeholder="6-digit code"
                placeholderTextColor={muted}
                style={[styles.input, styles.otpInput]}
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, ""))}
              />
              <Button label="Verify" loading={loading} onPress={verifyOtp} />
              <Pressable
                disabled={cooldown > 0 || loading}
                onPress={sendOtp}
                style={styles.linkBtn}
              >
                <ThemedText
                  style={[styles.linkText, cooldown > 0 && { color: muted }]}
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </ThemedText>
              </Pressable>
            </>
          )}

          {step === "choice" && (
            <>
              <Pressable
                disabled={loading}
                onPress={() => setStep("password")}
                style={styles.choiceCard}
              >
                <ThemedText style={styles.choiceTitle}>
                  Change password
                </ThemedText>
                <ThemedText style={styles.choiceDesc}>
                  Set a new password, then log in with it.
                </ThemedText>
              </Pressable>
              <Pressable
                disabled={loading}
                onPress={loginDirectly}
                style={styles.choiceCard}
              >
                {loading ? (
                  <ActivityIndicator color={ink} />
                ) : (
                  <>
                    <ThemedText style={styles.choiceTitle}>
                      Log in directly
                    </ThemedText>
                    <ThemedText style={styles.choiceDesc}>
                      Skip changing your password and go straight in.
                    </ThemedText>
                  </>
                )}
              </Pressable>
            </>
          )}

          {step === "password" && (
            <>
              <View style={styles.passwordWrap}>
                <TextInput
                  secureTextEntry={!showPassword}
                  placeholder="New password"
                  placeholderTextColor={muted}
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  accessibilityLabel="Toggle password visibility"
                >
                  <Ionicons
                    name={showPassword ? "eye" : "eye-off"}
                    size={20}
                    color={muted}
                  />
                </Pressable>
              </View>
              <TextInput
                secureTextEntry={!showPassword}
                placeholder="Confirm new password"
                placeholderTextColor={muted}
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <Button
                label="Change password"
                loading={loading}
                onPress={changePassword}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Button({
  label,
  loading,
  onPress,
}: {
  label: string;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={loading} onPress={onPress} style={styles.primaryBtn}>
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <ThemedText style={styles.primaryText}>{label}</ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { padding: 24, paddingBottom: 48, gap: 14 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  iconBtn: { width: 36, height: 36, justifyContent: "center" },
  title: { color: ink, fontSize: 24, fontWeight: "800" },
  subtitle: { color: muted, fontSize: 14, lineHeight: 20, marginBottom: 10 },
  input: {
    height: 52,
    backgroundColor: "#F5F5F7",
    borderRadius: 14,
    paddingHorizontal: 16,
    color: ink,
    fontSize: 15,
  },
  otpInput: { letterSpacing: 8, fontSize: 20, fontWeight: "700" },
  passwordWrap: {
    height: 52,
    backgroundColor: "#F5F5F7",
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: { flex: 1, color: ink, fontSize: 15 },
  primaryBtn: {
    height: 52,
    borderRadius: 28,
    backgroundColor: accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  linkBtn: { alignItems: "center", paddingVertical: 8 },
  linkText: { color: accent, fontSize: 14, fontWeight: "700" },
  choiceCard: {
    backgroundColor: "#F5F5F7",
    borderRadius: 18,
    padding: 18,
    gap: 4,
    minHeight: 78,
    justifyContent: "center",
  },
  choiceTitle: { color: ink, fontSize: 16, fontWeight: "800" },
  choiceDesc: { color: muted, fontSize: 13, lineHeight: 18 },
});