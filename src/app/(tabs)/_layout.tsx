import * as Clipboard from "expo-clipboard";
import { useRef, useState } from "react";
import { Alert } from "react-native";

import AppTabs from "@/components/app-tabs";
import { ScanWelcome } from "@/components/scan-welcome";
import { StoreScanner } from "@/components/store-scanner";
import { extractStoreId } from "@/lib/store-qr";
import { useStore } from "@/lib/store-context";

export default function TabsLayout() {
  const { ready, storeId, joinStore } = useStore();
  const [scannerOpen, setScannerOpen] = useState(false);
  const busy = useRef(false);

  const openStore = async (id: string) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const ok = await joinStore(id);
      if (!ok) {
        Alert.alert("Store not found", `Could not find a store for "${id}".`);
      }
      // on success the store becomes active, storeId is set, and AppTabs shows
    } catch (error) {
      Alert.alert(
        "Could not open store",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      busy.current = false;
    }
  };

  const handleScan = async (data: string) => {
    console.log("QR scanned:", data);
    setScannerOpen(false);
    // let the scanner modal finish closing, or iOS drops the Alert
    await new Promise((r) => setTimeout(r, 400));
    const id = extractStoreId(data);
    if (!id) {
      Alert.alert("Invalid QR", "This is not a store QR code.");
      return;
    }
    await openStore(id);
  };

  const handleHaveLink = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    const id = extractStoreId(text);
    if (!id) {
      Alert.alert(
        "Copy the store link first",
        "Copy the store link you received, then tap “I Have a Store Link” again.",
      );
      return;
    }
    await openStore(id);
  };

  if (!ready) return null;

  if (!storeId) {
    return (
      <>
        <ScanWelcome
          onScan={() => setScannerOpen(true)}
          onHaveLink={handleHaveLink}
        />
        <StoreScanner
          visible={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScanned={handleScan}
        />
      </>
    );
  }
  return <AppTabs />;
}