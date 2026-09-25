import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { api, type ApiAddress } from "@/lib/api";
import { goBackOrHome } from "@/lib/navigation";

const ink = "#17211D";
const muted = "#748078";
const surface = "#E8EFE7";
const border = "#D7E0D6";
const field = "#E4ECE4";

export default function ProfileScreen() {
  const { user, token, refreshUser, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addressForm, setAddressForm] = useState<{
    addressLine: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  }>({
    addressLine: "",
    area: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  });

  useEffect(() => {
    if (!token) {
      router.replace("/sign-in");
      return;
    }
    refreshUser().finally(() => setLoading(false));
  }, [token, refreshUser]);

  const address = user?.address;
  const hasAddress =
    address &&
    (address.addressLine || address.city || address.state || address.pincode);

  const openEditAddress = () => {
    setAddressForm({
      addressLine: address?.addressLine ?? "",
      area: address?.area ?? "",
      city: address?.city ?? "",
      state: address?.state ?? "",
      pincode: address?.pincode ?? "",
      country: address?.country ?? "India",
    });
    setShowAddressModal(true);
  };

  const saveAddress = async () => {
    if (!token) return;
    if (!addressForm.addressLine.trim() || !addressForm.city.trim() || !addressForm.state.trim() || !addressForm.pincode.trim()) {
      return Alert.alert("Incomplete", "Please fill in address, city, state, and pincode.");
    }
    setSaving(true);
    try {
      await api.updateProfile(token, {
        address: {
          addressLine: addressForm.addressLine.trim(),
          area: addressForm.area.trim() || undefined,
          city: addressForm.city.trim(),
          state: addressForm.state.trim(),
          pincode: addressForm.pincode.trim(),
          country: addressForm.country.trim() || "India",
        },
      });
      await refreshUser();
      setShowAddressModal(false);
    } catch (error) {
      Alert.alert(
        "Could not save address",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!token || loading) {
    return null;
  }

  const fullName = user
    ? user.name?.trim() ||
      `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
      "Your profile"
    : "Your profile";
  const initials = user
    ? (() => {
        const source =
          user.name?.trim() ||
          `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
        return (
          source
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join("") || "--"
        );
      })()
    : "--";

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <ThemedText style={styles.eyebrow}>ESHOP / ACCOUNT</ThemedText>
            <ThemedText style={styles.title}>Profile</ThemedText>
          </View>
          <Pressable onPress={goBackOrHome}>
            <ThemedText style={styles.close}>Done</ThemedText>
          </Pressable>
        </View>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>{initials}</ThemedText>
          </View>
          <View>
            <ThemedText style={styles.name}>
              {loading ? "Loading..." : fullName}
            </ThemedText>
            <ThemedText style={styles.email}>{user?.email ?? ""}</ThemedText>
          </View>
        </View>
        <View style={styles.details}>
          <Detail label="EMAIL" value={user?.email ?? "Not available"} />
          <Detail label="PHONE" value={user?.phone ?? "Not available"} />
          <Detail label="ACCOUNT ROLE" value={user?.role ?? "Customer"} />
        </View>

        {/* Delivery Address Section */}
        <View style={styles.addressSection}>
          <View style={styles.addressHeader}>
            <ThemedText style={styles.addressTitle}>Delivery Address</ThemedText>
            <Pressable onPress={openEditAddress}>
              <ThemedText style={styles.addressEditLink}>
                {hasAddress ? "EDIT" : "ADD"}
              </ThemedText>
            </Pressable>
          </View>
          {hasAddress ? (
            <View style={styles.addressCard}>
              <ThemedText style={styles.addressLine}>
                {address.addressLine}
              </ThemedText>
              {address.area ? (
                <ThemedText style={styles.addressSub}>{address.area}</ThemedText>
              ) : null}
              <ThemedText style={styles.addressSub}>
                {[address.city, address.state].filter(Boolean).join(", ")}
                {address.pincode ? ` - ${address.pincode}` : ""}
              </ThemedText>
              <ThemedText style={styles.addressCountry}>
                {address.country ?? "India"}
              </ThemedText>
            </View>
          ) : (
            <Pressable style={styles.addAddressCard} onPress={openEditAddress}>
              <ThemedText style={styles.addAddressPlus}>+</ThemedText>
              <ThemedText style={styles.addAddressText}>
                Add your delivery address
              </ThemedText>
              <ThemedText style={styles.addAddressSub}>
                This will be used for faster checkout
              </ThemedText>
            </Pressable>
          )}
        </View>

        <Pressable style={styles.editButton} onPress={openEditAddress}>
          <ThemedText style={styles.editText}>EDIT DETAILS</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => {
            signOut();
            router.replace("/sign-in");
          }}
          style={styles.signOut}
        >
          <ThemedText style={styles.signOutText}>SIGN OUT</ThemedText>
        </Pressable>
      </ScrollView>

      {/* Address Edit Modal */}
      <Modal
        visible={showAddressModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddressModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                {hasAddress ? "Edit Address" : "Add Address"}
              </ThemedText>
              <Pressable onPress={() => setShowAddressModal(false)}>
                <ThemedText style={styles.modalClose}>✕</ThemedText>
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalForm}
              keyboardShouldPersistTaps="handled"
            >
              <ThemedText style={styles.fieldLabel}>ADDRESS LINE</ThemedText>
              <TextInput
                value={addressForm.addressLine}
                onChangeText={(t) =>
                  setAddressForm((s) => ({ ...s, addressLine: t }))
                }
                placeholder="House no, Street, Area"
                placeholderTextColor={muted}
                style={styles.modalInput}
              />
              <ThemedText style={styles.fieldLabel}>AREA / LANDMARK</ThemedText>
              <TextInput
                value={addressForm.area}
                onChangeText={(t) =>
                  setAddressForm((s) => ({ ...s, area: t }))
                }
                placeholder="Landmark (Optional)"
                placeholderTextColor={muted}
                style={styles.modalInput}
              />
              <View style={styles.modalRow}>
                <View style={styles.modalHalf}>
                  <ThemedText style={styles.fieldLabel}>CITY</ThemedText>
                  <TextInput
                    value={addressForm.city}
                    onChangeText={(t) =>
                      setAddressForm((s) => ({ ...s, city: t }))
                    }
                    placeholder="City"
                    placeholderTextColor={muted}
                    style={styles.modalInput}
                  />
                </View>
                <View style={styles.modalHalf}>
                  <ThemedText style={styles.fieldLabel}>STATE</ThemedText>
                  <TextInput
                    value={addressForm.state}
                    onChangeText={(t) =>
                      setAddressForm((s) => ({ ...s, state: t }))
                    }
                    placeholder="State"
                    placeholderTextColor={muted}
                    style={styles.modalInput}
                  />
                </View>
              </View>
              <View style={styles.modalRow}>
                <View style={styles.modalHalf}>
                  <ThemedText style={styles.fieldLabel}>PINCODE</ThemedText>
                  <TextInput
                    value={addressForm.pincode}
                    onChangeText={(t) =>
                      setAddressForm((s) => ({ ...s, pincode: t }))
                    }
                    placeholder="Pincode"
                    placeholderTextColor={muted}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={styles.modalInput}
                  />
                </View>
                <View style={styles.modalHalf}>
                  <ThemedText style={styles.fieldLabel}>COUNTRY</ThemedText>
                  <TextInput
                    value={addressForm.country}
                    onChangeText={(t) =>
                      setAddressForm((s) => ({ ...s, country: t }))
                    }
                    placeholder="Country"
                    placeholderTextColor={muted}
                    style={styles.modalInput}
                  />
                </View>
              </View>
              <Pressable
                style={[styles.saveButton, saving && { opacity: 0.5 }]}
                disabled={saving}
                onPress={saveAddress}
              >
                <ThemedText style={styles.saveText}>
                  {saving ? "SAVING..." : "SAVE ADDRESS"}
                </ThemedText>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <ThemedText style={styles.value}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F4ED" },
  content: { padding: 24, paddingBottom: 48 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 36,
  },
  eyebrow: {
    color: muted,
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: "700",
    marginBottom: 14,
  },
  title: {
    color: ink,
    fontSize: 42,
    lineHeight: 44,
    fontWeight: "800",
    letterSpacing: -1.4,
  },
  close: {
    color: ink,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ink,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#F4F4ED", fontSize: 20, fontWeight: "800" },
  name: { color: ink, fontSize: 21, fontWeight: "800" },
  email: { color: muted, fontSize: 14, marginTop: 4 },
  details: {
    backgroundColor: surface,
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
    gap: 20,
  },
  detail: { gap: 5 },
  label: { color: muted, fontSize: 10, letterSpacing: 1.6, fontWeight: "700" },
  value: { color: ink, fontSize: 16, lineHeight: 22, fontWeight: "600" },

  // Address section
  addressSection: {
    marginTop: 24,
  },
  addressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  addressTitle: {
    color: ink,
    fontSize: 18,
    fontWeight: "800",
  },
  addressEditLink: {
    color: "#4A7C59",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  addressCard: {
    backgroundColor: surface,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: border,
    gap: 4,
  },
  addressLine: {
    color: ink,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },
  addressSub: {
    color: muted,
    fontSize: 13,
    lineHeight: 20,
  },
  addressCountry: {
    color: muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  addAddressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 24,
    borderWidth: 1.5,
    borderColor: border,
    borderStyle: "dashed",
    alignItems: "center",
    gap: 6,
  },
  addAddressPlus: {
    color: "#4A7C59",
    fontSize: 28,
    fontWeight: "300",
    marginBottom: 4,
  },
  addAddressText: {
    color: ink,
    fontSize: 14,
    fontWeight: "800",
  },
  addAddressSub: {
    color: muted,
    fontSize: 12,
  },

  editButton: {
    height: 52,
    borderWidth: 1,
    borderColor: ink,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  editText: { color: ink, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  signOut: { alignSelf: "center", marginTop: 24 },
  signOutText: {
    color: "#B0523E",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.8,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingBottom: 32,
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: border,
    borderRadius: 3,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalTitle: {
    color: ink,
    fontSize: 22,
    fontWeight: "800",
  },
  modalClose: {
    color: muted,
    fontSize: 22,
    fontWeight: "300",
  },
  modalForm: {
    paddingHorizontal: 20,
    gap: 6,
    paddingBottom: 24,
  },
  fieldLabel: {
    color: muted,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 2,
  },
  modalInput: {
    backgroundColor: field,
    borderRadius: 3,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: ink,
    fontSize: 14,
  },
  modalRow: {
    flexDirection: "row",
    gap: 12,
  },
  modalHalf: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: ink,
    borderRadius: 3,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  saveText: {
    color: "#F4F4ED",
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
});
