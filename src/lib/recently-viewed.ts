import AsyncStorage from "@react-native-async-storage/async-storage";

const keyFor = (storeId: string) => `recently-viewed:${storeId}`;
const MAX_ITEMS = 20;

export async function getRecentlyViewedIds(storeId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(storeId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function addRecentlyViewed(storeId: string, productId: string) {
  try {
    const ids = await getRecentlyViewedIds(storeId);
    const next = [productId, ...ids.filter((x) => x !== productId)].slice(0, MAX_ITEMS);
    await AsyncStorage.setItem(keyFor(storeId), JSON.stringify(next));
  } catch {}
}