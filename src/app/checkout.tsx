import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { cartItemStoreId, useCart } from "@/context/cart-context";
import { addSavedAddress, getSavedAddresses } from "@/lib/addressStorage";
import { api, type ApiProduct } from "@/lib/api";
import { goBackOrHome } from "@/lib/navigation";
import { useStore } from "@/lib/store-context";

const ink = "#17211D";
const muted = "#748078";
const field = "#E4ECE4";
const border = "#D7E0D6";

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <ThemedText style={styles.fieldLabel}>
      {text}
      {required && <ThemedText style={styles.requiredStar}> *</ThemedText>}
    </ThemedText>
  );
}

function AddressRadio({ selected }: { selected: boolean }) {
  return (
    <View style={styles.addressRadioPos}>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
    </View>
  );
}

export default function CheckoutScreen() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const { storeId, activeStore } = useStore();
  const {
    items: allItems,
    cartId,
    loading: cartLoading,
    clearCart,
    removeItem,
  } = useCart();

  const {
    isBuyNow,
    productId,
    variantId,
    quantity: buyNowQty,
    storeId: checkoutStoreId,
  } = useLocalSearchParams<{
    isBuyNow?: string;
    productId?: string;
    variantId?: string;
    quantity?: string;
    storeId?: string;
  }>();

  const items = checkoutStoreId
    ? allItems.filter((item) => cartItemStoreId(item) === checkoutStoreId)
    : allItems;

  const [buyNowProduct, setBuyNowProduct] = useState<ApiProduct | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [profileAddress, setProfileAddress] = useState<any | null>(null);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<
    number | null
  >(null);
  const [section, setSection] = useState<"shipping" | "payment" | "review">(
    "shipping",
  );
  const [shipping, setShipping] = useState({
    fullName: "",
    phone: "",
    addressLine: "",
    area: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    note: "",
  });
  const [placing, setPlacing] = useState(false);
  const [editingAddress, setEditingAddress] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [remarksHeight, setRemarksHeight] = useState(44);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Opens the picker. The form only shows straight away if there are no addresses to pick from.
  const openEditor = () => {
    setEditingAddress(true);
    setShowForm(!(profileAddress || savedAddresses.length > 0));
  };
  const fillFromCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location permission needed",
          "Allow location access, or enter your address manually.",
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
          "Could not find address",
          "We couldn't read your address from this location. Please enter it manually.",
        );
        return;
      }
      const addressLine = [place.name, place.street]
        .filter((v, i, arr) => v && arr.indexOf(v) === i)
        .join(", ");
      setShipping((s) => ({
        ...s,
        fullName: s.fullName || user?.name || "",
        phone: s.phone || user?.phone || "",
        addressLine: addressLine || s.addressLine,
        area: place.district ?? place.subregion ?? s.area,
        city: place.city ?? place.subregion ?? s.city,
        state: place.region ?? s.state,
        pincode: place.postalCode ?? s.pincode,
        country: place.country || "India",
      }));
      setSelectedAddressIndex(null);
      setShowForm(true);
      setEditingAddress(true);
    } catch (e) {
      Alert.alert(
        "Could not get location",
        "Make sure location is turned on, or enter your address manually.",
      );
    } finally {
      setLocating(false);
    }
  };

  const lookupPincode = async (pin: string) => {
    setPinLoading(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const json = await res.json();
      const office = json?.[0]?.PostOffice?.[0];
      if (json?.[0]?.Status === "Success" && office) {
        setShipping((s) =>
          s.pincode === pin
            ? {
                ...s,
                city: office.District ?? s.city,
                state: office.State ?? s.state,
              }
            : s,
        );
      }
    } catch {
      // Silent: the user can still type city and state manually
    } finally {
      setPinLoading(false);
    }
  };

  const [paymentChoice, setPaymentChoice] = useState<
    "COD" | "UPI" | "CARD" | "NETBANKING"
  >("COD");

  const applyAddress = (a: any, index: number) => {
    setShipping({
      fullName: a.fullName ?? "",
      phone: a.phone ?? "",
      addressLine: a.addressLine ?? "",
      area: a.area ?? "",
      city: a.city ?? "",
      state: a.state ?? "",
      pincode: a.pincode ?? "",
      country: a.country || "India",
      note: a.note || "",
    });
    setSelectedAddressIndex(index);
  };

  const hasAddress = Boolean(
    shipping.fullName &&
    shipping.addressLine &&
    shipping.city &&
    shipping.pincode,
  );
  // Pre-select the profile address, otherwise the first saved one
  useEffect(() => {
    if (selectedAddressIndex !== null || showForm) return;
    if (profileAddress) applyAddress({ ...profileAddress, note: "" }, -1);
    else if (savedAddresses.length > 0) applyAddress(savedAddresses[0], 0);
  }, [profileAddress, savedAddresses]);

  const paymentOptions = [
    {
      key: "COD",
      label: "Cash on Delivery",
      desc: "Pay when your order arrives",
      disabled: false,
    },
    { key: "UPI", label: "UPI", desc: "Coming soon", disabled: true },
    {
      key: "CARD",
      label: "Credit / Debit Card",
      desc: "Coming soon",
      disabled: true,
    },
    {
      key: "NETBANKING",
      label: "Net Banking",
      desc: "Coming soon",
      disabled: true,
    },
  ] as const;

  useEffect(() => {
    if (isBuyNow === "true" && productId && storeId) {
      api
        .product(storeId, productId)
        .then((res) => {
          if (res.product) setBuyNowProduct(res.product);
        })
        .catch(() => undefined);
    }

    // Load profile address from API + local saved addresses
    if (token && user?._id) {
      // Fetch profile address from user profile
      api
        .dashboard(token)
        .then((res) => {
          const u = res.user ?? res.data;
          if (u?.address && (u.address.addressLine || u.address.city)) {
            const profAddr = {
              fullName: u.name ?? user?.name ?? "",
              phone: u.phone ?? user?.phone ?? "",
              addressLine: u.address.addressLine ?? "",
              area: u.address.area ?? "",
              city: u.address.city ?? "",
              state: u.address.state ?? "",
              pincode: u.address.pincode ?? "",
              country: u.address.country ?? "India",
              isProfile: true,
            };
            setProfileAddress(profAddr);
            // Auto-fill shipping if form is empty
            setShipping((s) => {
              if (!s.addressLine && !s.city) {
                return {
                  ...s,
                  fullName: profAddr.fullName || s.fullName,
                  phone: profAddr.phone || s.phone,
                  addressLine: profAddr.addressLine ?? "",
                  area: profAddr.area ?? "",
                  city: profAddr.city ?? "",
                  state: profAddr.state ?? "",
                  pincode: profAddr.pincode ?? "",
                  country: profAddr.country || "India",
                };
              }
              return s;
            });
          }
        })
        .catch(() => undefined);

      // Also load locally saved addresses
      getSavedAddresses(user._id)
        .then(setSavedAddresses)
        .catch(() => setSavedAddresses([]));
    }
  }, [isBuyNow, productId, storeId, token, user]);

  const numBuyNowQty = Number(buyNowQty) || 1;
  const buyNowVariant = buyNowProduct?.variants?.find(
    (v) => v._id === variantId,
  );
  const buyNowPrice = buyNowVariant?.offerPrice ?? buyNowProduct?.price ?? 0;
  const buyNowTotal = buyNowPrice * numBuyNowQty;

  const total =
    isBuyNow === "true"
      ? buyNowTotal
      : items.reduce(
          (sum, item) => sum + item.product.price * item.quantity,
          0,
        );

  const itemStoreIds = Array.from(
    new Set(
      items
        .map(
          (item) =>
            item.storeId ??
            ("storeId" in item.product ? item.product.storeId : undefined),
        )
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const storeIds = activeStore?.mongoId ? [activeStore.mongoId] : itemStoreIds;

  const orderNote =
    [remarks.trim(), shipping.note.trim()].filter(Boolean).join(" | ") ||
    undefined;

  const validateShipping = () => {
    if (
      !shipping.fullName ||
      !shipping.phone ||
      !shipping.addressLine ||
      !shipping.city ||
      !shipping.state ||
      !shipping.pincode
    ) {
      Alert.alert(
        "Shipping details needed",
        "Complete your name, phone, address, city, state, and pincode before continuing.",
      );
      return false;
    }
    if (!/^\d{6}$/.test(shipping.pincode)) {
      Alert.alert("Invalid pincode", "Enter a valid 6-digit pincode.");
      return false;
    }
    return true;
  };

  const placeOrder = async () => {
    if (!token) return router.push("/sign-in");
    if (!validateShipping()) {
      setEditingAddress(true);
      setShowForm(true);
      return;
    }

    // Check if performing Buy Now direct checkout
    if (isBuyNow === "true" && productId) {
      setPlacing(true);
      const buyNowPayload = {
        productId: String(productId),
        variantId: variantId ? String(variantId) : undefined,
        quantity: numBuyNowQty,
        deliveryAddress: {
          fullName: shipping.fullName.trim(),
          phone: shipping.phone.trim(),
          addressLine: shipping.addressLine.trim(),
          area: (shipping.area ?? "").trim() || undefined,
          city: shipping.city.trim(),
          state: shipping.state.trim(),
          pincode: shipping.pincode.trim(),
          country: shipping.country.trim() || "India",
        },
        note: orderNote,
        paymentMethod: "COD",
      };

      console.log("[Checkout] Submitting Buy Now payload:", buyNowPayload);
      try {
        const response = await api.buyNow(token, buyNowPayload);
        if (user && user._id) {
          await addSavedAddress(user._id, buyNowPayload.deliveryAddress);
        }
        const orderId =
          (response as any)?.order?._id ||
          (response as any)?._id ||
          (response as any)?.data?._id ||
          `#${Date.now().toString().slice(-7)}`;
        router.replace({
          pathname: "/order-success" as any,
          params: {
            orderId: String(orderId).replace(/^#/, ""),
            total: String(buyNowTotal),
            itemName: buyNowProduct?.title ?? "Selected Product",
          },
        });
      } catch (error) {
        console.error("[Checkout] Buy Now order failed:", error);
        Alert.alert(
          "Could not place order",
          error instanceof Error ? error.message : "Please try again.",
        );
      } finally {
        setPlacing(false);
      }
      return;
    }

    // Standard Cart Checkout
    console.log("[Checkout] Prerequisites", {
      hasCartId: Boolean(cartId),
      cartId,
      itemCount: items.length,
      storeIds,
      cartLoading,
    });
    if (cartLoading) {
      return Alert.alert(
        "Just a moment",
        "Your cart is still loading. Please wait a second and try again.",
      );
    }
    if (!cartId || !items.length || !storeIds.length) {
      return Alert.alert(
        "Your cart is empty",
        "We couldn't find any items to check out. Please go back and add something to your cart.",
      );
    }

    const unavailableItems = items.filter((item) => item.isAvailable === false);
    if (unavailableItems.length > 0) {
      return Alert.alert(
        "Unavailable Items in Cart",
        "Some items in your cart are no longer available. Please remove them to proceed with your order.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove Unavailable Items",
            onPress: async () => {
              setPlacing(true);
              try {
                for (const item of unavailableItems) {
                  await removeItem(item);
                }
                router.replace("/cart");
              } catch (e) {
                console.error("[Checkout] Failed to remove items:", e);
              } finally {
                setPlacing(false);
              }
            },
          },
        ],
      );
    }

    setPlacing(true);
    const checkoutPayload = {
      cartId,
      storeIds,
      deliveryAddress: {
        fullName: shipping.fullName.trim(),
        phone: shipping.phone.trim(),
        addressLine: shipping.addressLine.trim(),
        area: (shipping.area ?? "").trim() || undefined,
        city: shipping.city.trim(),
        state: shipping.state.trim(),
        pincode: shipping.pincode.trim(),
        country: shipping.country.trim() || "India",
      },
      note: shipping.note.trim() || undefined,
      paymentMethod: "COD" as const,
    };
    console.log("[Checkout] Submitting order", {
      cartId,
      storeIds,
      deliveryAddress: checkoutPayload.deliveryAddress,
      itemCount: items.length,
    });
    try {
      const response = await api.checkout(token, checkoutPayload);
      // Save address after successful order
      if (user && user._id) {
        await addSavedAddress(user._id, checkoutPayload.deliveryAddress);
      }
      console.log("[Checkout] Order created", response);
      const orderId =
        (response as any)?.order?._id ||
        (response as any)?._id ||
        (response as any)?.data?._id ||
        `#${Date.now().toString().slice(-7)}`;
      router.replace({
        pathname: "/order-success" as any,
        params: {
          orderId: String(orderId).replace(/^#/, ""),
          total: String(total),
          itemName:
            items.length > 0
              ? `${items[0].quantity}x ${"title" in items[0].product ? items[0].product.title : items[0].product.name}`
              : "Order items",
        },
      });
    } catch (error) {
      console.error("[Checkout] Order failed", {
        error,
        cartId,
        storeIds,
        itemCount: items.length,
      });

      const errorMsg = error instanceof Error ? error.message : String(error);
      if (
        errorMsg.includes("no longer available") ||
        errorMsg.includes("Remove them from your cart") ||
        errorMsg.includes("storeIds")
      ) {
        Alert.alert(
          "Items Unavailable",
          "One or more items in your cart are no longer available or belong to a different store. Would you like to clean unavailable items from your cart?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Clean Cart & Return",
              onPress: async () => {
                setPlacing(true);
                try {
                  for (const item of items) {
                    if (item.isAvailable === false) {
                      await removeItem(item);
                    }
                  }
                  router.replace("/cart");
                } catch (e) {
                  console.error(e);
                } finally {
                  setPlacing(false);
                }
              },
            },
          ],
        );
        return;
      }

      Alert.alert(
        "Could not place order",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setPlacing(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: (keyboardOpen ? 40 : 130) + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.topBar}>
          <Pressable
            onPress={goBackOrHome}
            style={styles.backBtn}
            accessibilityLabel="Go back"
          >
            <ThemedText style={styles.backChevron}>‹</ThemedText>
          </Pressable>
          <ThemedText style={styles.topTitle}>Checkout</ThemedText>
          <View style={styles.backBtn} />
        </View>

        {/* Order summary */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Your Order Summary</ThemedText>
          <View style={styles.innerCard}>
            {isBuyNow === "true" ? (
              <View style={styles.summaryLine}>
                <ThemedText style={styles.summaryName} numberOfLines={1}>
                  {numBuyNowQty}x{" "}
                  {buyNowProduct ? buyNowProduct.title : "Selected Product"}
                </ThemedText>
                <ThemedText style={styles.summaryPrice}>
                  ₹{buyNowTotal}
                </ThemedText>
              </View>
            ) : (
              items.map((item) => (
                <View key={item.id} style={styles.summaryLine}>
                  <ThemedText style={styles.summaryName} numberOfLines={1}>
                    {item.quantity}x{" "}
                    {"title" in item.product
                      ? item.product.title
                      : item.product.name}
                  </ThemedText>
                  <ThemedText style={styles.summaryPrice}>
                    ₹{item.product.price * item.quantity}
                  </ThemedText>
                </View>
              ))
            )}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryLine}>
              <ThemedText style={styles.totalLabel}>Total</ThemedText>
              <ThemedText style={styles.total}>₹{total.toFixed(2)}</ThemedText>
            </View>
          </View>

          {/* Payment options */}
          <View style={[styles.innerCard, { marginTop: 12 }]}>
            <ThemedText style={styles.innerTitle}>Payment Options</ThemedText>
            {paymentOptions.map((opt) => {
              const selected = paymentChoice === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  disabled={opt.disabled}
                  onPress={() => setPaymentChoice(opt.key)}
                  style={[
                    styles.payRow,
                    selected && styles.payRowSelected,
                    opt.disabled && styles.payRowDisabled,
                  ]}
                >
                  <View
                    style={[styles.radio, selected && styles.radioSelected]}
                  >
                    {selected && <View style={styles.radioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.payLabel}>{opt.label}</ThemedText>
                    <ThemedText style={styles.payDesc}>{opt.desc}</ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Remarks */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Remarks</ThemedText>
          <View style={styles.innerCard}>
            <TextInput
              multiline
              value={remarks}
              onChangeText={setRemarks}
              onContentSizeChange={(e) =>
                setRemarksHeight(
                  Math.min(
                    Math.max(e.nativeEvent.contentSize.height, 44),
                    120,
                  ),
                )
              }
              placeholder="Add any remarks for your order (Optional)"
              placeholderTextColor={muted}
              scrollEnabled={remarksHeight >= 120}
              textAlignVertical="top"
              maxLength={300}
              style={[styles.remarksInput, { height: remarksHeight }]}
            />
          </View>
        </View>

        {/* Delivery address */}
        <View style={styles.card}>
          <View style={styles.addressHeader}>
            <ThemedText style={styles.cardTitle}>Delivery Address</ThemedText>
            {!editingAddress && (
              <Pressable onPress={openEditor}>
                <ThemedText style={styles.changeLink}>
                  {hasAddress ? "Change" : "Add"}
                </ThemedText>
              </Pressable>
            )}
          </View>

          {!editingAddress && hasAddress && (
            <View style={styles.innerCard}>
              <ThemedText style={styles.addrName}>
                {shipping.fullName} – {shipping.phone}
              </ThemedText>
              <ThemedText style={styles.addrLine}>
                {shipping.addressLine}
                {shipping.area ? `, ${shipping.area}` : ""}
              </ThemedText>
              <ThemedText style={styles.addrLine}>
                {shipping.city}, {shipping.state} - {shipping.pincode}
              </ThemedText>
            </View>
          )}

          {!editingAddress && !hasAddress && (
            <Pressable style={styles.innerCard} onPress={openEditor}>
              <ThemedText style={styles.addrName}>
                + Add a delivery address
              </ThemedText>
            </Pressable>
          )}

          {editingAddress && (
            <View style={{ gap: 12 }}>
              <Pressable
                style={styles.locationBtn}
                onPress={fillFromCurrentLocation}
                disabled={locating}
              >
                {locating ? (
                  <ActivityIndicator color={ink} />
                ) : (
                  <ThemedText style={styles.locationBtnText}>
                    📍 USE MY CURRENT LOCATION
                  </ThemedText>
                )}
              </Pressable>
              {(profileAddress || savedAddresses.length > 0) && (
                <View style={{ gap: 10 }}>
                  {profileAddress && (
                    <Pressable
                      onPress={() => {
                        applyAddress({ ...profileAddress, note: "" }, -1);
                        setShowForm(false);
                      }}
                      style={[
                        styles.addressOption,
                        selectedAddressIndex === -1 &&
                          styles.addressOptionSelected,
                      ]}
                    >
                      <AddressRadio selected={selectedAddressIndex === -1} />
                      <View style={styles.addressOptionBadge}>
                        <ThemedText style={styles.addressOptionBadgeText}>
                          PROFILE
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.addressOptionName}>
                        {profileAddress.fullName} – {profileAddress.phone}
                      </ThemedText>
                      <ThemedText style={styles.addressOptionLine}>
                        {profileAddress.addressLine}
                        {profileAddress.area ? `, ${profileAddress.area}` : ""}
                      </ThemedText>
                      <ThemedText style={styles.addressOptionLine}>
                        {profileAddress.city}, {profileAddress.state} -{" "}
                        {profileAddress.pincode}
                      </ThemedText>
                    </Pressable>
                  )}
                  {savedAddresses.map((addr, idx) => (
                    <Pressable
                      key={`saved-${idx}`}
                      onPress={() => {
                        applyAddress(addr, idx);
                        setShowForm(false);
                        setEditingAddress(false);
                      }}
                      style={[
                        styles.addressOption,
                        selectedAddressIndex === idx &&
                          styles.addressOptionSelected,
                      ]}
                    >
                      <AddressRadio selected={selectedAddressIndex === idx} />
                      <ThemedText style={styles.addressOptionName}>
                        {addr.fullName} – {addr.phone}
                      </ThemedText>
                      <ThemedText style={styles.addressOptionLine}>
                        {addr.addressLine}
                        {addr.area ? `, ${addr.area}` : ""}
                      </ThemedText>
                      <ThemedText style={styles.addressOptionLine}>
                        {addr.city}, {addr.state} - {addr.pincode}
                      </ThemedText>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => {
                      setShowForm(true);
                      setSelectedAddressIndex(null);
                      setShipping({
                        fullName: "",
                        phone: "",
                        addressLine: "",
                        area: "",
                        city: "",
                        state: "",
                        pincode: "",
                        country: "India",
                        note: "",
                      });
                    }}
                    style={[
                      styles.addressOption,
                      showForm && styles.addressOptionSelected,
                    ]}
                  >
                    <AddressRadio selected={showForm} />
                    <ThemedText style={styles.addressOptionName}>
                      + Add new address
                    </ThemedText>
                  </Pressable>
                </View>
              )}

              {(showForm || !(profileAddress || savedAddresses.length > 0)) && (
                <View style={styles.innerCard}>
                  <ThemedText style={styles.innerTitle}>
                    Address Details
                  </ThemedText>
                  <FieldLabel text="Full Name" required />
                  <TextInput
                    onChangeText={(t) =>
                      setShipping((s) => ({ ...s, fullName: t }))
                    }
                    placeholder="Full Name"
                    placeholderTextColor={muted}
                    style={styles.lineInput}
                    value={shipping.fullName}
                  />
                  <FieldLabel text="Phone Number" required />
                  <TextInput
                    keyboardType="phone-pad"
                    onChangeText={(t) =>
                      setShipping((s) => ({ ...s, phone: t }))
                    }
                    placeholder="Phone Number"
                    placeholderTextColor={muted}
                    style={styles.lineInput}
                    value={shipping.phone}
                  />
                  <FieldLabel text="Address Line" required />
                  <TextInput
                    onChangeText={(t) =>
                      setShipping((s) => ({ ...s, addressLine: t }))
                    }
                    placeholder="Address Line"
                    placeholderTextColor={muted}
                    style={styles.lineInput}
                    value={shipping.addressLine}
                  />
                  <FieldLabel text="Area / Landmark" />
                  <TextInput
                    onChangeText={(t) =>
                      setShipping((s) => ({ ...s, area: t }))
                    }
                    placeholder="Area / Landmark (Optional)"
                    placeholderTextColor={muted}
                    style={styles.lineInput}
                    value={shipping.area}
                  />
                  <View style={styles.row}>
                    <View style={styles.half}>
                      <FieldLabel text="City" required />
                      <TextInput
                        onChangeText={(t) =>
                          setShipping((s) => ({ ...s, city: t }))
                        }
                        placeholder="City"
                        placeholderTextColor={muted}
                        style={styles.lineInput}
                        value={shipping.city}
                      />
                    </View>
                    <View style={styles.half}>
                      <FieldLabel text="State" required />
                      <TextInput
                        onChangeText={(t) =>
                          setShipping((s) => ({ ...s, state: t }))
                        }
                        placeholder="State"
                        placeholderTextColor={muted}
                        style={styles.lineInput}
                        value={shipping.state}
                      />
                    </View>
                  </View>
                  <View style={styles.row}>
                    <View style={styles.half}>
                      <FieldLabel text="Pincode" required />
                      <TextInput
                        keyboardType="number-pad"
                        maxLength={6}
                        onChangeText={(t) => {
                          const digits = t.replace(/\D/g, "");
                          setShipping((s) => ({ ...s, pincode: digits }));
                          if (digits.length === 6) void lookupPincode(digits);
                        }}
                        placeholder="Pincode"
                        placeholderTextColor={muted}
                        style={styles.lineInput}
                        value={shipping.pincode}
                      />
                    </View>
                    <View style={styles.half}>
                      <FieldLabel text="Country" />
                      <TextInput
                        onChangeText={(t) =>
                          setShipping((s) => ({ ...s, country: t }))
                        }
                        placeholder="Country"
                        placeholderTextColor={muted}
                        style={styles.lineInput}
                        value={shipping.country}
                      />
                    </View>
                  </View>
                  {pinLoading && (
                    <ThemedText style={styles.pinHint}>
                      Looking up city and state...
                    </ThemedText>
                  )}
                  <FieldLabel text="Delivery Note" />
                  <TextInput
                    onChangeText={(t) =>
                      setShipping((s) => ({ ...s, note: t }))
                    }
                    placeholder="Delivery Note (Optional)"
                    placeholderTextColor={muted}
                    style={styles.lineInput}
                    value={shipping.note}
                  />
                  <Pressable
                    style={styles.saveAddrBtn}
                    onPress={() => {
                      if (validateShipping()) {
                        setEditingAddress(false);
                        setShowForm(false);
                      }
                    }}
                  >
                    <ThemedText style={styles.saveAddrText}>
                      SAVE ADDRESS
                    </ThemedText>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom checkout button */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          keyboardOpen && { display: "none" },
        ]}
      >
        <Pressable
          disabled={placing || (isBuyNow !== "true" && cartLoading)}
          onPress={placeOrder}
          style={[
            styles.primary,
            isBuyNow !== "true" && cartLoading && styles.disabledPrimary,
          ]}
        >
          <ThemedText style={styles.primaryText}>
            {placing
              ? "Placing order..."
              : isBuyNow !== "true" && cartLoading
                ? "Loading cart..."
                : `Place Order | ₹${total.toFixed(2)}`}
          </ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F2F2F2" },
  content: { padding: 16, paddingBottom: 130 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  back: { color: ink, fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  eyebrow: {
    color: muted,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "800",
  },
  title: {
    color: ink,
    fontSize: 38,
    lineHeight: 40,
    fontWeight: "800",
    marginTop: 32,
  },
  steps: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 32,
    marginBottom: 24,
  },
  step: { alignItems: "center", gap: 7 },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#D7E0D6",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: { backgroundColor: ink },
  stepNumber: { color: muted, fontSize: 12, fontWeight: "800" },
  stepNumberActive: { color: "#F4F4ED" },
  stepLabel: {
    color: muted,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "700",
  },
  stepLabelActive: { color: ink, fontWeight: "800" },
  form: { gap: 14 },
  input: {
    backgroundColor: field,
    borderRadius: 3,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: ink,
    fontSize: 14,
  },
  textarea: { height: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  panel: {
    backgroundColor: field,
    borderRadius: 4,
    padding: 20,
    gap: 12,
  },
  panelTitle: {
    color: ink,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  option: { gap: 4 },
  optionTitle: { color: ink, fontSize: 14, fontWeight: "800" },
  optionDesc: { color: muted, fontSize: 12, lineHeight: 18 },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lineName: { color: ink, fontSize: 14, fontWeight: "700" },
  lineValue: { color: ink, fontSize: 14, fontWeight: "800" },
  divider: { height: 1, backgroundColor: border, marginVertical: 4 },
  totalLabel: { color: ink, fontSize: 15, fontWeight: "900" },
  total: { color: ink, fontSize: 18, fontWeight: "900" },
  primary: {
    backgroundColor: "#F0552F",
    borderRadius: 50,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledPrimary: { opacity: 0.6 },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  addressPickerSection: {
    gap: 12,
    marginBottom: 22,
  },
  addressPickerTitle: {
    color: ink,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  formSectionLabel: {
    color: muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
    marginTop: 4,
  },
  addressOption: {
    borderRadius: 16,
    padding: 14,
    paddingRight: 48,
    gap: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#EDEDED",
  },
  addressOptionSelected: {
    backgroundColor: "#FFF5F2",
    borderColor: "#F0552F",
  },
  addressRadioPos: {
    position: "absolute",
    top: 14,
    right: 14,
  },
  addressOptionBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#e2bd19",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  addressOptionBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  addressOptionName: {
    color: ink,
    fontSize: 14,
    fontWeight: "800",
  },
  addressOptionLine: {
    color: "#6B6B6B",
    fontSize: 12.5,
    lineHeight: 18,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
  },
  backChevron: { color: ink, fontSize: 26, lineHeight: 28, fontWeight: "600" },
  topTitle: { color: ink, fontSize: 18, fontWeight: "800" },
  card: {
    backgroundColor: "#E9E9E9",
    borderRadius: 28,
    padding: 14,
    marginBottom: 16,
  },
  cardTitle: {
    color: ink,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
    marginLeft: 4,
  },
  innerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
  },
  innerTitle: { color: ink, fontSize: 15, fontWeight: "800", marginBottom: 12 },
  summaryLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
  },
  summaryName: { flex: 1, color: ink, fontSize: 13, fontWeight: "600" },
  summaryPrice: { color: ink, fontSize: 14, fontWeight: "800" },
  summaryDivider: { height: 1, backgroundColor: "#EEEEEE", marginVertical: 8 },
  payRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F6F6F6",
    borderWidth: 1.5,
    borderColor: "transparent",
    marginBottom: 8,
  },
  payRowSelected: { borderColor: "#F0552F", backgroundColor: "#FFF5F2" },
  payRowDisabled: { opacity: 0.5 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#BBBBBB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: "#F0552F" },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F0552F",
  },
  payLabel: { color: ink, fontSize: 14, fontWeight: "700" },
  payDesc: { color: muted, fontSize: 12, marginTop: 2 },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  changeLink: {
    color: "#F0552F",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 12,
  },
  addrName: { color: ink, fontSize: 14, fontWeight: "800" },
  addrLine: { color: muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  lineInput: {
    color: ink,
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  fieldLabel: {
    color: muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10,
  },
  requiredStar: { color: "#E53935", fontWeight: "800" },
  locationBtn: {
    height: 46,
    borderRadius: 53,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#F0552F",
    alignItems: "center",
    justifyContent: "center",
  },
  locationBtnText: {
    color: "#F0552F",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  pinHint: { color: muted, fontSize: 12, marginTop: 8 },
  remarksInput: {
    color: ink,
    fontSize: 14,
    fontWeight: "500",
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 44,
    maxHeight: 120,
  },
  saveAddrBtn: {
    marginTop: 16,
    height: 46,
    borderRadius: 53,
    backgroundColor: "#f8c9b1",
    alignItems: "center",
    justifyContent: "center",
  },
  saveAddrText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: "#F2F2F2",
  },
});
