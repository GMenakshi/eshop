import { Ionicons } from "@expo/vector-icons";
import { Camera, CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";

const ZOOM_LEVELS = [
  { label: "1x", value: 0 },
  { label: "2x", value: 0.25 },
  { label: "3x", value: 0.5 },
];

export function StoreScanner({
  visible,
  onClose,
  onScanned,
}: {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const handled = useRef(false);

  useEffect(() => {
    if (visible) {
      handled.current = false;
      setTorch(false);
      setZoomIndex(0);
      if (permission && !permission.granted && permission.canAskAgain) {
        void requestPermission();
      }
    }
  }, [visible]);

  const finish = (data: string) => {
    if (handled.current) return;
    handled.current = true;
    onScanned(data);
  };

  const pickFromGallery = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      const scan =
        (Camera as any).scanFromURLAsync ?? (CameraView as any).scanFromURLAsync;
      if (!scan) {
        return Alert.alert("Not supported", "Gallery scan isn't available in this version.");
      }
      const results = await scan(res.assets[0].uri, ["qr"]);
      if (results.length > 0 && results[0].data) {
        finish(results[0].data);
      } else {
        Alert.alert("No QR found", "Could not find a QR code in that image.");
      }
    } catch (e) {
      console.log("Gallery scan error:", e);
      Alert.alert("Could not read image", "Please try another image.");
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.screen}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            zoom={ZOOM_LEVELS[zoomIndex].value}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => finish(data)}
          />
        ) : (
          <View style={styles.center}>
            <ThemedText style={styles.msg}>
              Camera permission is needed to scan QR codes.
            </ThemedText>
            <Pressable style={styles.grantBtn} onPress={requestPermission}>
              <ThemedText style={styles.grantText}>Allow camera</ThemedText>
            </Pressable>
          </View>
        )}

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </Pressable>
          <ThemedText style={styles.title}>Scan store QR code</ThemedText>
          <View style={styles.closeBtn} />
        </View>

        {/* Corner frame */}
        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
        </View>

        {/* Bottom controls */}
        <View style={[styles.controls, { paddingBottom: insets.bottom + 40 }]}>
          <Pressable style={styles.control} onPress={() => setTorch((v) => !v)}>
            <View style={[styles.circle, torch && styles.circleOn]}>
              <Ionicons
                name={torch ? "flashlight" : "flashlight-outline"}
                size={26}
                color={torch ? "#1A1A1A" : "#FFFFFF"}
              />
            </View>
            <ThemedText style={styles.controlLabel}>Torch</ThemedText>
          </Pressable>

          <Pressable
            style={styles.control}
            onPress={() => setZoomIndex((i) => (i + 1) % ZOOM_LEVELS.length)}
          >
            <View style={styles.circle}>
              <ThemedText style={styles.zoomText}>
                {ZOOM_LEVELS[zoomIndex].label}
              </ThemedText>
            </View>
            <ThemedText style={styles.controlLabel}>Zoom</ThemedText>
          </Pressable>

          <Pressable style={styles.control} onPress={pickFromGallery}>
            <View style={styles.circle}>
              <Ionicons name="image-outline" size={26} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.controlLabel}>Gallery</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const FRAME = 270;
const CORNER = 44;
const THICK = 4;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  msg: { color: "#FFF", fontSize: 15, textAlign: "center" },
  grantBtn: { backgroundColor: "#FFF", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  grantText: { color: "#1A1A1A", fontWeight: "700" },

  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { color: "#FFFFFF", fontSize: 17, fontWeight: "600" },

  frameWrap: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  frame: { width: FRAME, height: FRAME },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: "#FFFFFF",
  },
  tl: { top: 0, left: 0, borderTopWidth: THICK, borderLeftWidth: THICK, borderTopLeftRadius: 18 },
  tr: { top: 0, right: 0, borderTopWidth: THICK, borderRightWidth: THICK, borderTopRightRadius: 18 },
  bl: { bottom: 0, left: 0, borderBottomWidth: THICK, borderLeftWidth: THICK, borderBottomLeftRadius: 18 },
  br: { bottom: 0, right: 0, borderBottomWidth: THICK, borderRightWidth: THICK, borderBottomRightRadius: 18 },

  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 44,
  },
  control: { alignItems: "center", gap: 8 },
  circle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  circleOn: { backgroundColor: "#FFFFFF" },
  zoomText: { color: "#FFFFFF", fontSize: 20, fontWeight: "600" },
  controlLabel: { color: "#FFFFFF", fontSize: 13 },
});