import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
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
import {
  addSavedAddress,
  createSavedAddress,
  getSavedAddresses,
} from "@/lib/addressStorage";
import { api, apiImageUrl, type ApiProduct } from "@/lib/api";
import { goBackOrHome } from "@/lib/navigation";
import { deliveryDateText, shippingChargeText } from "@/lib/delivery-text";
import { tierPriceFor } from "@/lib/pricing";
import { buildBill, pickGst } from "@/lib/gst";
import { useStore } from "@/lib/store-context";
import { usePayuPayment } from "@/lib/use-payu-payment";

const ink = "#17211D";
const muted = "#748078";
const field = "#E4ECE4";
const border = "#D7E0D6";
const brand = "#f19c87";

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

const itemImage = (p: any): string | undefined => {
  const raw = p?.image ?? p?.images?.[0];
  return typeof raw === "string" && raw ? apiImageUrl(raw) : undefined;
};

const discountOf = (p: ApiProduct) =>
  typeof p.originalPrice === "number" && p.originalPrice > p.price
    ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
    : null;

function OrderLine({
  image,
  name,
  label,
  quantity,
  unitPrice,
  unitMrp,
}: {
  image?: string;
  name: string;
  label?: string;
  quantity: number;
  unitPrice: number;
  unitMrp?: number;
}) {
  const total = unitPrice * quantity;
  const hasDiscount = typeof unitMrp === "number" && unitMrp > unitPrice;
  const mrpTotal = hasDiscount ? unitMrp! * quantity : undefined;
  const savings = mrpTotal !== undefined ? mrpTotal - total : 0;
  const off = hasDiscount
    ? Math.round(((unitMrp! - unitPrice) / unitMrp!) * 100)
    : null;

  return (
    <View style={styles.olRow}>
      <View style={styles.olImageBox}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={styles.olImage}
            contentFit="contain"
          />
        ) : (
          <Ionicons name="image-outline" size={22} color={muted} />
        )}
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <ThemedText style={styles.olName} numberOfLines={2}>
          {name}
        </ThemedText>
        {!!label && <ThemedText style={styles.olLabel}>{label}</ThemedText>}

        <View style={styles.olMetaRow}>
          <ThemedText style={styles.olMeta}>Qty: {quantity}</ThemedText>
          <ThemedText style={styles.olMeta}>•</ThemedText>
          <ThemedText style={styles.olMeta}>
            {unitPrice > 0 ? `₹${unitPrice} each` : "Price pending"}
          </ThemedText>
          {hasDiscount && (
            <ThemedText style={styles.olOriginal}>₹{unitMrp}</ThemedText>
          )}
        </View>

        {hasDiscount && (
          <ThemedText style={styles.olSave}>
            {off}% off · You save ₹{savings}
          </ThemedText>
        )}
      </View>

      <View style={styles.olRight}>
        {mrpTotal !== undefined && (
          <ThemedText style={styles.olOriginal}>₹{mrpTotal}</ThemedText>
        )}
        <ThemedText style={styles.olPrice}>
          {unitPrice > 0 ? `₹${total}` : "—"}
        </ThemedText>
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
    addItem,
    changeQuantity,
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
  const [savingAddress, setSavingAddress] = useState(false);
  // once the user has saved/chosen an address, don't auto-select over it
  const userPickedRef = useRef(false);
  const [editingAddress, setEditingAddress] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [remarksHeight, setRemarksHeight] = useState(44);
  const scrollRef = useRef<ScrollView>(null);
  const addressYRef = useRef(0);
  const paymentYRef = useRef(0);
  const [billOpen, setBillOpen] = useState(true);
  const [bottomBarH, setBottomBarH] = useState(200);
  const [addressOpen, setAddressOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const sheetMaxH = Dimensions.get("window").height * 0.85;

  // close the address sheet as soon as an address is confirmed
  useEffect(() => {
    if (!editingAddress) setAddressOpen(false);
  }, [editingAddress]);
  const [suggestions, setSuggestions] = useState<ApiProduct[]>([]);
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof api.checkoutPreview>
  > | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const payu = usePayuPayment();

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    api
      .products(storeId)
      .then((res) => {
        if (active) setSuggestions(res.products);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [storeId]);

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

  const [paymentChoice, setPaymentChoice] = useState<"COD" | "ONLINE">("COD");
  const [onlineOnlyLearned, setOnlineOnlyLearned] = useState(false);
  const storeAny: any = activeStore;
  // replace onlinePaymentOnly / onlineOnly with your real backend field name
  const onlineOnlyStore =
    onlineOnlyLearned ||
    Boolean(storeAny?.onlinePaymentOnly ?? storeAny?.onlineOnly);

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
    if (userPickedRef.current || selectedAddressIndex !== null || showForm)
      return;
    if (profileAddress) {
      applyAddress({ ...profileAddress, note: "" }, -1);
      setEditingAddress(false);
    } else if (savedAddresses.length > 0) {
      applyAddress(savedAddresses[0], 0);
      setEditingAddress(false);
    }
  }, [profileAddress, savedAddresses]);

  const paymentOptions = [
    {
      key: "COD",
      label: "Cash on Delivery",
      desc: "Pay when your order arrives",
      disabled: false,
    },
    {
      key: "ONLINE",
      label: "Pay Online",
      desc: "UPI, cards and net banking",
      disabled: false,
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

      // Load saved addresses from the backend
      getSavedAddresses(token, { fullName: user?.name, phone: user?.phone })
        .then(setSavedAddresses)
        .catch(() => setSavedAddresses([]));
    }
  }, [isBuyNow, productId, storeId, token, user]);

  const [numBuyNowQty, setNumBuyNowQty] = useState(Number(buyNowQty) || 1);
  const buyNowVariant = buyNowProduct?.variants
    ?.flatMap((g) => [g, ...(g.sizeVariants ?? [])])
    .find((v) => v._id === variantId || v.id === variantId);
  const buyNowPrice =
    tierPriceFor(
      buyNowProduct ? { ...buyNowProduct, variantId } : null,
      numBuyNowQty,
    ) ??
    buyNowVariant?.offerPrice ??
    buyNowProduct?.price ??
    0;
  const buyNowTotal = buyNowPrice * numBuyNowQty;

  const total =
    isBuyNow === "true"
      ? buyNowTotal
      : items.reduce(
          (sum, item) =>
            sum +
            (tierPriceFor(item.product, item.quantity) ?? item.product.price) *
              item.quantity,
          0,
        );

  const gstLines =
    isBuyNow === "true"
      ? [
          {
            unitPrice: buyNowPrice,
            quantity: numBuyNowQty,
            gst: pickGst(buyNowVariant?.effectiveGst, buyNowProduct?.gst),
            gstInclusive: Boolean(buyNowProduct?.gstInclusive),
          },
        ]
      : items.map((item) => {
          const p: any = item.product;
          const listed = suggestions.find((x) => x._id === item.id);
          return {
            unitPrice:
              tierPriceFor(item.product, item.quantity) ?? item.product.price,
            quantity: item.quantity,
            gst: p?.gst ?? listed?.gst,
            gstInclusive: Boolean(p?.gstInclusive ?? listed?.gstInclusive),
          };
        });
  const gstBill = buildBill(gstLines);

  // price-on-request items can only be paid online after the quote is accepted
  const onlineBlocked =
    isBuyNow === "true"
      ? buyNowPrice <= 0
      : items.some(
          (i) => (tierPriceFor(i.product, i.quantity) ?? i.product.price) <= 0,
        );

  useEffect(() => {
    if (onlineOnlyStore) {
      if (paymentChoice !== "ONLINE") setPaymentChoice("ONLINE");
      return;
    }
    if (onlineBlocked && paymentChoice === "ONLINE") setPaymentChoice("COD");
  }, [onlineBlocked, paymentChoice, onlineOnlyStore]);

  // Cart has a price-on-request item AND other items -> one order per product
  const splitOrders =
    isBuyNow !== "true" &&
    items.length > 1 &&
    items.some(
      (i) => (tierPriceFor(i.product, i.quantity) ?? i.product.price) <= 0,
    );

  const shippingCharge = preview?.totalShipping ?? 0;
  const payable = gstBill.total + shippingCharge;
  const totalText =
    total > 0
      ? `₹${payable.toFixed(2)}${onlineBlocked ? " + quote" : ""}`
      : "Price pending";

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

  useEffect(() => {
    const buyNow = isBuyNow === "true";
    if (
      !token ||
      !/^\d{6}$/.test(shipping.pincode) ||
      (buyNow ? !productId : !cartId || !items.length)
    ) {
      setPreview(null);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      try {
        const res = await api.checkoutPreview(token, {
          ...(buyNow
            ? {
                productId: String(productId),
                variantId: variantId ? String(variantId) : undefined,
                quantity: numBuyNowQty,
              }
            : { cartId: cartId!, storeIds }),
          paymentMethod: paymentChoice,
          deliveryAddress: {
            pincode: shipping.pincode,
            state: shipping.state,
            country: shipping.country || "India",
          },
        });
        if (active && res.success) setPreview(res);
      } catch {
        if (active) setPreview(null);
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [
    token,
    shipping.pincode,
    shipping.state,
    shipping.country,
    isBuyNow,
    productId,
    variantId,
    numBuyNowQty,
    cartId,
    items.length,
    paymentChoice,
    storeIds.join(","),
  ]);

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
  // Save the address to the user's account so it survives uninstall.
  // Only when the profile has no address yet, so an existing one isn't overwritten.
  const saveAddressToProfile = (a: {
    addressLine: string;
    area?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  }) => {
    if (!token || profileAddress) return;
    api
      .updateProfile(token, { address: a })
      .then(() =>
        setProfileAddress({
          ...a,
          fullName: shipping.fullName,
          phone: shipping.phone,
          isProfile: true,
        }),
      )
      .catch(() => undefined);
  };

  const saveNewAddress = async () => {
    if (!validateShipping()) return;
    if (!token) return router.push("/sign-in");

    const confirmLocally = () => {
      userPickedRef.current = true;
      setEditingAddress(false);
      setShowForm(false);
    };

    setSavingAddress(true);
    try {
      await createSavedAddress(token, {
        addressLine: shipping.addressLine,
        area: shipping.area,
        city: shipping.city,
        state: shipping.state,
        pincode: shipping.pincode,
        country: shipping.country || "India",
      });
      const list = await getSavedAddresses(token, {
        fullName: user?.name,
        phone: user?.phone,
      });
      setSavedAddresses(list);
      const n = (v?: string) => (v ?? "").trim().toLowerCase();
      const idx = list.findIndex(
        (a) =>
          n(a.addressLine) === n(shipping.addressLine) &&
          n(a.pincode) === n(shipping.pincode),
      );
      setSelectedAddressIndex(idx >= 0 ? idx : null);
      confirmLocally();
    } catch (e) {
      Alert.alert(
        "Could not save address",
        e instanceof Error ? e.message : "Please try again.",
        [
          { text: "Use for this order only", onPress: confirmLocally },
          { text: "OK", style: "cancel" },
        ],
      );
    } finally {
      setSavingAddress(false);
    }
  };

  const addressReady = hasAddress && !editingAddress;
  const addressLabel =
    selectedAddressIndex !== null && selectedAddressIndex >= 0
      ? savedAddresses[selectedAddressIndex]?.label || "Home"
      : "Home";
  const addressSummary = [shipping.addressLine, shipping.area, shipping.city]
    .filter(Boolean)
    .join(", ");
  const paymentLabel = onlineBlocked
    ? "After store quote"
    : (paymentOptions.find((o) => o.key === paymentChoice)?.label ??
      "Cash on Delivery");
  const orderLineCount = isBuyNow === "true" ? 1 : items.length;
  const cartBusy = isBuyNow !== "true" && cartLoading;

  const inOrderIds = new Set<string>([
    ...items.map((i) => i.id),
    ...(isBuyNow === "true" && productId ? [String(productId)] : []),
  ]);
  const available = suggestions.filter((p) => !inOrderIds.has(p._id));
  const youMightLike = available.slice(0, Math.floor(available.length / 4) * 4);

  const scrollToAddress = () =>
    scrollRef.current?.scrollTo({
      y: Math.max(addressYRef.current - 12, 0),
      animated: true,
    });
  const scrollToPayment = () =>
    scrollRef.current?.scrollTo({
      y: Math.max(paymentYRef.current - 12, 0),
      animated: true,
    });

  // Bottom button while no address is confirmed yet
  const handleAddressButton = () => {
    if (hasAddress && validateShipping()) {
      setEditingAddress(false);
      setShowForm(false);
      return;
    }
    openEditor();
    setAddressOpen(true);
  };

  const closeAddress = () => {
    setAddressOpen(false);
    if (hasAddress) setEditingAddress(false);
  };

  const changeAddress = () => {
    openEditor();
    setAddressOpen(true);
  };

  const addSuggestion = async (p: ApiProduct) => {
    // A Buy Now order only contains one product, so open the product instead
    if (isBuyNow === "true") {
      router.push({ pathname: "/product/[id]", params: { id: p._id } });
      return;
    }
    if (!token) {
      router.push("/sign-in");
      return;
    }
    setAddingId(p._id);
    try {
      await addItem(
        {
          ...p,
          storeId: p.storeId ?? checkoutStoreId ?? activeStore?.mongoId,
        },
        1,
      );
    } catch (e) {
      Alert.alert(
        "Could not add product",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setAddingId(null);
    }
  };

  const placeOrder = async () => {
    if (!token) return router.push("/sign-in");
    if (!validateShipping()) {
      setEditingAddress(true);
      setShowForm(true);
      setAddressOpen(true);
      return;
    }

    const blockedStore = preview?.stores.find((st) => !st.ok);
    if (blockedStore) {
      Alert.alert(
        "Cannot deliver here",
        blockedStore.message || "This store does not deliver to your address.",
      );
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
        ...(onlineBlocked ? {} : { paymentMethod: paymentChoice }),
      };

      console.log("[Checkout] Submitting Buy Now payload:", buyNowPayload);
      try {
        const response = await api.buyNow(token, buyNowPayload);
        await addSavedAddress(token, buyNowPayload.deliveryAddress);
        saveAddressToProfile(buyNowPayload.deliveryAddress);
        const orderId =
          (response as any)?.order?._id ||
          (response as any)?._id ||
          (response as any)?.data?._id ||
          `#${Date.now().toString().slice(-7)}`;
        if (paymentChoice === "ONLINE" && !onlineBlocked) {
          await payu.start(
            String(orderId),
            String((response as any)?.order?.totalAmount ?? payable),
            buyNowProduct?.title ?? "Selected Product",
          );
          return;
        }
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
        if (
          error instanceof Error &&
          /online payment only/i.test(error.message)
        ) {
          setOnlineOnlyLearned(true);
        }
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

    if (splitOrders) {
      setPlacing(true);
      const deliveryAddress = {
        fullName: shipping.fullName.trim(),
        phone: shipping.phone.trim(),
        addressLine: shipping.addressLine.trim(),
        area: (shipping.area ?? "").trim() || undefined,
        city: shipping.city.trim(),
        state: shipping.state.trim(),
        pincode: shipping.pincode.trim(),
        country: shipping.country.trim() || "India",
      };
      let placed = 0;
      let onlineOnly = false;
      const failed: string[] = [];

      for (const item of items) {
        const name =
          "title" in item.product ? item.product.title : item.product.name;
        try {
          await api.buyNow(token, {
            productId: String(item.id),
            variantId: (item.product as any).variantId
              ? String((item.product as any).variantId)
              : undefined,
            quantity: item.quantity,
            deliveryAddress,
            note: orderNote,
            // paymentMethod: "COD",
          });
          placed += 1;
          await removeItem(item); // only remove lines whose order succeeded
        } catch (e) {
          console.error("[Checkout] Split order failed", name, e);
          if (e instanceof Error && /online payment only/i.test(e.message)) {
            onlineOnly = true;
          }
          failed.push(name);
        }
      }

      try {
        if (placed > 0) {
          await addSavedAddress(token, deliveryAddress);
          saveAddressToProfile(deliveryAddress);
        }
      } catch {}
      setPlacing(false);

      if (onlineOnly && placed === 0) {
        setOnlineOnlyLearned(true);
        Alert.alert(
          "Online payment only",
          "This store accepts online payment only, so price-on-request items can't be ordered yet. Remove them and pay online for the rest.",
        );
        return;
      }

      if (failed.length === 0) {
        Alert.alert(
          "Orders placed",
          `${placed} requests were sent to the store. You'll be notified when the store replies with a price, and you can pay or choose COD then.`,
        );
        router.replace("/orders" as any);
      } else {
        Alert.alert(
          placed > 0 ? "Some orders failed" : "Could not place orders",
          `${placed} placed. Not placed (still in your cart): ${failed.join(", ")}.`,
          placed > 0
            ? [{ text: "OK", onPress: () => router.replace("/cart") }]
            : undefined,
        );
      }
      return;
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
      note: orderNote,
      ...(onlineBlocked ? {} : { paymentMethod: paymentChoice }),
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
      await addSavedAddress(token, checkoutPayload.deliveryAddress);
      saveAddressToProfile(checkoutPayload.deliveryAddress);
      // Remove ordered items from the cart
      for (const item of items) {
        await removeItem(item);
      }
      console.log("[Checkout] Order created", response);
      if (paymentChoice === "ONLINE" && !onlineBlocked) {
        const created: any[] = (response as any)?.orders ?? [];
        if (created.length === 1) {
          await payu.start(
            String(created[0]._id),
            String(created[0].totalAmount ?? total),
            items.length > 0
              ? `${items[0].quantity}x ${"title" in items[0].product ? items[0].product.title : items[0].product.name}`
              : "Order items",
          );
        } else {
          Alert.alert(
            "Orders placed",
            "You have more than one order. Pay for each one from the Orders page.",
          );
          router.replace("/orders" as any);
        }
        return;
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

      if (
        error instanceof Error &&
        /online payment only|checkout failed for all stores/i.test(error.message)
      ) {
        setOnlineOnlyLearned(true);
        setPaymentChoice("ONLINE");
        Alert.alert(
          "Online payment only",
          "This store accepts online payment only. Pay Online is now selected. Tap Place Order again.",
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
            { paddingBottom: keyboardOpen ? 40 : bottomBarH + 24 },
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

          {/* Order info */}
          <View style={styles.whiteCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIcon}>
                <Ionicons name="bag-handle-outline" size={22} color={ink} />
              </View>
              <View>
                <ThemedText style={styles.infoTitle}>Order Info</ThemedText>
                <ThemedText style={styles.infoSub}>
                  Shipment of {orderLineCount} item
                  {orderLineCount === 1 ? "" : "s"}
                </ThemedText>
                {splitOrders && (
                  <ThemedText style={styles.infoSub}>
                    Each product will be placed as a separate order.
                  </ThemedText>
                )}
              </View>
            </View>
            <View style={styles.infoDivider} />

            {isBuyNow === "true" ? (
              <OrderLine
                image={itemImage(buyNowProduct)}
                name={buyNowProduct ? buyNowProduct.title : "Selected Product"}
                label={[buyNowVariant?.size, buyNowVariant?.weight]
                  .filter(Boolean)
                  .join(" · ")}
                quantity={numBuyNowQty}
                unitPrice={buyNowPrice}
                unitMrp={
                  typeof buyNowVariant?.mrp === "number"
                    ? buyNowVariant.mrp
                    : undefined
                }
              />
            ) : (
              items.map((item) => {
                const unit =
                  tierPriceFor(item.product, item.quantity) ??
                  item.product.price;
                const mrp = (item.product as any).originalPrice;
                return (
                  <OrderLine
                    key={item.lineId ?? item.id}
                    image={itemImage(item.product)}
                    name={
                      "title" in item.product
                        ? item.product.title
                        : item.product.name
                    }
                    label={item.variantLabel}
                    quantity={item.quantity}
                    unitPrice={unit}
                    unitMrp={typeof mrp === "number" ? mrp : undefined}
                  />
                );
              })
            )}
          </View>

          {/* Delivery estimate */}
          {!!preview && preview.stores.some((st) => !st.ok || !!st.delivery) && (
            <View style={styles.whiteCard}>
              <View style={styles.infoHeader}>
                <View style={styles.infoIcon}>
                  <Ionicons name="car-outline" size={22} color={ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.infoTitle}>Delivery</ThemedText>
                  {preview.stores.map((st) =>
                    !st.ok ? (
                      <ThemedText
                        key={st.storeId}
                        style={[styles.infoSub, { color: "#E53935" }]}
                      >
                        {st.message || "Cannot deliver to this address"}
                      </ThemedText>
                    ) : st.delivery ? (
                      <View key={st.storeId}>
                        <ThemedText style={styles.infoSub}>
                          {preview.stores.length > 1 && st.storeName
                            ? `${st.storeName}: `
                            : ""}
                          Delivery by{" "}
                          <ThemedText style={{ fontWeight: "800", color: ink }}>
                            {deliveryDateText(st.delivery)}
                          </ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.infoSub}>
                          {shippingChargeText(st.delivery)}
                          {st.delivery.shippingNote
                            ? ` · ${st.delivery.shippingNote}`
                            : ""}
                        </ThemedText>
                      </View>
                    ) : null,
                  )}
                </View>
              </View>
            </View>
          )}

          {/* You might also like */}
          {youMightLike.length > 0 && (
            <View style={styles.skyCard}>
              <ThemedText style={styles.sgTitle}>
                You might also like
              </ThemedText>
              <View style={styles.sgGrid}>
                {youMightLike.map((p) => {
                  const off = discountOf(p);
                  return (
                    <Pressable
                      key={p._id}
                      style={styles.sgCard}
                      onPress={() =>
                        router.push({
                          pathname: "/product/[id]",
                          params: { id: p._id },
                        })
                      }
                    >
                      <View>
                        <View style={styles.sgImageBox}>
                          <Image
                            source={{ uri: apiImageUrl(p.image) }}
                            style={styles.sgImage}
                            contentFit="cover"
                          />
                          <Pressable
                            style={styles.sgPlus}
                            disabled={addingId === p._id}
                            onPress={() => addSuggestion(p)}
                            hitSlop={6}
                          >
                            {addingId === p._id ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Ionicons name="add" size={18} color="#FFFFFF" />
                            )}
                          </Pressable>
                          {off !== null && (
                            <View style={styles.sgOffBadge}>
                              <ThemedText style={styles.sgOffBadgeText}>
                                {off}%
                              </ThemedText>
                            </View>
                          )}
                        </View>
                        <ThemedText style={styles.sgName} numberOfLines={2}>
                          {p.title}
                        </ThemedText>

                        {typeof p.rating === "number" && p.rating > 0 && (
                          <ThemedText style={styles.sgRating}>
                            ★ {p.rating.toFixed(1)}
                          </ThemedText>
                        )}
                      </View>

                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Payment options (same as before) */}
          <Modal
            visible={paymentOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setPaymentOpen(false)}
          >
            <View style={styles.sheetBackdrop}>
              <Pressable
                style={{ flex: 1 }}
                onPress={() => setPaymentOpen(false)}
              />
              <View style={[styles.sheet, { maxHeight: sheetMaxH }]}>
                <View style={styles.sheetHeader}>
                  <ThemedText style={styles.sheetTitle}>Pay using</ThemedText>
                  <Pressable onPress={() => setPaymentOpen(false)} hitSlop={10}>
                    <Ionicons name="close" size={24} color={ink} />
                  </Pressable>
                </View>
                <View style={styles.innerCard}>
                  <ThemedText style={styles.innerTitle}>
                    Payment Options
                  </ThemedText>
                  {paymentOptions
                    .filter((o) => !(o.key === "COD" && onlineOnlyStore))
                    .map((opt) => {
                    const selected = paymentChoice === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        disabled={
                          opt.disabled ||
                          (opt.key === "ONLINE" && onlineBlocked)
                        }
                        onPress={() => {
                          setPaymentChoice(opt.key);
                          setPaymentOpen(false);
                        }}
                        style={[
                          styles.payRow,
                          selected && styles.payRowSelected,
                          (opt.disabled ||
                            (opt.key === "ONLINE" && onlineBlocked)) &&
                            styles.payRowDisabled,
                        ]}
                      >
                        <View
                          style={[
                            styles.radio,
                            selected && styles.radioSelected,
                          ]}
                        >
                          {selected && <View style={styles.radioDot} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.payLabel}>
                            {opt.label}
                          </ThemedText>
                          <ThemedText style={styles.payDesc}>
                            {opt.key === "ONLINE" && onlineBlocked
                              ? "Not available until the store confirms the price"
                              : opt.desc}
                          </ThemedText>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </Modal>

          {/* Delivery address */}
          <Modal
            visible={addressOpen}
            transparent
            animationType="slide"
            onRequestClose={closeAddress}
          >
            <View style={styles.sheetBackdrop}>
              <Pressable style={{ flex: 1 }} onPress={closeAddress} />
              <KeyboardAvoidingView behavior="padding">
                <View style={[styles.sheet, { maxHeight: sheetMaxH }]}>
                  <View style={styles.sheetHeader}>
                    <ThemedText style={styles.sheetTitle}>
                      Delivery address
                    </ThemedText>
                    <Pressable onPress={closeAddress} hitSlop={10}>
                      <Ionicons name="close" size={24} color={ink} />
                    </Pressable>
                  </View>
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.card}>
                      <View style={styles.addressHeader}>
                        <ThemedText style={styles.cardTitle}>
                          Delivery Address
                        </ThemedText>
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
                            {shipping.city}, {shipping.state} -{" "}
                            {shipping.pincode}
                          </ThemedText>
                        </View>
                      )}

                      {!editingAddress && !hasAddress && (
                        <Pressable
                          style={styles.innerCard}
                          onPress={openEditor}
                        >
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
                                    applyAddress(
                                      { ...profileAddress, note: "" },
                                      -1,
                                    );
                                    setShowForm(false);
                                    setEditingAddress(false);
                                  }}
                                  style={[
                                    styles.addressOption,
                                    selectedAddressIndex === -1 &&
                                      styles.addressOptionSelected,
                                  ]}
                                >
                                  <AddressRadio
                                    selected={selectedAddressIndex === -1}
                                  />
                                  <View style={styles.addressOptionBadge}>
                                    <ThemedText
                                      style={styles.addressOptionBadgeText}
                                    >
                                      PROFILE
                                    </ThemedText>
                                  </View>
                                  <ThemedText style={styles.addressOptionName}>
                                    {profileAddress.fullName} –{" "}
                                    {profileAddress.phone}
                                  </ThemedText>
                                  <ThemedText style={styles.addressOptionLine}>
                                    {profileAddress.addressLine}
                                    {profileAddress.area
                                      ? `, ${profileAddress.area}`
                                      : ""}
                                  </ThemedText>
                                  <ThemedText style={styles.addressOptionLine}>
                                    {profileAddress.city},{" "}
                                    {profileAddress.state} -{" "}
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
                                  <AddressRadio
                                    selected={selectedAddressIndex === idx}
                                  />
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

                          {(showForm ||
                            !(profileAddress || savedAddresses.length > 0)) && (
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
                                      setShipping((s) => ({
                                        ...s,
                                        pincode: digits,
                                      }));
                                      if (digits.length === 6)
                                        void lookupPincode(digits);
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
                                style={[
                                  styles.saveAddrBtn,
                                  savingAddress && { opacity: 0.6 },
                                ]}
                                disabled={savingAddress}
                                onPress={saveNewAddress}
                              >
                                <ThemedText style={styles.saveAddrText}>
                                  {savingAddress ? "SAVING..." : "SAVE ADDRESS"}
                                </ThemedText>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </View>
          </Modal>

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

          {/* Bill details (dropdown, always last) */}
          <View style={styles.card}>
            <Pressable
              style={styles.billHeader}
              onPress={() => setBillOpen((v) => !v)}
            >
              <ThemedText style={styles.billTitle}>Bill details</ThemedText>
              <View style={styles.billRight}>
                <ThemedText style={styles.billMini}>{totalText}</ThemedText>
                <Ionicons
                  name={billOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={ink}
                />
              </View>
            </Pressable>

            {billOpen && (
              <View style={[styles.innerCard, { marginTop: 12 }]}>
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
                    <View
                      key={item.lineId ?? item.id}
                      style={styles.summaryLine}
                    >
                      <ThemedText style={styles.summaryName} numberOfLines={1}>
                        {item.quantity}x{" "}
                        {"title" in item.product
                          ? item.product.title
                          : item.product.name}
                      </ThemedText>
                      <ThemedText style={styles.summaryPrice}>
                        ₹
                        {(tierPriceFor(item.product, item.quantity) ??
                          item.product.price) * item.quantity}
                      </ThemedText>
                    </View>
                  ))
                )}
                {gstBill.totalGst > 0 && (
                  <>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryLine}>
                      <ThemedText style={styles.summaryName}>
                        Subtotal (excl. GST)
                      </ThemedText>
                      <ThemedText style={styles.summaryPrice}>
                        ₹{gstBill.subtotal.toFixed(2)}
                      </ThemedText>
                    </View>
                    {gstBill.cgst > 0 && (
                      <View style={styles.summaryLine}>
                        <ThemedText style={styles.summaryName}>CGST</ThemedText>
                        <ThemedText style={styles.summaryPrice}>
                          ₹{gstBill.cgst.toFixed(2)}
                        </ThemedText>
                      </View>
                    )}
                    {gstBill.sgst > 0 && (
                      <View style={styles.summaryLine}>
                        <ThemedText style={styles.summaryName}>SGST</ThemedText>
                        <ThemedText style={styles.summaryPrice}>
                          ₹{gstBill.sgst.toFixed(2)}
                        </ThemedText>
                      </View>
                    )}
                    {gstBill.igst > 0 && (
                      <View style={styles.summaryLine}>
                        <ThemedText style={styles.summaryName}>IGST</ThemedText>
                        <ThemedText style={styles.summaryPrice}>
                          ₹{gstBill.igst.toFixed(2)}
                        </ThemedText>
                      </View>
                    )}
                  </>
                )}
                {!!preview && preview.stores.some((st) => !!st.delivery) && (
                  <>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryLine}>
                      <ThemedText style={styles.summaryName}>Delivery</ThemedText>
                      <ThemedText style={styles.summaryPrice}>
                        {shippingCharge > 0 ? `₹${shippingCharge}` : "Free"}
                      </ThemedText>
                    </View>
                  </>
                )}
                <View style={styles.summaryDivider} />
                <View style={styles.summaryLine}>
                  <ThemedText style={styles.totalLabel}>To pay</ThemedText>
                  <ThemedText style={styles.total}>{totalText}</ThemedText>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {payu.element}

      {/* Bottom bar */}
      <View
        onLayout={(e) => setBottomBarH(e.nativeEvent.layout.height)}
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          keyboardOpen && { display: "none" },
        ]}
      >
        {addressReady ? (
          <>
            <Pressable style={styles.bbAddressRow} onPress={changeAddress}>
              <View style={styles.bbAddressIcon}>
                <Ionicons name="home-outline" size={24} color={ink} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.bbAddressTitle}>
                  Delivering to {addressLabel}
                </ThemedText>
                <ThemedText style={styles.bbAddressText} numberOfLines={1}>
                  {addressSummary}
                </ThemedText>
              </View>
              <ThemedText style={styles.bbChange}>Change</ThemedText>
            </Pressable>

            <View style={styles.bbDivider} />

            <View style={styles.bbActionRow}>
              <Pressable
                style={styles.bbPayUsing}
                onPress={() => {
                  if (!onlineBlocked) setPaymentOpen(true);
                }}
              >
                <ThemedText style={styles.bbPayUsingLabel}>
                  PAY USING ▲
                </ThemedText>
                <ThemedText style={styles.bbPayUsingValue} numberOfLines={1}>
                  {paymentLabel}
                </ThemedText>
              </Pressable>

              <Pressable
                disabled={placing || cartBusy}
                onPress={placeOrder}
                style={[
                  styles.bbPlaceBtn,
                  (placing || cartBusy) && styles.disabledPrimary,
                ]}
              >
                <ThemedText style={styles.bbTotalLabel}>TOTAL</ThemedText>
                <ThemedText
                  style={styles.bbTotal}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {totalText}
                </ThemedText>
                <ThemedText style={styles.bbPlaceText} numberOfLines={1}>
                  {placing
                    ? "Placing order..."
                    : cartBusy
                      ? "Loading cart..."
                      : onlineBlocked
                        ? "Request price"
                        : "Place Order"}
                </ThemedText>
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable style={styles.bbAddBtn} onPress={handleAddressButton}>
            <Ionicons name="location-outline" size={20} color="#FFFFFF" />
            <ThemedText style={styles.bbAddText}>
              {hasAddress ? "Confirm delivery address" : "Add delivery address"}
            </ThemedText>
          </Pressable>
        )}
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
    backgroundColor: "#ebaa99",
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
    borderColor: "#e9a392",
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
  payRowSelected: { borderColor: "#e3a08f", backgroundColor: "#FFF5F2" },
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
  radioSelected: { borderColor: "#de9a89" },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#e19d8d",
  },
  payLabel: { color: ink, fontSize: 14, fontWeight: "700" },
  payDesc: { color: muted, fontSize: 12, marginTop: 2 },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  changeLink: {
    color: "#df9988",
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
  requiredStar: { color: "#e29190", fontWeight: "800" },
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
    color: "#e29480",
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
  whiteCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
  },
  infoHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  infoTitle: { color: ink, fontSize: 18, fontWeight: "800" },
  infoSub: { color: muted, fontSize: 13, marginTop: 2 },
  infoDivider: { height: 1, backgroundColor: "#EEEEEE", marginVertical: 12 },

  olRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  olImageBox: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: "#F6F6F6",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  olImage: { width: "100%", height: "100%" },
  olName: { color: ink, fontSize: 15, fontWeight: "700" },
  olLabel: { color: muted, fontSize: 13, marginTop: 2 },
  olRight: { alignItems: "flex-end", gap: 2 },
  olMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  olMeta: { color: muted, fontSize: 12, fontWeight: "600" },
  olSave: { color: "#22A45D", fontSize: 12, fontWeight: "700" },
  osLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  osLabel: { color: muted, fontSize: 13, fontWeight: "600" },
  osValue: { color: ink, fontSize: 13, fontWeight: "700" },
  osTotalLabel: { color: ink, fontSize: 15, fontWeight: "800" },
  osTotal: { color: ink, fontSize: 16, fontWeight: "900" },
  olOriginal: {
    color: muted,
    fontSize: 12,
    textDecorationLine: "line-through",
  },
  olPrice: { color: ink, fontSize: 15, fontWeight: "800" },

  sgTitle: { color: ink, fontSize: 20, fontWeight: "800", marginBottom: 14 },
  skyCard: {
    backgroundColor: "#E4F1FB",
    borderWidth: 1,
    borderColor: "#D0E6F6",
    borderRadius: 20,
    padding: 12,
    marginBottom: 16,
  },
  sgGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  sgCard: {
    width: "23.5%",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 4,
    justifyContent: "space-between",
  },
  sgImageBox: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: "#F6F6F6",
    overflow: "hidden",
  },
  sgImage: { width: "100%", height: "100%" },
  sgOffBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#2F6FED",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderBottomRightRadius: 6,
  },
  sgOffBadgeText: { color: "#FFFFFF", fontSize: 8, fontWeight: "800" },
  sgName: {
    color: ink,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 4,
    minHeight: 26,
  },
  sgPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 3,
    marginTop: 2,
    minHeight: 28,
  },
  sgPrice: { color: ink, fontSize: 11, fontWeight: "800" },
  sgOriginal: { color: muted, fontSize: 9, textDecorationLine: "line-through" },
  sgRating: { color: "#22A45D", fontSize: 9, fontWeight: "700", marginTop: 1 },
  sgPlus: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(45,40,34,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#F2F2F2",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 28,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sheetTitle: { color: ink, fontSize: 18, fontWeight: "800" },

  billHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  billTitle: { color: ink, fontSize: 16, fontWeight: "800", marginLeft: 4 },
  billRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  billMini: { color: ink, fontSize: 15, fontWeight: "800" },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 14,
  },
  bbAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
  },
  bbDivider: {
    height: 1,
    backgroundColor: "#E2E2E2",
    marginBottom: 12,
  },
  bbAddressIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  bbAddressTitle: { color: ink, fontSize: 16, fontWeight: "800" },
  bbAddressText: { color: muted, fontSize: 13, marginTop: 2 },
  bbChange: { color: brand, fontSize: 15, fontWeight: "800" },
  bbActionRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  bbPayUsing: { width: 112 },
  bbPayUsingLabel: {
    color: ink,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  bbPayUsingValue: {
    color: muted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  bbPlaceBtn: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: brand,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  bbTotal: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    alignSelf: "stretch",
  },
  bbTotalLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  bbPlaceText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "700",
  },
  bbAddBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: brand,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bbAddText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
