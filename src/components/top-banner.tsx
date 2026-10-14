import { SymbolView } from "expo-symbols";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";

export type BannerKind = "success" | "error" | "info" | "warning";

type BannerInput = {
  title: string;
  message?: string;
  kind?: BannerKind;
  duration?: number; // ms
  onPress?: () => void;
};

type Ctx = { show: (b: BannerInput) => void; hide: () => void };
const BannerContext = createContext<Ctx>({ show: () => {}, hide: () => {} });
export const useBanner = () => useContext(BannerContext);

const KIND_STYLE: Record<
  BannerKind,
  { color: string; icon: { ios: any; android: any; web: any } }
> = {
  success: {
    color: "#3F8F5B",
    icon: { ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" },
  },
  error: {
    color: "#D5684A",
    icon: { ios: "xmark.circle.fill", android: "cancel", web: "cancel" },
  },
  warning: {
    color: "#E0A030",
    icon: { ios: "exclamationmark.triangle.fill", android: "warning", web: "warning" },
  },
  info: {
    color: "#3B7DD8",
    icon: { ios: "bell.fill", android: "notifications", web: "notifications" },
  },
};

const BANNER_HEIGHT = 76;

export function BannerProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-200)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [banner, setBanner] = useState<BannerInput | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(translateY, {
      toValue: -200,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setBanner(null));
  }, [translateY]);

  const show = useCallback(
    (b: BannerInput) => {
      if (timer.current) clearTimeout(timer.current);
      setBanner(b);
      translateY.setValue(-200);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 6,
      }).start();
      timer.current = setTimeout(hide, b.duration ?? 3500);
    },
    [hide, translateY],
  );

  const style = KIND_STYLE[banner?.kind ?? "info"];

  return (
    <BannerContext.Provider value={{ show, hide }}>
      {children}
      {banner && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            { top: insets.top + 8, transform: [{ translateY }] },
          ]}
        >
          <Pressable
            style={[styles.card, { borderLeftColor: style.color }]}
            onPress={() => {
              banner.onPress?.();
              hide();
            }}
          >
            <View style={[styles.iconWrap, { backgroundColor: style.color + "22" }]}>
              <SymbolView name={style.icon} size={22} tintColor={style.color} />
            </View>
            <View style={styles.texts}>
              <ThemedText style={styles.title} numberOfLines={1}>
                {banner.title}
              </ThemedText>
              {!!banner.message && (
                <ThemedText style={styles.message} numberOfLines={2}>
                  {banner.message}
                </ThemedText>
              )}
            </View>
          </Pressable>
        </Animated.View>
      )}
    </BannerContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 999,
    elevation: 20,
  },
  card: {
    minHeight: BANNER_HEIGHT - 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderLeftWidth: 5,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: { flex: 1 },
  title: { color: "#17211D", fontSize: 14, fontWeight: "800" },
  message: { color: "#526057", fontSize: 12, lineHeight: 16, marginTop: 2 },
});