import { router } from "expo-router";
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
import { api } from "@/lib/api";
import { goBackOrHome } from "@/lib/navigation";

const ink = "#17211D";
const muted = "#748078";
const field = "#E4ECE4";

export default function CreateAccountScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateAccount = async () => {
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();

    if (!cleanName || !cleanEmail || !password) {
      return Alert.alert("Missing details", "Complete all fields to continue.");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return Alert.alert("Invalid email", "Enter a valid email address.");
    }

    if (cleanPhone && cleanPhone.length < 10) {
      return Alert.alert(
        "Invalid phone",
        "Phone number must be at least 10 digits.",
      );
    }

    setLoading(true);
    try {
      await api.signUp({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone || undefined,
        password,
        confirmPassword: password,
      });
      router.push({ pathname: "/otp", params: { email: cleanEmail } });
    } catch (error) {
      Alert.alert(
        "Could not create account",
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
          <ThemedText style={styles.eyebrow}>ESHOP/ ACCOUNT</ThemedText>
          <ThemedText style={styles.title}>Make it{`\n`}official.</ThemedText>
          <ThemedText style={styles.subtitle}>
            Create an account for faster checkout and order tracking.
          </ThemedText>
          <View style={styles.form}>
            <ThemedText style={styles.label}>FULL NAME</ThemedText>
            <TextInput
              autoCapitalize="words"
              placeholder="Your name"
              placeholderTextColor={muted}
              style={styles.input}
              value={name}
              onChangeText={setName}
            />
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
            <ThemedText style={styles.label}>PHONE</ThemedText>
            <TextInput
              autoCapitalize="none"
              keyboardType="phone-pad"
              placeholder="+1 234 567 890"
              placeholderTextColor={muted}
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
            />
            <ThemedText style={styles.label}>PASSWORD</ThemedText>
            <TextInput
              secureTextEntry
              placeholder="Create a password"
              placeholderTextColor={muted}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              disabled={loading}
              onPress={handleCreateAccount}
              style={styles.primaryButton}
            >
              {loading ? (
                <ActivityIndicator color="#F4F4ED" />
              ) : (
                <ThemedText style={styles.primaryText}>
                  CREATE ACCOUNT
                </ThemedText>
              )}
            </Pressable>
          </View>
          <View style={styles.footerRow}>
            <ThemedText style={styles.footerText}>
              Already have an account?
            </ThemedText>
            <Pressable onPress={() => router.replace("/sign-in")}>
              <ThemedText style={styles.link}>Sign in</ThemedText>
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
  form: { gap: 10, marginTop: 30 },
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
