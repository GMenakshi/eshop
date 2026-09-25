import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";

import { AuthProvider } from "@/context/auth-context";
import { CartProvider } from "@/context/cart-context";
import { WishlistProvider } from "@/context/wishlist-context";
import { StoreProvider } from "@/lib/store-context";

SplashScreen.preventAutoHideAsync();

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "transparent",
  },
};

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
<Stack
  initialRouteName="(tabs)"
  screenOptions={{
    headerShown: false,
    contentStyle: { backgroundColor: "transparent" },
  }}
>      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="create-account" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="store/[id]" />
      <Stack.Screen name="product/[id]" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="wishlist" />
      <Stack.Screen name="reviews" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={AppTheme}>
      <AuthProvider>
        <WishlistProvider>
          <StoreProvider>
            <CartProvider>
              <AppRoot />
            </CartProvider>
          </StoreProvider>
        </WishlistProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}