import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { ThemedText } from "@/components/themed-text";
import { apiImageUrl } from "@/lib/api";
import type { StoreSummary } from "@/lib/stores-api";

const ink = "#1A1A1A";
const muted = "#8A8A8A";
const field = "#F0F0F0";
const border = "#E3E3E3";
const whatsappGreen = "#25D366";
const activeOrange = "#E8875C";

// "07550922018" or "7550922018" -> "917550922018"
const toWhatsappNumber = (raw?: string) => {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0"))
    return `91${digits.slice(1)}`;
  return digits;
};

export function StoreCard({
  store,
  active,
  badge,
  onPress,
}: {
  store: StoreSummary;
  active?: boolean;
  badge?: string;
  onPress?: () => void;
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  console.log("QR URL:", store.qrCodeUrl);

  const storeLink = store.storeUniqueId
    ? `https://estorebackend.amptechnology.in/store/${store.storeUniqueId}`
    : store.qrCodeUrl;

  const shareLink = async () => {
    if (!storeLink) return;
    try {
      await Share.share({
        message: `${store.storeName} - open in the app: ${storeLink}`,
      });
    } catch (e) {
      Alert.alert(
        "Could not share",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  const shareImage = async () => {
    if (!store.qrCodeUrl || sharing) return;
    setSharing(true);
    try {
      const target = new File(
        Paths.cache,
        `qr-${store.storeUniqueId ?? "store"}.jpg`,
      );
      if (target.exists) target.delete();
      const file = await File.downloadFileAsync(store.qrCodeUrl, target);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "image/jpeg",
          dialogTitle: `${store.storeName} QR`,
        });
      } else {
        Alert.alert("Sharing not available", "Try sharing the link instead.");
      }
    } catch (e) {
      console.log("QR share error:", e);
      Alert.alert(
        "Could not share image",
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setSharing(false);
    }
  };
  console.log("QR URL:", store.qrCodeUrl);

  const owner = typeof store.userId === "object" ? store.userId : undefined;
  const phone = toWhatsappNumber(
    store.whatsappNo ?? store.contactNo ?? owner?.phone,
  );
  const firstImage = store.images?.find((i: string) => !!i);
  const imageUri = apiImageUrl(firstImage);

  const openWhatsapp = () => {
    if (!phone) return;
    const text = encodeURIComponent(
      `Hi ${store.storeName}, I'm interested in your products.`,
    );
    void Linking.openURL(`https://wa.me/${phone}?text=${text}`);
  };

  return (
    <>
      <Pressable
        style={[styles.card, active && styles.cardActive]}
        disabled={!onPress}
        onPress={onPress}
      >
        <View style={styles.imageBox}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              contentFit="cover"
            />
          ) : (
            <Ionicons name="storefront-outline" size={28} color={muted} />
          )}
        </View>

        <View style={styles.info}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {store.storeName}
          </ThemedText>
          {!!store.storeType && (
            <ThemedText style={styles.details} numberOfLines={1}>
              {store.storeType}
            </ThemedText>
          )}
          {!!store.storeUniqueId && (
            <ThemedText style={styles.uid} numberOfLines={1}>
              {store.storeUniqueId}
            </ThemedText>
          )}
          {!!badge && <ThemedText style={styles.badge}>{badge}</ThemedText>}
        </View>

        {!!phone && (
          <Pressable
            style={styles.waBtn}
            onPress={openWhatsapp}
            accessibilityLabel="Chat on WhatsApp"
          >
            <Ionicons name="logo-whatsapp" size={22} color={whatsappGreen} />
          </Pressable>
        )}

        <Pressable
          style={styles.qrBtn}
          onPress={() => setQrOpen(true)}
          accessibilityLabel="Show store QR code"
        >
          {store.qrCodeUrl ? (
            <Image
              source={{ uri: store.qrCodeUrl }}
              style={styles.qrThumb}
              contentFit="contain"
            />
          ) : storeLink ? (
            <QRCode value={storeLink} size={36} />
          ) : (
            <Ionicons name="qr-code-outline" size={24} color={ink} />
          )}
        </Pressable>
      </Pressable>

      <Modal
        visible={qrOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setQrOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setQrOpen(false)}>
          <Pressable style={styles.qrSheet} onPress={() => {}}>
            <ThemedText style={styles.qrTitle}>{store.storeName}</ThemedText>

            {store.qrCodeUrl || storeLink ? (
              <>
                {store.qrCodeUrl ? (
                  <Image
                    source={{ uri: store.qrCodeUrl }}
                    style={styles.qrLarge}
                    contentFit="contain"
                    onError={(e) => console.log("QR load error:", e)}
                  />
                ) : (
                  <View style={styles.qrLocal}>
                    <QRCode value={storeLink!} size={220} />
                  </View>
                )}

                <ThemedText style={styles.qrLink} selectable numberOfLines={2}>
                  {storeLink}
                </ThemedText>

                <View style={styles.shareRow}>
                  {!!store.qrCodeUrl && (
                    <Pressable
                      style={styles.shareBtn}
                      onPress={shareImage}
                      disabled={sharing}
                    >
                      <Ionicons name="image-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.shareBtnText}>
                        {sharing ? "Preparing..." : "Share QR"}
                      </ThemedText>
                    </Pressable>
                  )}
                  <Pressable style={styles.shareBtn} onPress={shareLink}>
                    <Ionicons name="link-outline" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.shareBtnText}>
                      Share Link
                    </ThemedText>
                  </Pressable>
                </View>
              </>
            ) : (
              <ThemedText style={styles.qrHint}>
                The QR code isn&apos;t available for this store yet.
              </ThemedText>
            )}

            <Pressable onPress={() => setQrOpen(false)}>
              <ThemedText style={styles.qrHint}>Close</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: border,
  },
  cardActive: { borderColor: activeOrange },
  imageBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: field,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  info: { flex: 1 },
  name: { color: ink, fontSize: 16, fontWeight: "800" },
  details: { color: muted, fontSize: 13, marginTop: 2 },
  uid: { color: muted, fontSize: 11, marginTop: 2 },
  badge: { color: activeOrange, fontSize: 12, fontWeight: "700", marginTop: 4 },
  waBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: whatsappGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  qrBtn: {
    width: 46,
    height: 46,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: ink,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    padding: 2,
  },
  qrThumb: { width: "100%", height: "100%" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  qrSheet: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    gap: 12,
  },
  qrTitle: { color: ink, fontSize: 17, fontWeight: "800" },
  qrLarge: { width: 240, height: 240 },
    qrLocal: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  qrHint: { color: muted, fontSize: 13, fontWeight: "600", padding: 4 },
  qrLink: { color: muted, fontSize: 11, textAlign: "center" },
  shareRow: { flexDirection: "row", gap: 10, width: "100%" },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: ink,
    borderRadius: 10,
    paddingVertical: 12,
  },
  shareBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
});
