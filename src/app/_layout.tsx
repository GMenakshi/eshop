import { DefaultTheme, Stack, ThemeProvider, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { AuthProvider, useAuth } from "@/context/auth-context";
import { CartProvider } from "@/context/cart-context";
import { WishlistProvider } from "@/context/wishlist-context";
import { listenForeground, listenNotificationTap, registerForPush } from "@/lib/push";
import { StoreProvider } from "@/lib/store-context";

SplashScreen.preventAutoHideAsync();

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "transparent",
  },
};

function PushBootstrap() {
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!token || Platform.OS === "web") return;

    let cancelled = false;
    let unsubscribeRefresh: (() => void) | undefined;

    registerForPush(token).then((unsub) => {
      if (cancelled) unsub?.();
      else unsubscribeRefresh = unsub;
    });
    const unsubscribeForeground = listenForeground();

    return () => {
      cancelled = true;
      unsubscribeRefresh?.();
      unsubscribeForeground();
    };
  }, [token]);

  useEffect(() => {
    if (!token || Platform.OS === "web") return;
    return listenNotificationTap((orderId) => {
      setTimeout(() => {
        router.push({ pathname: "/order/[id]", params: { id: orderId } });
      }, 0);
    });
  }, [token, router]);

  return null;
}

function AppRoot() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
      setIsReady(true);
    }, 400);

    return () => clearTimeout(timer);
  }, []);

  if (!isReady) return null;

  return (
    <>
      <PushBootstrap />
      <Stack
        initialRouteName="(tabs)"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="create-account" />
        <Stack.Screen name="otp" />
        <Stack.Screen name="store/[id]" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="checkout" />
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
              <AppRoot />
            </CartProvider>
          </WishlistProvider>
        </StoreProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}