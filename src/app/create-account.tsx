import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { api } from "@/lib/api";
import { setPendingSignup } from "@/lib/pending-signup";
import { goBackOrHome } from "@/lib/navigation";

const ink = "#1C1B1F";
const muted = "#8A8A93";
const inputBg = "#F5F5F7";
const primaryBlue = "#3D6DF2";

export default function CreateAccountScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [dobDate, setDobDate] = useState<Date>(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const formatDate = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  };

  const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(false);
    if (event.type === "dismissed" || !selected) return;
    setDobDate(selected);
    setDob(formatDate(selected));
  };

  const handleCreateAccount = async () => {
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanName = `${cleanFirstName} ${cleanLastName}`.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();

    if (!cleanFirstName || !cleanLastName || !cleanEmail || !password) {
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
      setPendingSignup(cleanEmail, password);
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
              <ThemedText style={styles.title}>Sign Up</ThemedText>
              <ThemedText style={styles.subtitle}>
                Create an account to continue!
              </ThemedText>

              <View style={styles.form}>
                <TextInput
                  autoCapitalize="words"
                  placeholder="First name"
                  placeholderTextColor={muted}
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                />
                <TextInput
                  autoCapitalize="words"
                  placeholder="Last name"
                  placeholderTextColor={muted}
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                />
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="abc1234@gmail.com"
                  placeholderTextColor={muted}
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                />

                <Pressable
                  style={styles.dobWrap}
                  onPress={() => setShowDatePicker(true)}
                >
                  <TextInput
                    placeholder="DOB - 18/03/2024"
                    placeholderTextColor={muted}
                    style={styles.dobInput}
                    value={dob}
                    editable={false}
                    pointerEvents="none"
                  />
                  <Ionicons name="calendar-outline" size={18} color={muted} />
                </Pressable>

                {showDatePicker && (
                  <DateTimePicker
                    value={dobDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    maximumDate={new Date()}
                    onChange={onDateChange}
                  />
                )}

                <View style={styles.phoneWrap}>
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="phone-pad"
                    placeholder="Enter phone number"
                    placeholderTextColor={muted}
                    style={styles.phoneInput}
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>

                <View style={styles.passwordWrap}>
                  <TextInput
                    secureTextEntry={!showPassword}
                    placeholder="Create a password"
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

                <Pressable
                  disabled={loading}
                  onPress={handleCreateAccount}
                  style={styles.primaryButton}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.primaryText}>Register</ThemedText>
                  )}
                </Pressable>
              </View>

              <View style={styles.footerRow}>
                <ThemedText style={styles.footerText}>
                  Already have an account?
                </ThemedText>
                <Pressable onPress={() => router.replace("/sign-in")}>
                  <ThemedText style={styles.link}> Login</ThemedText>
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
    paddingTop: 40,
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
  dobWrap: {
    height: 52,
    backgroundColor: inputBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dobInput: {
    flex: 1,
    color: ink,
    fontSize: 14,
  },
  phoneWrap: {
    height: 52,
    backgroundColor: inputBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  phoneInput: {
    flex: 1,
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
  primaryButton: {
    height: 54,
    backgroundColor: "rgba(230, 139, 43, 1)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: { color: muted, fontSize: 13 },
  link: { color: "rgba(255, 132, 0, 1)", fontSize: 13, fontWeight: "700" },
});
