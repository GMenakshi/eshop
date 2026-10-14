import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
const TOKEN_PREFIX = "ESHOP-INSTALL:";
const DONE_KEY = "install_claim_done";
const CLAIM_PATH = "/install/claim";

/**
 * Runs once, on the first launch after install.
 * Returns the STR-... store id, or null if nothing could be claimed.
 */
export async function resolveInstallStore(): Promise<string | null> {
  try {
    if (await AsyncStorage.getItem(DONE_KEY)) return null;

    let token = "";
    try {
      const clip = ((await Clipboard.getStringAsync()) || "").trim();
      if (clip.startsWith(TOKEN_PREFIX)) token = clip;
    } catch {
      // clipboard denied or unavailable: continue without a token
    }
    console.log("[install] clipboard has token:", !!token);

    const res = await fetch(`${API_BASE}${CLAIM_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }), // empty token = backend tries IP matching
    });
    console.log("[install] status:", res.status);

    // Server error: do not mark done, so the next launch can retry
    if (!res.ok) return null;

    const data = await res.json();
    console.log("[install] response:", JSON.stringify(data));

    // The server answered, so this launch is consumed. The backend token is
    // one-time, so claiming twice is not possible anyway.
    await AsyncStorage.setItem(DONE_KEY, "1");

    const storeId: string | undefined = data?.storeId ?? data?.data?.storeId;

    if (token) {
      try {
        await Clipboard.setStringAsync(""); // don't leave the token behind
      } catch {}
    }

    return storeId ?? null;
  } catch (e) {
    // Network error: not marked done, retry on next launch
    console.log("[install] error:", String(e));
    return null;
  }
}