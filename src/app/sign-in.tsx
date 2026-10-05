import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
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
import { goBackOrHome } from "@/lib/navigation";

const ink = "#1C1B1F";
const muted = "#8A8A93";
const inputBg = "#F5F5F7";
const primaryBlue = "#3D6DF2";

export default function SignInScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { signIn } = useAuth();
  const [email, setEmail] = useState(emailParam ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password)
      return Alert.alert("Missing details", "Enter your email and password.");
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/");
    } catch (error) {
      Alert.alert(
        "Sign in failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#FDEBD6", "#F5E1EC", "#E9E3F7", "#E3E0F5"]}
      locations={[0, 0.35, 0.7, 1]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.screen}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior="padding" style={styles.keyboard}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              accessibilityLabel="Go back"
              onPress={goBackOrHome}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={22} color={ink} />
            </Pressable>

            <View style={styles.card}>
              <View style={styles.iconBadge}>
                <Ionicons name="shield-checkmark" size={26} color="#FFFFFF" />
              </View>

              <ThemedText style={styles.title}>Login</ThemedText>
              <ThemedText style={styles.subtitle}>
                Enter your email and password to log in
              </ThemedText>

              <View style={styles.form}>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="abc1234@gmail.com"
                  placeholderTextColor={muted}
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                />

                <View style={styles.passwordWrap}>
                  <TextInput
                    secureTextEntry={!showPassword}
                    placeholder="••••••"
                    placeholderTextColor={muted}
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    accessibilityLabel="Toggle password visibility"
                    hitSlop={10}
                  >
                    <Ionicons
                      name={showPassword ? "eye" : "eye-off"}
                      size={20}
                      color={muted}
                    />
                  </Pressable>
                </View>

                <View style={styles.optionsRow}>
                  <Pressable
                    style={styles.rememberRow}
                    onPress={() => setRememberMe((v) => !v)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        rememberMe && styles.checkboxChecked,
                      ]}
                    >
                      {rememberMe && (
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      )}
                    </View>
                    <ThemedText style={styles.rememberText}>
                      Remember me
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      router.push({
                        pathname: "/forgot-password" as any,
                        params: { email: email.trim() },
                      })
                    }
                  >
                    <ThemedText style={styles.forgotText}>
                      Forgot Password ?
                    </ThemedText>
                  </Pressable>
                </View>

                <Pressable
                  disabled={loading}
                  onPress={handleSignIn}
                  style={styles.primaryButton}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.primaryText}>Log In</ThemedText>
                  )}
                </Pressable>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <ThemedText style={styles.dividerText}>
                    Or login with
                  </ThemedText>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.socialRow}>
                  <Pressable style={styles.socialButton}>
                    <FontAwesome name="google" size={20} color="#EA4335" />
                  </Pressable>
                  <Pressable style={styles.socialButton}>
                    <FontAwesome name="facebook" size={20} color="#1877F2" />
                  </Pressable>
                  <Pressable style={styles.socialButton}>
                    <FontAwesome name="apple" size={22} color="#000000" />
                  </Pressable>
                  <Pressable style={styles.socialButton}>
                    <Ionicons
                      name="phone-portrait-outline"
                      size={20}
                      color={ink}
                    />
                  </Pressable>
                </View>
              </View>

              <View style={styles.footerRow}>
                <ThemedText style={styles.footerText}>
                  Don&apos;t have an account?
                </ThemedText>
                <Pressable onPress={() => router.push("/create-account")}>
                  <ThemedText style={styles.link}> Sign Up</ThemedText>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  keyboard: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
    paddingBottom: 48,
  },
  backButton: {
    position: "absolute",
    top: 8,
    left: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: "center",
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(245, 185, 121, 1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: ink,
  },
  subtitle: {
    fontSize: 13,
    color: muted,
    marginTop: 6,
    textAlign: "center",
  },
  form: {
    width: "100%",
    marginTop: 24,
    gap: 12,
  },
  input: {
    height: 52,
    backgroundColor: inputBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    color: ink,
    fontSize: 14,
  },
  passwordWrap: {
    height: 52,
    backgroundColor: inputBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  passwordInput: {
    flex: 1,
    color: ink,
    fontSize: 14,
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#C6C6CC",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "rgba(255, 132, 0, 1)",
    borderColor: "rgba(76, 76, 75, 0.7)",
  },
  rememberText: {
    fontSize: 13,
    color: ink,
  },
  forgotText: {
    fontSize: 13,
    color: "rgba(255, 132, 0, 1)",
    fontWeight: "600",
  },
  primaryButton: {
    height: 54,
    backgroundColor: "#f7c8a5ff",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryText: {
    color: "#000000ff",
    fontSize: 16,
    fontWeight: "700",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E5",
  },
  dividerText: {
    fontSize: 12,
    color: muted,
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 4,
  },
  socialButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(0,0,0,0.08)",
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: { color: muted, fontSize: 13 },
  link: { color: "rgba(255, 132, 0, 1)", fontSize: 13, fontWeight: "700" },
});