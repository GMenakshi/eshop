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

const ink = "#17211D";
const muted = "#748078";
const field = "#E4ECE4";

export default function SignInScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { signIn } = useAuth();
  const [email, setEmail] = useState(emailParam ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password)
      return Alert.alert("Missing details", "Enter your email and password.");
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/profile");
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
    <SafeAreaView style={styles.screen}>
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
            <ThemedText style={styles.backText}>Back</ThemedText>
          </Pressable>
          <ThemedText style={styles.eyebrow}>ESHOP / ACCOUNT</ThemedText>
          <ThemedText style={styles.title}>Welcome{`\n`}back.</ThemedText>
          <ThemedText style={styles.subtitle}>
            Sign in to track orders and save your essentials.
          </ThemedText>
          <View style={styles.form}>
            <ThemedText style={styles.label}>EMAIL</ThemedText>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={muted}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
            <ThemedText style={styles.label}>PASSWORD</ThemedText>
            <TextInput
              secureTextEntry
              placeholder="Enter your password"
              placeholderTextColor={muted}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              disabled={loading}
              onPress={handleSignIn}
              style={styles.primaryButton}
            >
              {loading ? (
                <ActivityIndicator color="#F4F4ED" />
              ) : (
                <ThemedText style={styles.primaryText}>SIGN IN</ThemedText>
              )}
            </Pressable>
          </View>
          <View style={styles.footerRow}>
            <ThemedText style={styles.footerText}>New to ESHOP?</ThemedText>
            <Pressable onPress={() => router.push("/create-account")}>
              <ThemedText style={styles.link}>Create account</ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F4ED" },
  keyboard: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingBottom: 48 },
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
    maxWidth: 300,
  },
  form: { gap: 10, marginTop: 38 },
  label: {
    color: muted,
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "700",
    marginTop: 8,
  },
  input: {
    height: 52,
    backgroundColor: field,
    borderRadius: 3,
    paddingHorizontal: 15,
    color: ink,
    fontSize: 15,
  },
  primaryButton: {
    height: 52,
    backgroundColor: ink,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  primaryText: {
    color: "#F4F4ED",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.2,
  },
  footerRow: {
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    marginTop: 28,
  },
  footerText: { color: muted, fontSize: 14 },
  link: { color: ink, fontSize: 14, fontWeight: "800" },
});
