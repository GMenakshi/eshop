import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState, useRef } from "react";
import {
  Alert,
  Modal,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useWishlist } from "@/context/wishlist-context";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { addSavedAddress, getSavedAddresses  } from "@/lib/addressStorage";
import { api, API_BASE_URL } from "@/lib/api";
import { Animated, Dimensions } from "react-native";
import { Image } from "expo-image";
import { apiImageUrl, type ApiProduct } from "@/lib/api";
import { useStore } from "@/lib/store-context";
import { StoreSwitcher } from "@/components/store-switcher";
import { ConfirmDialog } from "@/components/confirm-dialog";


const ink = "#1A1A1A";
const muted = "#8A8A8A";
const field = "#F0F0F0";
const screenBg = "#F5F5F5";
const accent = "#F5A623";
const screenWidth = Dimensions.get("window").width;

export default function ProfileScreen() {
  const { user, token, refreshUser, signOut } = useAuth();
  const { items: wishlistItems } = useWishlist();
  const [loading, setLoading] = useState(true);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const [company, setCompany] = useState<any | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/company`)
      .then((r) => r.json())
      .then((json) => {
        if (active && json?.data) setCompany(json.data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const companyAddress = company?.address
    ? [
        company.address.addressLine,
        company.address.area,
        company.address.city,
        company.address.state,
        company.address.pincode,
      ]
        .filter(Boolean)
        .join(", ")
    : "";
const { storeId, activeStore } = useStore();
const [suggestedProducts, setSuggestedProducts] = useState<ApiProduct[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
const [showProfileModal, setShowProfileModal] = useState(false);
const [showSettingsModal, setShowSettingsModal] = useState(false);

const addressSlide = useRef(new Animated.Value(screenWidth)).current;
const profileSlide = useRef(new Animated.Value(screenWidth)).current;
const settingsSlide = useRef(new Animated.Value(screenWidth)).current;
const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
const [addressPanelMode, setAddressPanelMode] = useState<"list" | "form">("list");
const openPanel = (
  setVisible: (v: boolean) => void,
  slideAnim: Animated.Value,
) => {
  setVisible(true);
  slideAnim.setValue(screenWidth);
  Animated.timing(slideAnim, {
    toValue: 0,
    duration: 280,
    useNativeDriver: true,
  }).start();
};

const closePanel = (
  setVisible: (v: boolean) => void,
  slideAnim: Animated.Value,
) => {
  Animated.timing(slideAnim, {
    toValue: screenWidth,
    duration: 240,
    useNativeDriver: true,
  }).start(() => setVisible(false));
};

  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", phone: "" });
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
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

useEffect(() => {
  if (!storeId) return;
  let active = true;
  api
    .allProducts(storeId)
    .then((catalog) => {
      if (active) setSuggestedProducts(catalog.slice(0, 4));
    })
    .catch(() => undefined);
  return () => {
    active = false;
  };
}, [storeId]);

  const address = user?.address;
  const hasAddress =
    address &&
    (address.addressLine || address.city || address.state || address.pincode);

const openEditAddress = () => {
  setAddressPanelMode("list");
  loadSavedAddresses();
  openPanel(setShowAddressModal, addressSlide);
};

const loadSavedAddresses = async () => {
  if (!user?._id) return;
  try {
    const list = await getSavedAddresses(user._id);
    setSavedAddresses(list ?? []);
  } catch {
    setSavedAddresses([]);
  }
};

const startAddNewAddress = () => {
  setAddressForm({
    addressLine: "",
    area: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  });
  setAddressPanelMode("form");
};

const startEditAddress = (addr: any) => {
  setAddressForm({
    addressLine: addr.addressLine ?? "",
    area: addr.area ?? "",
    city: addr.city ?? "",
    state: addr.state ?? "",
    pincode: addr.pincode ?? "",
    country: addr.country ?? "India",
  });
  setAddressPanelMode("form");
};

const handleAddressOptions = (addr: any) => {
  Alert.alert(addr.fullName || "Address", undefined, [
    { text: "Edit", onPress: () => startEditAddress(addr) },
    {
      text: "Delete",
      style: "destructive",
      onPress: () => {
        // Note: this removes it from local state only.
        // Add a deleteSavedAddress() export in addressStorage.ts
        // to persist removal, then call it here.
        setSavedAddresses((prev) => prev.filter((a) => a !== addr));
      },
    },
    { text: "Cancel", style: "cancel" },
  ]);
};

const openMyProfile = () => {
  setProfileForm({
    name:
      user?.name?.trim() ||
      `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim(),
    phone: user?.phone ?? "",
  });
  setPwForm({ current: "", next: "", confirm: "" });
  openPanel(setShowProfileModal, profileSlide);
};

const saveProfile = async () => {
  if (!token) return;
  const name = profileForm.name.trim();
  const phone = profileForm.phone.trim();
  if (!name) return Alert.alert("Name required", "Enter your name.");
  if (phone && phone.length < 10) {
    return Alert.alert("Invalid phone", "Phone number must be at least 10 digits.");
  }
  setSavingProfile(true);
  try {
    await api.updateProfile(token, { name, phone: phone || undefined });
    await refreshUser();
    Alert.alert("Success", "Profile updated.");
  } catch (error) {
    Alert.alert(
      "Could not update profile",
      error instanceof Error ? error.message : "Please try again.",
    );
  } finally {
    setSavingProfile(false);
  }
};

const savePassword = async () => {
  if (!token) return;
  if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
    return Alert.alert("Missing details", "Fill in all three password fields.");
  }
  if (pwForm.next.length < 6) {
    return Alert.alert("Weak password", "New password must be at least 6 characters.");
  }
  if (pwForm.next !== pwForm.confirm) {
    return Alert.alert("Passwords don't match", "Re-enter the new password.");
  }
  setSavingPw(true);
  try {
    const res = await api.changePassword(token, {
      currentPassword: pwForm.current,
      newPassword: pwForm.next,
      confirmPassword: pwForm.confirm,
    });
    setPwForm({ current: "", next: "", confirm: "" });
    Alert.alert("Success", res?.message ?? "Password changed.");
  } catch (error) {
    Alert.alert(
      "Could not change password",
      error instanceof Error ? error.message : "Please try again.",
    );
  } finally {
    setSavingPw(false);
  }
};

const openSettings = () => {
  openPanel(setShowSettingsModal, settingsSlide);
};

  const saveAddress = async () => {
    if (!token) return;
    if (
      !addressForm.addressLine.trim() ||
      !addressForm.city.trim() ||
      !addressForm.state.trim() ||
      !addressForm.pincode.trim()
    ) {
      return Alert.alert(
        "Incomplete",
        "Please fill in address, city, state, and pincode.",
      );
    }
    setSaving(true);
    try {
      const formattedAddr = {
        fullName: user?.name ?? "",
        phone: user?.phone ?? "",
        addressLine: addressForm.addressLine.trim(),
        area: addressForm.area.trim() || undefined,
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        pincode: addressForm.pincode.trim(),
        country: addressForm.country.trim() || "India",
      };

      await api.updateProfile(token, {
        address: formattedAddr,
      });

      if (user?._id) {
        await addSavedAddress(user._id, formattedAddr);
      }

      await refreshUser();
      await loadSavedAddresses();
      setAddressPanelMode("list");
      Alert.alert("Success", "Address saved successfully.");
    } catch (error) {
      Alert.alert(
        "Could not save address",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => setSignOutOpen(true);

  // const openMyProfile = () => {
  //   Alert.alert(
  //     fullName,
  //     `Email: ${user?.email ?? "Not available"}\nPhone: ${user?.phone ?? "Not available"
  //     }\nRole: ${user?.role ?? "Customer"}`,
  //   );
  // };

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
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Top Bar ─── */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }} />
          <Pressable
            accessibilityLabel="Wishlist"
            style={styles.topBarBtn}
            onPress={() => router.push("/wishlist")}
          >
            <Ionicons name="heart-outline" size={20} color={ink} />
            {/* {wishlistItems.length > 0 && (
              <View style={styles.wishlistCountDot}>
                <ThemedText style={styles.wishlistCountText}>
                  {wishlistItems.length > 9 ? "9+" : wishlistItems.length}
                </ThemedText>
              </View>
            )} */}
          </Pressable>
          <Pressable
            accessibilityLabel="Notifications"
            style={styles.topBarBtn}
            onPress={() => router.push("/notifications")}
          >
            <Ionicons name="notifications-outline" size={20} color={ink} />
            <View style={styles.notifDot} />
          </Pressable>
        </View>

        {/* ─── Identity Row ─── */}
        <Pressable style={styles.identityRow} onPress={openMyProfile}>
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>{initials}</ThemedText>
          </View>
          <View style={styles.identityText}>
            <ThemedText style={styles.identityPrimary} numberOfLines={2}>
              {user?.email || fullName}
            </ThemedText>
            {user?.phone ? (
              <ThemedText style={styles.identitySecondary}>{user.phone}</ThemedText>
            ) : null}
            {user?.email ? (
              <ThemedText style={styles.identitySecondary}>{user.email}</ThemedText>
            ) : null}
          </View>
        </Pressable>

        {/* ─── My Stores ─── */}
        <StoreSwitcher />

        {/* ─── Orders Row ─── */}
        <View style={styles.compactCard}>
          <View style={styles.compactHeaderRow}>
            <ThemedText style={styles.cardHeaderTitle}>My Orders</ThemedText>
            <Pressable
              style={styles.cardHeaderAction}
              onPress={() => router.push("/orders")}
            >
              <ThemedText style={styles.cardHeaderActionText}>View More</ThemedText>
              <Ionicons name="chevron-forward" size={14} color={muted} />
            </Pressable>
          </View>
          {/* <View style={styles.ordersGrid}>
            <OrderStat icon="card-outline" label="Unpaid" onPress={() => router.push("/orders")} />
            <OrderStat icon="car-outline" label="Processing" onPress={() => router.push("/orders")} />
            <OrderStat icon="checkmark-done-outline" label="Delivered" onPress={() => router.push("/orders")} />
            <OrderStat icon="repeat-outline" label="Returns" onPress={() => router.push("/orders")} />
          </View> */}
        </View>


        {/* ─── Wishlist Row ─── */}
        <View style={styles.compactCard}>
          <View style={styles.compactHeaderRow}>
            <ThemedText style={styles.cardHeaderTitle}>Wishlist</ThemedText>
            <Pressable
              style={styles.cardHeaderAction}
              onPress={() => router.push("/wishlist")}
            >
              <ThemedText style={styles.cardHeaderActionText}>View More</ThemedText>
              <Ionicons name="chevron-forward" size={14} color={muted} />
            </Pressable>
          </View>
        </View>

        {/* ─── You May Also Like ─── */}
{suggestedProducts.length > 0 && (
  <View style={styles.card}>
    <View style={styles.cardHeaderRow}>
      <ThemedText style={styles.cardHeaderTitle}>You May Also Like</ThemedText>
    </View>
    <View style={styles.suggestedList}>
      {suggestedProducts.map((product) => (
        <Pressable
          key={product._id}
          style={styles.suggestedRow}
          onPress={() =>
            router.push({
              pathname: "/product/[id]",
              params: { id: product._id },
            })
          }
        >
          <Image
            source={{ uri: apiImageUrl(product.image) }}
            style={styles.suggestedImage}
            contentFit="cover"
          />
          <View style={styles.suggestedInfo}>
            <ThemedText style={styles.suggestedName} numberOfLines={2}>
              {product.title}
            </ThemedText>
            <ThemedText style={styles.suggestedPrice}>
              {product.price > 0 ? `₹${product.price}` : "PRICE ON REQUEST"}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={muted} />
        </Pressable>
      ))}
    </View>
  </View>
)}

        {/* ─── My Account ─── */}
        <View style={styles.listCard}>
          <ThemedText style={styles.sectionHeading}>My Account</ThemedText>
          <View style={styles.sectionHeadingRule} />
          <TextRow label="My Profile" onPress={openMyProfile} />
          <TextRow label="Delivery Address" onPress={openEditAddress} />
          <TextRow label="Settings" isLast onPress={openSettings} />
        </View>

        {/* ─── Help Center ─── */}
        <View style={styles.listCard}>
          <ThemedText style={styles.sectionHeading}>Help Center</ThemedText>
          <View style={styles.sectionHeadingRule} />
          <TextRow
            label="Customer Service"
            onPress={() => Alert.alert("Customer Service", "Coming soon.")}
          />
          <TextRow
            label="Return Policy"
            onPress={() => Alert.alert("Return Policy", "Coming soon.")}
          />
          <TextRow
            label="Shipping & Delivery"
            onPress={() => Alert.alert("Shipping & Delivery", "Coming soon.")}
          />
          <TextRow label="More" isLast onPress={handleSignOut} />
        </View>

        {/* ─── About ─── */}
        <View style={styles.listCard}>
          <ThemedText style={styles.sectionHeading}>About</ThemedText>
          <View style={styles.sectionHeadingRule} />
          <TextRow
            label="About Us"
            isLast={!company}
            onPress={() => Alert.alert("About Us", "Coming soon.")}
          />

          {company && (
            <View style={styles.companyBlock}>
              <ThemedText style={styles.companyName}>
                {company.companyName}
              </ThemedText>
              {!!company.description && (
                <ThemedText style={styles.companyDesc}>
                  {company.description}
                </ThemedText>
              )}
              {!!company.companyPhone && (
                <ContactRow
                  icon="call-outline"
                  text={company.companyPhone}
                  onPress={() => Linking.openURL(`tel:${company.companyPhone}`)}
                />
              )}
              {!!company.whatsappNo &&
                company.whatsappNo !== company.companyPhone && (
                  <ContactRow
                    icon="logo-whatsapp"
                    text={company.whatsappNo}
                    onPress={() =>
                      Linking.openURL(`https://wa.me/91${company.whatsappNo}`)
                    }
                  />
                )}
              {!!company.companyEmail && (
                <ContactRow
                  icon="mail-outline"
                  text={company.companyEmail}
                  onPress={() =>
                    Linking.openURL(`mailto:${company.companyEmail}`)
                  }
                />
              )}
              {!!company.supportEmail &&
                company.supportEmail !== company.companyEmail && (
                  <ContactRow
                    icon="headset-outline"
                    text={company.supportEmail}
                    onPress={() =>
                      Linking.openURL(`mailto:${company.supportEmail}`)
                    }
                  />
                )}
              {!!company.website && (
                <ContactRow
                  icon="globe-outline"
                  text={company.website}
                  onPress={() => Linking.openURL(company.website)}
                />
              )}
              {!!companyAddress && (
                <ContactRow icon="location-outline" text={companyAddress} />
              )}
            </View>
          )}
        </View>
        <ThemedText style={styles.trustFooterText}>
        Your Trust{"\n"}is Our Duty
      </ThemedText>
      </ScrollView>

      

      {/* Delivery Address Panel */}
{/* Delivery Address Panel */}
<Modal
  visible={showAddressModal}
  transparent
  animationType="none"
  onRequestClose={() => closePanel(setShowAddressModal, addressSlide)}
>
  <Animated.View
    style={[styles.panelScreen, { transform: [{ translateX: addressSlide }] }]}
  >
    <View style={styles.panelHeader}>
      <Pressable
        onPress={() => {
          if (addressPanelMode === "form") {
            setAddressPanelMode("list");
          } else {
            closePanel(setShowAddressModal, addressSlide);
          }
        }}
      >
        <Ionicons name="arrow-back" size={22} color={ink} />
      </Pressable>
      <ThemedText style={styles.panelHeaderTitle}>
        {addressPanelMode === "list"
          ? "Saved Addresses"
          : hasAddress
            ? "Edit Address"
            : "Add Address"}
      </ThemedText>
      <View style={{ width: 22 }} />
    </View>

    {addressPanelMode === "list" ? (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.addressListContent}
      >
        <Pressable style={styles.addNewButton} onPress={startAddNewAddress}>
          <View style={styles.addNewButtonLeft}>
            <Ionicons name="add" size={18} color="#2E6ADE" />
            <ThemedText style={styles.addNewButtonText}>Add New</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#2E6ADE" />
        </Pressable>

        {savedAddresses.length > 0 && (
          <ThemedText style={styles.savedAddressesLabel}>
            Saved addresses
          </ThemedText>
        )}

        {savedAddresses.map((addr, idx) => (
          <View key={idx} style={styles.savedAddressCard}>
            <View style={styles.savedAddressIconBox}>
              <Ionicons name="home" size={20} color={ink} />
            </View>
            <View style={styles.savedAddressBody}>
              <ThemedText style={styles.savedAddressName} numberOfLines={1}>
                {addr.fullName || "Saved Address"}
              </ThemedText>
              <ThemedText style={styles.savedAddressLine} numberOfLines={2}>
                {addr.addressLine}
                {addr.area ? `, ${addr.area}` : ""}, {addr.city}
              </ThemedText>
              <View style={styles.savedAddressPhoneRow}>
                <Ionicons name="call-outline" size={12} color={muted} />
                <ThemedText style={styles.savedAddressPhone}>
                  {addr.phone}
                </ThemedText>
              </View>
            </View>
            <Pressable
              style={styles.savedAddressMenuBtn}
              onPress={() => handleAddressOptions(addr)}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={muted} />
            </Pressable>
          </View>
        ))}

        {savedAddresses.length === 0 && (
          <ThemedText style={styles.noAddressesText}>
            No saved addresses yet.
          </ThemedText>
        )}
      </ScrollView>
    ) : (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.modalForm}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText style={styles.fieldLabel}>ADDRESS LINE</ThemedText>
        <TextInput
          value={addressForm.addressLine}
          onChangeText={(t) => setAddressForm((s) => ({ ...s, addressLine: t }))}
          placeholder="House no, Street, Area"
          placeholderTextColor={muted}
          style={styles.modalInput}
        />
        <ThemedText style={styles.fieldLabel}>AREA / LANDMARK</ThemedText>
        <TextInput
          value={addressForm.area}
          onChangeText={(t) => setAddressForm((s) => ({ ...s, area: t }))}
          placeholder="Landmark (Optional)"
          placeholderTextColor={muted}
          style={styles.modalInput}
        />
        <View style={styles.modalRow}>
          <View style={styles.modalHalf}>
            <ThemedText style={styles.fieldLabel}>CITY</ThemedText>
            <TextInput
              value={addressForm.city}
              onChangeText={(t) => setAddressForm((s) => ({ ...s, city: t }))}
              placeholder="City"
              placeholderTextColor={muted}
              style={styles.modalInput}
            />
          </View>
          <View style={styles.modalHalf}>
            <ThemedText style={styles.fieldLabel}>STATE</ThemedText>
            <TextInput
              value={addressForm.state}
              onChangeText={(t) => setAddressForm((s) => ({ ...s, state: t }))}
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
              onChangeText={(t) => setAddressForm((s) => ({ ...s, pincode: t }))}
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
              onChangeText={(t) => setAddressForm((s) => ({ ...s, country: t }))}
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
    )}
  </Animated.View>
</Modal>

{/* My Profile Panel */}
<Modal
  visible={showProfileModal}
  transparent
  animationType="none"
  onRequestClose={() => closePanel(setShowProfileModal, profileSlide)}
>
  <Animated.View
    style={[styles.panelScreen, { transform: [{ translateX: profileSlide }] }]}
  >
    <View style={styles.panelHeader}>
      <Pressable onPress={() => closePanel(setShowProfileModal, profileSlide)}>
        <Ionicons name="arrow-back" size={22} color={ink} />
      </Pressable>
      <ThemedText style={styles.panelHeaderTitle}>My Profile</ThemedText>
      <View style={{ width: 22 }} />
    </View>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.modalForm}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <ThemedText style={styles.fieldLabel}>NAME</ThemedText>
      <TextInput
        value={profileForm.name}
        onChangeText={(t) => setProfileForm((s) => ({ ...s, name: t }))}
        placeholder="Full name"
        placeholderTextColor={muted}
        style={styles.modalInput}
      />
      <ThemedText style={styles.fieldLabel}>EMAIL</ThemedText>
      <View style={styles.readOnlyField}>
        <ThemedText style={styles.readOnlyText}>
          {user?.email ?? "Not available"}
        </ThemedText>
      </View>
      <ThemedText style={styles.fieldLabel}>PHONE</ThemedText>
      <TextInput
        value={profileForm.phone}
        onChangeText={(t) =>
          setProfileForm((s) => ({ ...s, phone: t.replace(/[^\d+]/g, "") }))
        }
        placeholder="Phone number"
        placeholderTextColor={muted}
        keyboardType="phone-pad"
        style={styles.modalInput}
      />
      <Pressable
        style={[styles.saveButton, savingProfile && { opacity: 0.5 }]}
        disabled={savingProfile}
        onPress={saveProfile}
      >
        <ThemedText style={styles.saveText}>
          {savingProfile ? "SAVING..." : "SAVE PROFILE"}
        </ThemedText>
      </Pressable>

      <ThemedText style={styles.passwordSectionTitle}>
        Change Password
      </ThemedText>
      <ThemedText style={styles.fieldLabel}>CURRENT PASSWORD</ThemedText>
      <TextInput
        value={pwForm.current}
        onChangeText={(t) => setPwForm((s) => ({ ...s, current: t }))}
        secureTextEntry
        placeholder="Current password"
        placeholderTextColor={muted}
        style={styles.modalInput}
      />
      <ThemedText style={styles.fieldLabel}>NEW PASSWORD</ThemedText>
      <TextInput
        value={pwForm.next}
        onChangeText={(t) => setPwForm((s) => ({ ...s, next: t }))}
        secureTextEntry
        placeholder="New password"
        placeholderTextColor={muted}
        style={styles.modalInput}
      />
      <ThemedText style={styles.fieldLabel}>CONFIRM NEW PASSWORD</ThemedText>
      <TextInput
        value={pwForm.confirm}
        onChangeText={(t) => setPwForm((s) => ({ ...s, confirm: t }))}
        secureTextEntry
        placeholder="Confirm new password"
        placeholderTextColor={muted}
        style={styles.modalInput}
      />
      <Pressable
        style={[styles.saveButton, savingPw && { opacity: 0.5 }]}
        disabled={savingPw}
        onPress={savePassword}
      >
        <ThemedText style={styles.saveText}>
          {savingPw ? "UPDATING..." : "UPDATE PASSWORD"}
        </ThemedText>
      </Pressable>
    </ScrollView>
  </Animated.View>
</Modal>


{/* Settings Panel */}
<Modal
  visible={showSettingsModal}
  transparent
  animationType="none"
  onRequestClose={() => closePanel(setShowSettingsModal, settingsSlide)}
>
  <Animated.View
    style={[styles.panelScreen, { transform: [{ translateX: settingsSlide }] }]}
  >
    <View style={styles.panelHeader}>
      <Pressable onPress={() => closePanel(setShowSettingsModal, settingsSlide)}>
        <Ionicons name="arrow-back" size={22} color={ink} />
      </Pressable>
      <ThemedText style={styles.panelHeaderTitle}>Settings</ThemedText>
      <View style={{ width: 22 }} />
    </View>
    <ScrollView contentContainerStyle={styles.modalForm}>
      <Pressable
        style={styles.settingsRow}
        onPress={() => {
          closePanel(setShowSettingsModal, settingsSlide);
          handleSignOut();
        }}
      >
        <ThemedText style={styles.settingsRowText}>Sign Out</ThemedText>
        <Ionicons name="log-out-outline" size={18} color="#E8503C" />
      </Pressable>
    </ScrollView>
  </Animated.View>
</Modal>
      <ConfirmDialog
        visible={signOutOpen}
        title="Sign out"
        message="Are you sure you want to sign out?"
        confirmText="Sign out"
        destructive
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => {
          setSignOutOpen(false);
          signOut();
          router.replace("/sign-in");
        }}
      />
    </SafeAreaView>
  );
}

function OrderStat({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.orderStatItem} onPress={onPress}>
      <Ionicons name={icon} size={22} color={ink} />
      <ThemedText style={styles.orderStatLabel}>{label}</ThemedText>
    </Pressable>
  );
}

function StatItem({
  value,
  label,
  onPress,
}: {
  value: string;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.statItem} onPress={onPress} disabled={!onPress}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </Pressable>
  );
}

function ContactRow({
  icon,
  text,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.contactRow} onPress={onPress} disabled={!onPress}>
      <Ionicons name={icon} size={16} color={muted} />
      <ThemedText style={styles.contactText}>{text}</ThemedText>
    </Pressable>
  );
}

function TextRow({
  label,
  onPress,
  isLast,
}: {
  label: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      style={[styles.textRow, !isLast && styles.textRowDivider]}
      onPress={onPress}
    >
      <ThemedText style={styles.textRowLabel}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: screenBg },
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  /* ─── Top Bar ─── */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
    gap: 10,
  },
  topBarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notifDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E8503C",
  },

  /* ─── Identity Row ─── */
  identityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginTop: 12,
    marginBottom: 18,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  avatarText: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  identityText: { flex: 1, paddingTop: 4 },
  identityPrimary: {
    color: ink,
    fontSize: 17,
    fontWeight: "700",
  },
  identitySecondary: {
    color: muted,
    fontSize: 13,
    marginTop: 3,
  },

  /* ─── Rewards Card ─── */
  rewardsCard: {
    backgroundColor: accent,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    overflow: "hidden",
  },
  rewardsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rewardsTitle: {
    color: ink,
    fontSize: 18,
    fontWeight: "800",
  },
  rewardsViewAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  rewardsViewAllText: {
    color: ink,
    fontSize: 13,
    fontWeight: "600",
  },
  rewardsTier: {
    color: ink,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.15)",
  },
  rewardsDivider: {
    height: 12,
  },
  rewardsBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rewardsBadgeIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ink,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardsBadgeText: {
    color: ink,
    fontSize: 13,
    fontWeight: "700",
  },

  /* ─── Generic Card ─── */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  compactCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  compactHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cardHeaderTitle: {
    color: ink,
    fontSize: 16,
    fontWeight: "800",
  },
  cardHeaderAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  cardHeaderActionText: {
    color: muted,
    fontSize: 13,
    fontWeight: "600",
  },

  /* ─── Orders Grid ─── */
  ordersGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  orderStatItem: {
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  orderStatLabel: {
    color: ink,
    fontSize: 12,
    fontWeight: "600",
  },

  /* ─── Stats Row ─── */
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    color: ink,
    fontSize: 17,
    fontWeight: "800",
  },
  statLabel: {
    color: muted,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },

  /* ─── List Cards ─── */
  listCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 16,
    marginBottom: 16,
  },
  sectionHeading: {
    color: ink,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
  },
  sectionHeadingRule: {
    height: 2,
    backgroundColor: ink,
    width: 60,
    marginBottom: 4,
  },
  textRow: {
    paddingVertical: 16,
  },
  textRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFEF",
  },
  textRowLabel: {
    color: ink,
    fontSize: 15,
    fontWeight: "500",
  },

  // Modal styles (unchanged)
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
    backgroundColor: "#D7E0D6",
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
    paddingBottom: 160,
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
  panelScreen: {
  flex: 1,
  backgroundColor: "#FFFFFF",
},
panelHeader: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 20,
  paddingTop: 56,
  paddingBottom: 16,
  borderBottomWidth: 1,
  borderBottomColor: "#EFEFEF",
},
panelHeaderTitle: {
  color: ink,
  fontSize: 18,
  fontWeight: "800",
},
readOnlyField: {
  backgroundColor: field,
  borderRadius: 3,
  paddingHorizontal: 16,
  paddingVertical: 14,
  marginBottom: 4,
},
passwordSectionTitle: {
  color: ink,
  fontSize: 16,
  fontWeight: "800",
  marginTop: 32,
  marginBottom: 4,
},
readOnlyText: {
  color: ink,
  fontSize: 14,
  fontWeight: "600",
},
settingsRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: 16,
  borderBottomWidth: 1,
  borderBottomColor: "#EFEFEF",
},
settingsRowText: {
  color: "#E8503C",
  fontSize: 15,
  fontWeight: "700",
},
addressListContent: {
  paddingHorizontal: 20,
  paddingTop: 16,
  paddingBottom: 32,
},
addNewButton: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: "#EAF2FE",
  borderRadius: 14,
  paddingHorizontal: 16,
  paddingVertical: 14,
  marginBottom: 20,
},
addNewButtonLeft: {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
},
addNewButtonText: {
  color: "#2E6ADE",
  fontSize: 15,
  fontWeight: "700",
},
savedAddressesLabel: {
  color: muted,
  fontSize: 13,
  fontWeight: "600",
  marginBottom: 10,
},
savedAddressCard: {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: 12,
  borderWidth: 1,
  borderColor: "#EFEFEF",
  borderRadius: 14,
  padding: 14,
  marginBottom: 12,
},
savedAddressIconBox: {
  width: 40,
  height: 40,
  borderRadius: 10,
  backgroundColor: field,
  alignItems: "center",
  justifyContent: "center",
},
savedAddressBody: {
  flex: 1,
},
savedAddressName: {
  color: ink,
  fontSize: 15,
  fontWeight: "700",
},
savedAddressLine: {
  color: muted,
  fontSize: 13,
  lineHeight: 18,
  marginTop: 4,
},
savedAddressPhoneRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 5,
  marginTop: 6,
},
savedAddressPhone: {
  color: ink,
  fontSize: 13,
  fontWeight: "700",
},
savedAddressMenuBtn: {
  padding: 4,
},
noAddressesText: {
  color: muted,
  fontSize: 13,
  textAlign: "center",
  marginTop: 20,
},
suggestedList: {
  marginTop: 4,
},
suggestedRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: "#F0F0F0",
},
suggestedImage: {
  width: 56,
  height: 56,
  borderRadius: 12,
  backgroundColor: field,
},
suggestedInfo: {
  flex: 1,
},
suggestedName: {
  color: ink,
  fontSize: 14,
  fontWeight: "700",
  marginBottom: 4,
},
suggestedPrice: {
  color: ink,
  fontSize: 14,
  fontWeight: "800",
},
companyBlock: {
  borderTopWidth: 1,
  borderTopColor: "#EFEFEF",
  paddingVertical: 16,
  gap: 10,
},
companyName: { color: ink, fontSize: 16, fontWeight: "800" },
companyDesc: { color: muted, fontSize: 13, lineHeight: 18, marginBottom: 4 },
contactRow: { flexDirection: "row", alignItems: "center", gap: 10 },
contactText: { color: ink, fontSize: 14, fontWeight: "500", flexShrink: 1 },
trustFooterText: {
  color: "#dddbdb",
  fontSize: 40,
  fontWeight: "700",
  textAlign: "left",
  marginTop: 8,
  marginBottom: 8,
  paddingTop: 20,
  lineHeight: 46,
},
});