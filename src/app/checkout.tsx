import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

export default function CheckoutScreen() {
  const { token, user } = useAuth();
  const { storeId } = useStore();
  const { items: allItems, cartId, loading: cartLoading, clearCart, removeItem } = useCart();

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
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number | null>(null);
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
                  addressLine: profAddr.addressLine,
                  area: profAddr.area,
                  city: profAddr.city,
                  state: profAddr.state,
                  pincode: profAddr.pincode,
                  country: profAddr.country,
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

  const storeIds = Array.from(
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

  const goNext = () => {
    if (section === "shipping") {
      if (
        !shipping.fullName ||
        !shipping.phone ||
        !shipping.addressLine ||
        !shipping.city ||
        !shipping.state ||
        !shipping.pincode
      )
        return Alert.alert(
          "Shipping details needed",
          "Complete your name, phone, address, city, state, and pincode before continuing.",
        );
      if (!/^\d{6}$/.test(shipping.pincode))
        return Alert.alert("Invalid pincode", "Enter a valid 6-digit pincode.");
      setSection("payment");
    } else if (section === "payment") setSection("review");
  };

  const placeOrder = async () => {
    if (!token) return router.push("/sign-in");

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
          area: shipping.area.trim() || undefined,
          city: shipping.city.trim(),
          state: shipping.state.trim(),
          pincode: shipping.pincode.trim(),
          country: shipping.country.trim() || "India",
        },
        note: shipping.note.trim() || undefined,
        paymentMethod: "COD",
      };

      console.log("[Checkout] Submitting Buy Now payload:", buyNowPayload);
      try {
        const response = await api.buyNow(token, buyNowPayload);
        // Save address after successful Buy Now order
        if (user && user._id) {
          await addSavedAddress(user._id, buyNowPayload.deliveryAddress);
        }
        console.log("[Checkout] Buy Now order created successfully:", response);
        Alert.alert("Order placed", "Your order has been created.", [
          {
            text: "View orders",
            onPress: () => router.replace("/(tabs)/orders"),
          },
        ]);
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
    setPlacing(true);
    const checkoutPayload = {
      cartId,
      storeIds,
      deliveryAddress: {
        fullName: shipping.fullName.trim(),
        phone: shipping.phone.trim(),
        addressLine: shipping.addressLine.trim(),
        area: shipping.area.trim() || undefined,
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
      if (checkoutStoreId) {
        // partial checkout: only remove this store's items, keep the others
        for (const item of items) await removeItem(item);
      } else {
        await clearCart();
      }
      Alert.alert("Order placed", "Your order has been created.", [
        {
          text: "View orders",
          onPress: () => router.replace("/(tabs)/orders"),
        },
      ]);
    } catch (error) {
      console.error("[Checkout] Order failed", {
        error,
        cartId,
        storeIds,
        itemCount: items.length,
      });
      Alert.alert(
        "Could not place order",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setPlacing(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable onPress={goBackOrHome}>
            <ThemedText style={styles.back}>BACK</ThemedText>
          </Pressable>
          <ThemedText style={styles.eyebrow}>
            CHECKOUT / {section.toUpperCase()}
          </ThemedText>
        </View>
        <ThemedText style={styles.title}>Complete your{`\n`}order.</ThemedText>
        <View style={styles.steps}>
          {(["shipping", "payment", "review"] as const).map((step, index) => (
            <Pressable
              key={step}
              onPress={() =>
                index <
                (["shipping", "payment", "review"] as const).indexOf(
                  section,
                ) && setSection(step)
              }
              style={styles.step}
            >
              <View
                style={[
                  styles.stepDot,
                  section === step && styles.stepDotActive,
                ]}
              >
                <ThemedText
                  style={[
                    styles.stepNumber,
                    section === step && styles.stepNumberActive,
                  ]}
                >
                  {index + 1}
                </ThemedText>
              </View>
              <ThemedText
                style={[
                  styles.stepLabel,
                  section === step && styles.stepLabelActive,
                ]}
              >
                {step}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {section === "shipping" && (
          <View style={styles.form}>
            {/* Saved addresses - profile + local */}
            {(profileAddress || savedAddresses.length > 0) && (
              <View style={styles.addressPickerSection}>
                <ThemedText style={styles.addressPickerTitle}>
                  Select a saved address
                </ThemedText>
                {profileAddress && (
                  <Pressable
                    onPress={() => {
                      setShipping({
                        fullName: profileAddress.fullName,
                        phone: profileAddress.phone,
                        addressLine: profileAddress.addressLine,
                        area: profileAddress.area,
                        city: profileAddress.city,
                        state: profileAddress.state,
                        pincode: profileAddress.pincode,
                        country: profileAddress.country || "India",
                        note: "",
                      });
                      setSelectedAddressIndex(-1);
                    }}
                    style={[
                      styles.addressOption,
                      selectedAddressIndex === -1 && styles.addressOptionSelected,
                    ]}
                  >
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
                      setShipping({
                        fullName: addr.fullName,
                        phone: addr.phone,
                        addressLine: addr.addressLine,
                        area: addr.area,
                        city: addr.city,
                        state: addr.state,
                        pincode: addr.pincode,
                        country: addr.country || "India",
                        note: addr.note || "",
                      });
                      setSelectedAddressIndex(idx);
                    }}
                    style={[
                      styles.addressOption,
                      selectedAddressIndex === idx && styles.addressOptionSelected,
                    ]}
                  >
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
                    selectedAddressIndex === null && styles.addressOptionSelected,
                  ]}
                >
                  <ThemedText style={styles.addressOptionName}>
                    + Use a new address
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {/* Manual form (always visible so user can tweak) */}
            <ThemedText style={styles.formSectionLabel}>
              {selectedAddressIndex !== null
                ? "Selected address (you can edit below)"
                : "Enter delivery details"}
            </ThemedText>
            <TextInput
              onChangeText={(text) =>
                setShipping((s) => ({ ...s, fullName: text }))
              }
              placeholder="Full Name"
              placeholderTextColor={muted}
              style={styles.input}
              value={shipping.fullName}
            />
            <TextInput
              keyboardType="phone-pad"
              onChangeText={(text) =>
                setShipping((s) => ({ ...s, phone: text }))
              }
              placeholder="Phone Number"
              placeholderTextColor={muted}
              style={styles.input}
              value={shipping.phone}
            />
            <TextInput
              onChangeText={(text) =>
                setShipping((s) => ({ ...s, addressLine: text }))
              }
              placeholder="Address Line"
              placeholderTextColor={muted}
              style={styles.input}
              value={shipping.addressLine}
            />
            <TextInput
              onChangeText={(text) => setShipping((s) => ({ ...s, area: text }))}
              placeholder="Area / Landmark (Optional)"
              placeholderTextColor={muted}
              style={styles.input}
              value={shipping.area}
            />
            <View style={styles.row}>
              <TextInput
                onChangeText={(text) =>
                  setShipping((s) => ({ ...s, city: text }))
                }
                placeholder="City"
                placeholderTextColor={muted}
                style={[styles.input, styles.half]}
                value={shipping.city}
              />
              <TextInput
                onChangeText={(text) =>
                  setShipping((s) => ({ ...s, state: text }))
                }
                placeholder="State"
                placeholderTextColor={muted}
                style={[styles.input, styles.half]}
                value={shipping.state}
              />
            </View>
            <View style={styles.row}>
              <TextInput
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={(text) =>
                  setShipping((s) => ({ ...s, pincode: text }))
                }
                placeholder="Pincode"
                placeholderTextColor={muted}
                style={[styles.input, styles.half]}
                value={shipping.pincode}
              />
              <TextInput
                onChangeText={(text) =>
                  setShipping((s) => ({ ...s, country: text }))
                }
                placeholder="Country"
                placeholderTextColor={muted}
                style={[styles.input, styles.half]}
                value={shipping.country}
              />
            </View>
            <TextInput
              multiline
              numberOfLines={3}
              onChangeText={(text) => setShipping((s) => ({ ...s, note: text }))}
              placeholder="Delivery Note (Optional)"
              placeholderTextColor={muted}
              style={[styles.input, styles.textarea]}
              value={shipping.note}
            />
          </View>
        )}
        {section === "payment" && (
          <View style={styles.panel}>
            <ThemedText style={styles.panelTitle}>Payment Method</ThemedText>
            <View style={styles.option}>
              <ThemedText style={styles.optionTitle}>Cash on Delivery</ThemedText>
              <ThemedText style={styles.optionDesc}>
                Pay when your gear arrives at your door.
              </ThemedText>
            </View>
          </View>
        )}
        {section === "review" && (
          <View style={styles.panel}>
            <ThemedText style={styles.panelTitle}>Review order</ThemedText>
            {isBuyNow === "true" ? (
              <View style={styles.line}>
                <ThemedText style={styles.lineName}>
                  {buyNowProduct ? buyNowProduct.title : "Selected Product"} × {numBuyNowQty}
                </ThemedText>
                <ThemedText style={styles.lineValue}>
                  ₹{buyNowTotal}
                </ThemedText>
              </View>
            ) : (
              items.map((item) => (
                <View key={item.id} style={styles.line}>
                  <ThemedText style={styles.lineName}>
                    {"title" in item.product
                      ? item.product.title
                      : item.product.name}{" "}
                    × {item.quantity}
                  </ThemedText>
                  <ThemedText style={styles.lineValue}>
                    ₹{item.product.price * item.quantity}
                  </ThemedText>
                </View>
              ))
            )}
            {/* Saved addresses list */}
            {savedAddresses.length > 0 && selectedAddressIndex === null && (
              <View style={{ marginTop: 20 }}>
                <ThemedText style={{ marginBottom: 8, fontWeight: "800" }}>Select a saved address</ThemedText>
                {savedAddresses.map((addr, idx) => (
                  <Pressable key={idx} onPress={() => {
                    setShipping({
                      fullName: addr.fullName,
                      phone: addr.phone,
                      addressLine: addr.addressLine,
                      area: addr.area,
                      city: addr.city,
                      state: addr.state,
                      pincode: addr.pincode,
                      country: addr.country || "India",
                      note: addr.note || "",
                    });
                    setSelectedAddressIndex(idx);
                  }} style={{ padding: 10, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, marginBottom: 8 }}>
                    <ThemedText>{addr.fullName} – {addr.phone}</ThemedText>
                    <ThemedText>{addr.addressLine}, {addr.area}</ThemedText>
                    <ThemedText>{addr.city}, {addr.state} - {addr.pincode}</ThemedText>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.line}>
              <ThemedText style={styles.totalLabel}>Total</ThemedText>
              <ThemedText style={styles.total}>₹{total.toFixed(2)}</ThemedText>
            </View>
          </View>
        )}
        <Pressable
          disabled={placing || (isBuyNow !== "true" && section === "review" && cartLoading)}
          onPress={section === "review" ? placeOrder : goNext}
          style={[
            styles.primary,
            isBuyNow !== "true" && section === "review" && cartLoading && styles.disabledPrimary,
          ]}
        >
          <ThemedText style={styles.primaryText}>
            {placing
              ? "PLACING ORDER..."
              : isBuyNow !== "true" && section === "review" && cartLoading
                ? "LOADING CART..."
                : section === "review"
                  ? "PLACE ORDER"
                  : "CONTINUE"}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F4ED" },
  content: { padding: 24, paddingBottom: 48 },
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
    backgroundColor: ink,
    borderRadius: 3,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  disabledPrimary: { opacity: 0.6 },
  primaryText: {
    color: "#F4F4ED",
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: "800",
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
  borderRadius: 18,
  padding: 16,
  gap: 5,
  backgroundColor: "rgba(255, 255, 255, 0.35)",
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.55)",
  shadowColor: "#17211D",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
  elevation: 2,
  overflow: "hidden",
},
addressOptionSelected: {
  backgroundColor: "rgba(227, 228, 228, 0.9)",
  borderColor: "rgba(23, 33, 29, 0.9)",
  shadowOpacity: 0.18,
  shadowRadius: 18,
},
addressOptionBadge: {
  alignSelf: "flex-start",
  backgroundColor: "rgba(19, 89, 61, 0.85)",
  paddingHorizontal: 8,
  paddingVertical: 3,
  borderRadius: 6,
  marginBottom: 4,
},
addressOptionBadgeText: {
  color: "#F4F4ED",
  fontSize: 9,
  fontWeight: "900",
  letterSpacing: 1.4,
},
addressOptionName: {
  color: ink,
  fontSize: 14,
  fontWeight: "800",
},
addressOptionLine: {
  color: muted,
  fontSize: 12.5,
  lineHeight: 18,
},
});
