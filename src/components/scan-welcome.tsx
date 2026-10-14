import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";

type Chip = { label?: string; emoji?: string; blue?: boolean };

// Each row has enough chips to be wider than the screen on its own
const ROW1: Chip[] = [
  { label: "Discover great products", blue: true },
  { emoji: "🛍️" },
  { label: "Shop from local stores" },
  { emoji: "🚚" },
  { label: "Track your orders", blue: true },
  { emoji: "📦" },
];
const ROW2: Chip[] = [
  { label: "Build your wishlist" },
  { emoji: "🛒" },
  { label: "Support local business", blue: true },
  { emoji: "❤️" },
  { label: "Chat on WhatsApp" },
  { emoji: "💬" },
];
const ROW3: Chip[] = [
  { label: "Fast home delivery", blue: true },
  { emoji: "📦" },
  { label: "Reorder in one tap" },
  { emoji: "⭐" },
  { label: "Scan any store QR", blue: true },
  { emoji: "🧾" },
];

const GAP = 10;

function ChipView({ chip }: { chip: Chip }) {
  if (chip.emoji) {
    return (
      <View style={styles.circle}>
        <ThemedText style={styles.emoji}>{chip.emoji}</ThemedText>
      </View>
    );
  }
  return (
    <View style={[styles.pill, chip.blue ? styles.pillBlue : styles.pillDashed]}>
      <ThemedText style={styles.pillText} numberOfLines={1}>
        {chip.label}
      </ThemedText>
    </View>
  );
}

function ChipSet({ items }: { items: Chip[] }) {
  return (
    <View style={styles.set}>
      {items.map((c, i) => (
        // marginRight on every chip (including the last) keeps the loop seamless
        <View key={i} style={{ marginRight: GAP }}>
          <ChipView chip={c} />
        </View>
      ))}
    </View>
  );
}

function MarqueeRow({
  items,
  direction,
  speed,
  start,
}: {
  items: Chip[];
  direction: "left" | "right";
  speed: number; // pixels per second
  start: number; // how far the row is pushed left at the start (px)
}) {
  const { width: screenW } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;
  const [setW, setSetW] = useState(0);

  // enough copies to always cover the screen, plus one spare
  const copies = setW ? Math.ceil((screenW + start) / setW) + 1 : 1;

  useEffect(() => {
    if (!setW) return;
    const from = direction === "left" ? 0 : -setW;
    const to = direction === "left" ? -setW : 0;
    x.setValue(from);
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: to,
        duration: (setW / speed) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [setW, direction, speed, x]);

  return (
    <View style={styles.rowClip}>
      <Animated.View
        style={[
          styles.track,
          { left: -start, transform: [{ translateX: x }] },
        ]}
      >
        <View
          onLayout={(e) => {
            const w = Math.round(e.nativeEvent.layout.width);
            if (w && w !== setW) setSetW(w);
          }}
        >
          <ChipSet items={items} />
        </View>
        {Array.from({ length: Math.max(copies - 1, 1) }).map((_, i) => (
          <ChipSet key={i} items={items} />
        ))}
      </Animated.View>
    </View>
  );
}

export function ScanWelcome({
  onScan,
  onHaveLink,
}: {
  onScan: () => void;
  onHaveLink: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.head}>
        <ThemedText style={styles.bold}>Let&apos;s find</ThemedText>
        <ThemedText style={styles.italic}>your store</ThemedText>
        <ThemedText style={styles.bold}>instantly</ThemedText>
        <ThemedText style={styles.subtitle}>
          No typing. Only a quick scan.
        </ThemedText>
      </View>

      <View style={styles.chips}>
        <MarqueeRow items={ROW1} direction="left" speed={28} start={70} />
        <MarqueeRow items={ROW2} direction="right" speed={28} start={0} />
        <MarqueeRow items={ROW3} direction="left" speed={28} start={50} />
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.bottom}>
        <Pressable style={styles.btn} onPress={onScan}>
          <ThemedText style={styles.btnText}>Scan</ThemedText>
        </Pressable>
        <Pressable onPress={onHaveLink} hitSlop={10}>
          <ThemedText style={styles.link}>I Have a Store Link</ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },

  head: { alignItems: "center", marginTop: 48, paddingHorizontal: 24 },
  bold: {
    color: "#0F0F0F",
    fontSize: 50,
    fontWeight: "600",
    letterSpacing: -1.5,
    lineHeight: 54,
    textAlign: "center",
  },
  italic: {
    color: "#0F0F0F",
    fontSize: 50,
    fontStyle: "italic",
    fontWeight: "400",
    fontFamily: "serif",
    letterSpacing: -0.5,
    lineHeight: 54,
    textAlign: "center",
  },
  subtitle: {
    color: "#111",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 20,
    textAlign: "center",
  },

  chips: { marginTop: 36, gap: 12 },
  rowClip: { overflow: "hidden", height: 42 },
  // absolute so the track can be wider than the screen
  track: { position: "absolute", top: 0, flexDirection: "row" },
  set: { flexDirection: "row", alignItems: "center", flexShrink: 0 },

  pill: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pillDashed: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.2,
    borderStyle: "dashed",
    borderColor: "#2B2B2B",
  },
  pillBlue: { backgroundColor: "#BFE5FA" },
  pillText: { color: "#111", fontSize: 14, fontWeight: "500" },

  circle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.2,
    borderStyle: "dashed",
    borderColor: "#2B2B2B",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  emoji: { fontSize: 18 },

  bottom: { paddingHorizontal: 24, paddingBottom: 18, gap: 20, alignItems: "center" },
  btn: {
    width: "100%",
    height: 56,
    borderRadius: 28,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  link: { color: "#111", fontSize: 13, fontWeight: "500" },
});