import { ConfirmDialog } from "@/components/confirm-dialog";
import { StoreScanner } from "@/components/store-scanner";
import { StoreSwitcher } from "@/components/store-switcher";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { useWishlist } from "@/context/wishlist-context";
import {
  createSavedAddress,
  deleteSavedAddress,
  getSavedAddresses,
  setDefaultSavedAddress,
  updateSavedAddress,
} from "@/lib/addressStorage";
import { api, API_BASE_URL, apiImageUrl, type ApiProduct } from "@/lib/api";
import {
  fetchNotifications,
  filterNotificationsForStore,
} from "@/lib/notifications-api";
import { useStore } from "@/lib/store-context";
import { extractStoreId } from "@/lib/store-qr";
import { usePincode } from "@/lib/use-pincode";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated, Dimensions,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TextInputProps,
  View
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const orange = "#F09148";
const orangeDeep = "#E8763A";
const orangeSoft = "#FFF4EB";
const orangeLine = "#FFE3D0";
const panelBg = "#FFFAF5";

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
  const { storeId, activeStore, stores, joinStore } = useStore();
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleScan = async (data: string) => {
    setScannerOpen(false);
    // QR may contain just the ID ("STR-123...") or a URL that includes it
    const match = data.match(/STR-\d+/i);
    if (!match) {
      return Alert.alert("Invalid QR", "This is not a store QR code.");
    }
    const id = match[0].toUpperCase();
    if (id === storeId) {
      return Alert.alert("Already selected", "You are already on this store.");
    }
    try {
      const ok = await joinStore(id);
      if (!ok) {
        return Alert.alert(
          "Store not found",
          `Could not find a store for "${id}".`,
        );
      }
      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert(
        "Could not open store",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };
  const handlePasteLink = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    const id = extractStoreId(text);
    if (!id) {
      return Alert.alert(
        "Copy the store link first",
        "Copy the store link you received, then tap “Store” again.",
      );
    }
    if (id === storeId) {
      return Alert.alert("Already selected", "You are already on this store.");
    }
    try {
      const ok = await joinStore(id);
      if (!ok) {
        return Alert.alert(
          "Store not found",
          `Could not find a store for "${id}".`,
        );
      }
      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert(
        "Could not open store",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };
  const [suggestedProducts, setSuggestedProducts] = useState<ApiProduct[]>([]);
  const pincode = usePincode();
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!token) {
        setUnreadCount(0);
        return;
      }
      let active = true;
      fetchNotifications(token, 1, activeStore?.mongoId ?? storeId ?? undefined)
        .then((d) => {
          const notifications = filterNotificationsForStore(
            d.notifications,
            [activeStore?.mongoId, activeStore?.id, storeId].filter(
              (id): id is string => Boolean(id),
            ),
          );
          if (active)
            setUnreadCount(
              d.unreadCount ?? notifications.filter((n) => !n.isRead).length,
            );
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [token, activeStore?.id, activeStore?.mongoId, storeId]),
  );
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const addressSlide = useRef(new Animated.Value(screenWidth)).current;
  const profileSlide = useRef(new Animated.Value(screenWidth)).current;
  const settingsSlide = useRef(new Animated.Value(screenWidth)).current;
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [addressPanelMode, setAddressPanelMode] = useState<"list" | "form">(
    "list",
  );
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
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
  const [locating, setLocating] = useState(false);
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

  const refreshRef = useRef(refreshUser);
  refreshRef.current = refreshUser;

  useEffect(() => {
    if (!token) {
      router.replace("/sign-in");
      return;
    }
    refreshRef.current().finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    api
      .allProducts(storeId, pincode ?? "")
      .then((catalog) => {
        if (active) setSuggestedProducts(catalog.slice(0, 4));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [storeId, JSON.stringify(pincode)]);

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
    if (!token) return;
    try {
      const list = await getSavedAddresses(token, {
        fullName: user?.name,
        phone: user?.phone,
      });
      setSavedAddresses(list);
    } catch {
      setSavedAddresses([]);
    }
  };

  const startAddNewAddress = () => {
    setEditingAddressId(null);
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
    setEditingAddressId(addr._id ?? null);
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

  const removeAddress = async (addr: any) => {
    if (!token || !addr._id) return;
    try {
      await deleteSavedAddress(token, addr._id);
      await refreshUser();
      await loadSavedAddresses();
    } catch (error) {
      Alert.alert(
        "Could not delete address",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const makeDefaultAddress = async (addr: any) => {
    if (!token || !addr._id) return;
    try {
      await setDefaultSavedAddress(token, addr._id);
      await refreshUser();
      await loadSavedAddresses();
    } catch (error) {
      Alert.alert(
        "Could not set default",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const handleAddressOptions = (addr: any) => {
    Alert.alert(addr.fullName || "Address", undefined, [
      { text: "Edit", onPress: () => startEditAddress(addr) },
      ...(!addr.isDefault
        ? [
            {
              text: "Set as default",
              onPress: () => void makeDefaultAddress(addr),
            },
          ]
        : []),
      {
        text: "Delete",
        style: "destructive" as const,
        onPress: () => void removeAddress(addr),
      },
      { text: "Cancel", style: "cancel" as const },
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
      return Alert.alert(
        "Invalid phone",
        "Phone number must be at least 10 digits.",
      );
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
      return Alert.alert(
        "Missing details",
        "Fill in all three password fields.",
      );
    }
    if (pwForm.next.length < 6) {
      return Alert.alert(
        "Weak password",
        "New password must be at least 6 characters.",
      );
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

      // saved-addresses list first, so a failure (e.g. the 5-address limit) stops here
      if (editingAddressId) {
        await updateSavedAddress(token, editingAddressId, formattedAddr);
      } else {
        await createSavedAddress(token, formattedAddr);
      }
      setEditingAddressId(null);

      await api.updateProfile(token, { address: formattedAddr });

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

  const fillFromCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Allow location access to autofill your address.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (!place) {
        Alert.alert(
          "Not found",
          "Could not read an address for this location.",
        );
        return;
      }
      const line = [place.streetNumber, place.street || place.name]
        .filter(Boolean)
        .join(" ");
      setAddressForm((s) => ({
        addressLine: line || s.addressLine,
        area: place.district || place.subregion || s.area,
        city: place.city || place.subregion || s.city,
        state: place.region || s.state,
        pincode: place.postalCode || s.pincode,
        country: place.country || s.country,
      }));
    } catch (error) {
      Alert.alert(
        "Could not get location",
        error instanceof Error ? error.message : "Make sure GPS is turned on.",
      );
    } finally {
      setLocating(false);
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
            {unreadCount > 0 && <View style={styles.notifDot} />}
          </Pressable>
        </View>

        {/* ─── Identity Row ─── */}
        <Pressable style={styles.identityRow} onPress={openMyProfile}>
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>{initials}</ThemedText>
          </View>
          <View style={styles.identityText}>
            <ThemedText style={styles.identityPrimary} numberOfLines={2}>
              {fullName}
            </ThemedText>
            {user?.phone ? (
              <ThemedText style={styles.identitySecondary}>
                {user.phone}
              </ThemedText>
            ) : null}
            {user?.email ? (
              <ThemedText style={styles.identitySecondary}>
                {user.email}
              </ThemedText>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel="Paste store link"
            style={styles.storeLinkBtn}
            onPress={() => void handlePasteLink()}
          >
            <Ionicons name="link-outline" size={18} color={orangeDeep} />
            <ThemedText style={styles.storeLinkText}>Store</ThemedText>
          </Pressable>
          <Pressable
            accessibilityLabel="Scan store QR"
            style={styles.scanBtn}
            onPress={() => setScannerOpen(true)}
          >
            <Ionicons name="scan-outline" size={26} color={ink} />
          </Pressable>
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
              <ThemedText style={styles.cardHeaderActionText}>
                View More
              </ThemedText>
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
              <ThemedText style={styles.cardHeaderActionText}>
                View More
              </ThemedText>
              <Ionicons name="chevron-forward" size={14} color={muted} />
            </Pressable>
          </View>
        </View>

        {/* ─── You May Also Like ─── */}
        {suggestedProducts.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <ThemedText style={styles.cardHeaderTitle}>
                You May Also Like
              </ThemedText>
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
                      {product.price > 0
                        ? `₹${product.price}`
                        : "CLICK ORDER FOR PRICE"}
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
      <Modal
        visible={showAddressModal}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => closePanel(setShowAddressModal, addressSlide)}
      >
        <Animated.View
          style={[
            styles.pnScreen,
            { transform: [{ translateX: addressSlide }] },
          ]}
        >
          <PanelHeader
            topInset={insets.top}
            title={
              addressPanelMode === "list"
                ? "Saved Addresses"
                : hasAddress
                  ? "Edit Address"
                  : "Add Address"
            }
            onBack={() => {
              if (addressPanelMode === "form") setAddressPanelMode("list");
              else closePanel(setShowAddressModal, addressSlide);
            }}
          />

          {addressPanelMode === "list" ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.pnContent}
            >
              <Pressable style={styles.addNewCard} onPress={startAddNewAddress}>
                <View style={styles.addNewPlus}>
                  <Ionicons name="add" size={22} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.addNewTitle}>
                    Add new address
                  </ThemedText>
                  <ThemedText style={styles.addNewSub}>
                    Save a place you order to often
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={orangeDeep} />
              </Pressable>

              {savedAddresses.length > 0 && (
                <ThemedText style={styles.pnSectionLabel}>
                  Your addresses
                </ThemedText>
              )}

              {savedAddresses.map((addr, idx) => (
                <View key={idx} style={styles.addrCard}>
                  <View style={styles.addrIconBubble}>
                    <Ionicons name="home" size={20} color={orangeDeep} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.addrNameRow}>
                      <ThemedText style={styles.addrName} numberOfLines={1}>
                        {addr.fullName || "Saved Address"}
                      </ThemedText>
                      {addr.isDefault && (
                        <View style={styles.defaultBadge}>
                          <ThemedText style={styles.defaultBadgeText}>
                            DEFAULT
                          </ThemedText>
                        </View>
                      )}
                    </View>
                    <ThemedText style={styles.addrLine} numberOfLines={2}>
                      {addr.addressLine}
                      {addr.area ? `, ${addr.area}` : ""}, {addr.city}
                    </ThemedText>
                    <View style={styles.addrPhonePill}>
                      <Ionicons name="call" size={11} color={orangeDeep} />
                      <ThemedText style={styles.addrPhoneText}>
                        {addr.phone}
                      </ThemedText>
                    </View>
                  </View>
                  <Pressable
                    style={styles.addrMenuBtn}
                    onPress={() => handleAddressOptions(addr)}
                    hitSlop={6}
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={18}
                      color={muted}
                    />
                  </Pressable>
                </View>
              ))}

              {savedAddresses.length === 0 && (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyBubble}>
                    <Ionicons
                      name="location-outline"
                      size={34}
                      color={orangeDeep}
                    />
                  </View>
                  <ThemedText style={styles.emptyTitle}>
                    No saved addresses
                  </ThemedText>
                  <ThemedText style={styles.emptySub}>
                    Add one to check out faster next time.
                  </ThemedText>
                </View>
              )}
            </ScrollView>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.pnContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formCard}>
                <Pressable
                  style={[styles.locateBtn, locating && { opacity: 0.6 }]}
                  disabled={locating}
                  onPress={fillFromCurrentLocation}
                >
                  <Ionicons name="locate" size={18} color={orangeDeep} />
                  <ThemedText style={styles.locateBtnText}>
                    {locating ? "Getting location..." : "Use current location"}
                  </ThemedText>
                </Pressable>
                <BubbleField
                  label="Address line"
                  icon="home-outline"
                  value={addressForm.addressLine}
                  onChangeText={(t) =>
                    setAddressForm((s) => ({ ...s, addressLine: t }))
                  }
                  placeholder="House no, Street, Area"
                />
                <BubbleField
                  label="Area / Landmark"
                  icon="navigate-outline"
                  value={addressForm.area}
                  onChangeText={(t) =>
                    setAddressForm((s) => ({ ...s, area: t }))
                  }
                  placeholder="Landmark (optional)"
                />
                <View style={styles.pnRow}>
                  <View style={{ flex: 1 }}>
                    <BubbleField
                      label="City"
                      icon="business-outline"
                      value={addressForm.city}
                      onChangeText={(t) =>
                        setAddressForm((s) => ({ ...s, city: t }))
                      }
                      placeholder="City"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <BubbleField
                      label="State"
                      icon="map-outline"
                      value={addressForm.state}
                      onChangeText={(t) =>
                        setAddressForm((s) => ({ ...s, state: t }))
                      }
                      placeholder="State"
                    />
                  </View>
                </View>
                <View style={styles.pnRow}>
                  <View style={{ flex: 1 }}>
                    <BubbleField
                      label="Pincode"
                      icon="mail-outline"
                      value={addressForm.pincode}
                      onChangeText={(t) =>
                        setAddressForm((s) => ({ ...s, pincode: t }))
                      }
                      placeholder="Pincode"
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <BubbleField
                      label="Country"
                      icon="globe-outline"
                      value={addressForm.country}
                      onChangeText={(t) =>
                        setAddressForm((s) => ({ ...s, country: t }))
                      }
                      placeholder="Country"
                    />
                  </View>
                </View>
              </View>

              <Pressable
                style={[styles.pnPrimaryBtn, saving && { opacity: 0.6 }]}
                disabled={saving}
                onPress={saveAddress}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <ThemedText style={styles.pnPrimaryText}>
                  {saving ? "Saving..." : "Save address"}
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
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => closePanel(setShowProfileModal, profileSlide)}
      >
        <Animated.View
          style={[
            styles.pnScreen,
            { transform: [{ translateX: profileSlide }] },
          ]}
        >
          <PanelHeader
            topInset={insets.top}
            title="My Profile"
            onBack={() => closePanel(setShowProfileModal, profileSlide)}
          />
          <ScrollView
            automaticallyAdjustKeyboardInsets
            style={{ flex: 1 }}
            contentContainerStyle={styles.pnContent}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
            showsVerticalScrollIndicator={false}
          >
            {/* Avatar hero */}
            <View style={styles.heroWrap}>
              <View style={styles.heroRing}>
                <View style={styles.heroAvatar}>
                  <ThemedText style={styles.heroInitials}>
                    {initials}
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={styles.heroName} numberOfLines={1}>
                {profileForm.name || fullName}
              </ThemedText>
              {!!user?.email && (
                <ThemedText style={styles.heroEmail} numberOfLines={1}>
                  {user.email}
                </ThemedText>
              )}
            </View>

            {/* Personal info */}
            <View style={styles.formCard}>
              <View style={styles.cardTitleRow}>
                <View style={styles.cardTitleIcon}>
                  <Ionicons name="person" size={14} color={orangeDeep} />
                </View>
                <ThemedText style={styles.cardTitleText}>
                  Personal info
                </ThemedText>
              </View>
              <BubbleField
                label="Name"
                icon="person-outline"
                value={profileForm.name}
                onChangeText={(t) => setProfileForm((s) => ({ ...s, name: t }))}
                placeholder="Full name"
              />
              <BubbleField
                label="Email"
                icon="mail-outline"
                value={user?.email ?? "Not available"}
                readOnly
              />
              <BubbleField
                label="Phone"
                icon="call-outline"
                value={profileForm.phone}
                onChangeText={(t) =>
                  setProfileForm((s) => ({
                    ...s,
                    phone: t.replace(/[^\d+]/g, ""),
                  }))
                }
                placeholder="Phone number"
                keyboardType="phone-pad"
              />
              <Pressable
                style={[styles.pnPrimaryBtn, savingProfile && { opacity: 0.6 }]}
                disabled={savingProfile}
                onPress={saveProfile}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <ThemedText style={styles.pnPrimaryText}>
                  {savingProfile ? "Saving..." : "Save profile"}
                </ThemedText>
              </Pressable>
            </View>

            {/* Password */}
            <View style={styles.formCard}>
              <View style={styles.cardTitleRow}>
                <View style={styles.cardTitleIcon}>
                  <Ionicons name="lock-closed" size={14} color={orangeDeep} />
                </View>
                <ThemedText style={styles.cardTitleText}>
                  Change password
                </ThemedText>
              </View>
              <BubbleField
                label="Current password"
                icon="key-outline"
                value={pwForm.current}
                onChangeText={(t) => setPwForm((s) => ({ ...s, current: t }))}
                secureTextEntry
                placeholder="Current password"
              />
              <BubbleField
                label="New password"
                icon="lock-closed-outline"
                value={pwForm.next}
                onChangeText={(t) => setPwForm((s) => ({ ...s, next: t }))}
                secureTextEntry
                placeholder="At least 6 characters"
              />
              <BubbleField
                label="Confirm new password"
                icon="shield-checkmark-outline"
                value={pwForm.confirm}
                onChangeText={(t) => setPwForm((s) => ({ ...s, confirm: t }))}
                secureTextEntry
                placeholder="Re-enter new password"
              />
              <Pressable
                style={[styles.pnOutlineBtn, savingPw && { opacity: 0.6 }]}
                disabled={savingPw}
                onPress={savePassword}
              >
                <ThemedText style={styles.pnOutlineText}>
                  {savingPw ? "Updating..." : "Update password"}
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </Modal>

      {/* Settings Panel */}
      <Modal
        visible={showSettingsModal}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => closePanel(setShowSettingsModal, settingsSlide)}
      >
        <Animated.View
          style={[
            styles.panelScreen,
            { transform: [{ translateX: settingsSlide }] },
          ]}
        >
          <View style={styles.panelHeader}>
            <Pressable
              onPress={() => closePanel(setShowSettingsModal, settingsSlide)}
            >
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
      {scannerOpen && (
        <StoreScanner
          visible={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScanned={handleScan}
        />
      )}
      <StoreScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={handleScan}
      />
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

function PanelHeader({
  title,
  onBack,
  topInset,
}: {
  title: string;
  onBack: () => void;
  topInset: number;
}) {
  return (
    <View style={[styles.pnHeader, { paddingTop: topInset + 12 }]}>
      <Pressable style={styles.pnBackBtn} onPress={onBack} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={ink} />
      </Pressable>
      <ThemedText style={styles.pnTitle}>{title}</ThemedText>
      <View style={styles.pnBackBtn} />
    </View>
  );
}

function BubbleField({
  label,
  icon,
  readOnly,
  secureTextEntry,
  ...props
}: TextInputProps & {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  readOnly?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);
  return (
    <View style={styles.bfWrap}>
      <ThemedText style={styles.bfLabel}>{label}</ThemedText>
      <View
        style={[
          styles.bfBox,
          focused && styles.bfBoxFocused,
          readOnly && styles.bfBoxReadOnly,
        ]}
      >
        <View style={styles.bfIcon}>
          <Ionicons name={icon} size={16} color={orangeDeep} />
        </View>
        <TextInput
          {...props}
          editable={!readOnly}
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor="#BBA997"
          autoComplete="off"
          importantForAutofill="no"
          style={styles.bfInput}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={10}>
            <Ionicons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={18}
              color="#BBA997"
            />
          </Pressable>
        )}
        {readOnly && (
          <Ionicons name="lock-closed-outline" size={16} color="#BBA997" />
        )}
      </View>
    </View>
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
  danger,
}: {
  label: string;
  onPress: () => void;
  isLast?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={[styles.textRow, !isLast && styles.textRowDivider]}
      onPress={onPress}
    >
      <ThemedText
        style={[styles.textRowLabel, danger && styles.textRowLabelDanger]}
      >
        {label}
      </ThemedText>
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
  scanBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  storeLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: orange,
    backgroundColor: orangeSoft,
  },
  storeLinkText: { color: orangeDeep, fontSize: 13, fontWeight: "800" },
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
  textRowLabelDanger: {
    color: "#E53935",
    fontWeight: "700",
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
  /* ─── Modern panels ─── */
  pnScreen: { flex: 1, backgroundColor: panelBg },
  pnHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 16,
    backgroundColor: orangeSoft,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  pnBackBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: orange,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  pnTitle: { color: ink, fontSize: 18, fontWeight: "800" },
  pnContent: { padding: 18, paddingBottom: 140 },
  pnRow: { flexDirection: "row", gap: 12 },
  pnSectionLabel: {
    color: muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 12,
    marginLeft: 4,
  },

  /* Bubble input */
  bfWrap: { marginTop: 12 },
  bfLabel: {
    color: "#9A8574",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    marginLeft: 6,
  },
  bfBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: orangeLine,
    borderRadius: 18,
    paddingHorizontal: 10,
    height: 54,
  },
  bfBoxFocused: {
    borderColor: orange,
  },
  bfBoxReadOnly: { backgroundColor: "#FBF3EC" },
  bfIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: orangeSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  bfIconFocused: { backgroundColor: orange },
  bfInput: {
    flex: 1,
    color: ink,
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 0,
  },

  /* Cards and buttons */
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 18,
    paddingTop: 16,
    marginBottom: 18,
    shadowColor: orange,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: orangeSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleText: { color: ink, fontSize: 16, fontWeight: "800" },
  pnPrimaryBtn: {
    marginTop: 22,
    height: 54,
    borderRadius: 27,
    backgroundColor: orange,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: orange,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pnPrimaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  pnOutlineBtn: {
    marginTop: 22,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: orange,
    backgroundColor: orangeSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  pnOutlineText: { color: orangeDeep, fontSize: 15, fontWeight: "800" },

  /* Profile hero */
  heroWrap: { alignItems: "center", marginTop: 6, marginBottom: 22 },
  heroRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: orangeSoft,
    borderWidth: 2,
    borderColor: orangeLine,
    alignItems: "center",
    justifyContent: "center",
  },
  heroAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: orange,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
  },
  heroInitials: { color: "#FFFFFF", fontSize: 30, fontWeight: "800" },
  heroName: { color: ink, fontSize: 20, fontWeight: "800", marginTop: 12 },
  heroEmail: { color: muted, fontSize: 13, marginTop: 2 },

  /* Address list */
  addNewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: orangeSoft,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: orange,
    borderRadius: 24,
    padding: 14,
    marginBottom: 22,
  },
  addNewPlus: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: orange,
    alignItems: "center",
    justifyContent: "center",
  },
  addNewTitle: { color: ink, fontSize: 15, fontWeight: "800" },
  addNewSub: { color: muted, fontSize: 12, marginTop: 2 },
  addrCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 14,
    marginBottom: 14,
    shadowColor: orange,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  addrIconBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: orangeSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  addrNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addrName: { flexShrink: 1, color: ink, fontSize: 15, fontWeight: "800" },
  defaultBadge: {
    backgroundColor: orange,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  defaultBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  addrLine: { color: muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  addrPhonePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    backgroundColor: orangeSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 8,
  },
  addrPhoneText: { color: orangeDeep, fontSize: 12, fontWeight: "700" },
  addrMenuBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FAF5F0",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: { alignItems: "center", marginTop: 30 },
  emptyBubble: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: orangeSoft,
    borderWidth: 2,
    borderColor: orangeLine,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: ink, fontSize: 16, fontWeight: "800", marginTop: 14 },
  emptySub: { color: muted, fontSize: 13, marginTop: 4 },
  locateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: orange,
    backgroundColor: orangeSoft,
  },
  locateBtnText: { color: orangeDeep, fontSize: 14, fontWeight: "800" },
});
