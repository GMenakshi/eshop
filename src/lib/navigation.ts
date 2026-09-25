import { router } from "expo-router";

export function goBackOrHome() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(tabs)");
  }
}
