import OrderSuccessImage from "@/assets/images/OrderSuccess.svg";
import {
    setAudioModeAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
} from "expo-audio";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import {
    Animated,
    BackHandler,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ink = "#1F1F1F";
const muted = "#777777";
const accent = "#E7718D";

export default function OrderSuccessScreen() {
  const { orderId, total, itemName } = useLocalSearchParams<{
    orderId?: string;
    total?: string;
    itemName?: string;
  }>();
  const statusButtonOpacity = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(0.3)).current;
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const player = useAudioPlayer(
    require("@/assets/images/orderconfirmaudio.mp3"),
  );
  const playerStatus = useAudioPlayerStatus(player);

  const renderedOrderId = String(orderId ?? "0007023").padStart(7, "0");
  const renderedTotal = Number(total ?? 0).toFixed(2);
  const name = itemName?.trim() || "Your order";

  useEffect(() => {
    if (!playerStatus.isLoaded) return;

    let active = true;
    const playConfirmation = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: "doNotMix",
        });
        if (!active) return;
        player.volume = 1;
        await player.seekTo(0);
        player.play();
      } catch (error) {
        console.warn("Failed to play order confirmation sound", error);
      }
    };

    void playConfirmation();
    return () => {
      active = false;
      try {
        player.pause();
      } catch {
        // player may already be released while the screen unmounts
      }
    };
  }, [player, playerStatus.isLoaded]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      router.replace("/(tabs)");
      return true;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(statusButtonOpacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(imageScale, {
        toValue: 1,
        tension: 50,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(imageOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start();

    return () => animation.stop();
  }, [statusButtonOpacity, imageScale, imageOpacity]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.successImage,
            { opacity: imageOpacity, transform: [{ scale: imageScale }] },
          ]}
          accessibilityLabel="Order successfully placed"
        >
          <OrderSuccessImage width="100%" height="100%" />
        </Animated.View>

        <Text style={styles.title}>Order placed!</Text>
        <Text style={styles.orderId}>Order #{renderedOrderId}</Text>
        <Text style={styles.description}>
          Your order has been placed successfully. We'll keep you updated on its
          status.
        </Text>

        <View style={styles.orderSummary}>
          <View style={styles.summaryCopy}>
            <Text style={styles.itemName} numberOfLines={2}>
              {name}
            </Text>
            <Text style={styles.summaryOrderId}>Order #{renderedOrderId}</Text>
          </View>
          <Text style={styles.total}>₹{renderedTotal}</Text>
        </View>

        <Pressable
          style={styles.continueButton}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={styles.continueButtonText}>Continue Shopping</Text>
        </Pressable>

        <Animated.View
          style={[styles.buttonWrap, { opacity: statusButtonOpacity }]}
        >
          <Pressable
            style={styles.statusButton}
            onPress={() => router.replace("/(tabs)/orders")}
          >
            <Text style={styles.statusButtonText}>View Order Status</Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
    alignItems: "center",
  },
  successImage: {
    width: 200,
    height: 200,
    marginTop: 24,
    marginBottom: 20,
  },
  title: {
    color: ink,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  orderId: {
    color: accent,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 10,
  },
  description: {
    color: muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 310,
    marginTop: 12,
  },
  orderSummary: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    backgroundColor: "#F8F6F5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginTop: 32,
  },
  summaryCopy: {
    flex: 1,
  },
  itemName: {
    color: ink,
    fontSize: 14,
    fontWeight: "700",
  },
  summaryOrderId: {
    color: muted,
    fontSize: 12,
    marginTop: 5,
  },
  total: {
    color: ink,
    fontSize: 16,
    fontWeight: "800",
  },
  continueButton: {
    width: "100%",
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: accent,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  continueButtonText: {
    color: accent,
    fontSize: 15,
    fontWeight: "700",
  },
  buttonWrap: {
    width: "100%",
    marginTop: "auto",
  },
  statusButton: {
    minHeight: 54,
    backgroundColor: accent,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
