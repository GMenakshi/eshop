import { AppAlertHost } from "@/components/app-alert";
import { StoreUnavailable } from "@/components/store-unavailable";
import { VisitTracker } from "@/components/visit-tracker";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { CartProvider } from "@/context/cart-context";
import { WishlistProvider } from "@/context/wishlist-context";
import {
  listenForeground,
  listenNotificationTap,
  registerForPush,
} from "@/lib/push";
import { StoreProvider, useStore } from "@/lib/store-context";
import { DefaultTheme, Stack, ThemeProvider, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform } from "react-native";
import { BannerProvider } from "@/components/top-banner";
import { useBanner } from "@/components/top-banner";

SplashScreen.preventAutoHideAsync();

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "transparent",
  },
};

// Screens that need a working store. Everything else keeps working.
const STORE_SCREENS = new Set([
  "product/[id]",
  "checkout",
  "wishlist",
  "reviews",
]);

function PushBootstrap() {
  const banner = useBanner();
  const { token } = useAuth();
  const { activeStore, storeId, ready: storesReady } = useStore();
  const router = useRouter();
  const activeStoreIds = [
    activeStore?.mongoId,
    activeStore?.id,
    storeId,
  ].filter((id): id is string => Boolean(id));

  useEffect(() => {
    if (!token || Platform.OS === "web") return;

    let cancelled = false;
    let unsubscribeRefresh: (() => void) | undefined;

    registerForPush(token).then((unsub) => {
      if (cancelled) unsub?.();
      else unsubscribeRefresh = unsub;
    });

    return () => {
      cancelled = true;
      unsubscribeRefresh?.();
    };
  }, [token]);

  useEffect(() => {
    if (!token || !storesReady || Platform.OS === "web") return;
    const unsubscribeForeground = listenForeground(undefined, activeStoreIds);
    const unsubscribeTap = listenNotificationTap((orderId) => {
      setTimeout(() => {
        router.push({ pathname: "/order/[id]", params: { id: orderId } });
      }, 0);
    }, activeStoreIds);
    return () => {
      unsubscribeForeground();
      unsubscribeTap();
    };
  }, [
    token,
    storesReady,
    activeStore?.id,
    activeStore?.mongoId,
    storeId,
    router,
  ]);

  return null;
}

function AppRoot() {
  const { ready } = useAuth();
  const { storeUnavailable } = useStore();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <PushBootstrap />
      <VisitTracker />
      <Stack
        initialRouteName="(tabs)"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
        screenLayout={({ route, children }) =>
          storeUnavailable && STORE_SCREENS.has(route.name) ? (
            <StoreUnavailable />
          ) : (
            children
          )
        }
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="create-account" />
        <Stack.Screen name="otp" />
        <Stack.Screen
          name="forgot-password"
          options={{ presentation: "modal" }}
        />
        <Stack.Screen name="store/[id]" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="checkout" />
        <Stack.Screen
          name="order-success"
          options={{ animation: "slide_from_bottom" }}
        />
        <Stack.Screen name="wishlist" />
        <Stack.Screen name="reviews" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={AppTheme}>
      <AuthProvider>
        <StoreProvider>
          <WishlistProvider>
            <CartProvider>
              <BannerProvider>
                <AppRoot />
                <AppAlertHost />
              </BannerProvider>
            </CartProvider>
          </WishlistProvider>
        </StoreProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
