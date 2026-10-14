import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: W, height: H } = Dimensions.get("window");
const MAX_SCALE = 5;

function ZoomableImage({
  uri,
  onZoomChange,
}: {
  uri: string;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const setZoom = (z: boolean) => {
    setZoomed(z);
    onZoomChange(z);
  };

  const clampPan = () => {
    "worklet";
    const maxX = Math.max(0, (W * scale.value - W) / 2);
    const maxY = Math.max(0, (H * scale.value - H) / 2);
    tx.value = Math.min(Math.max(tx.value, -maxX), maxX);
    ty.value = Math.min(Math.max(ty.value, -maxY), maxY);
    savedTx.value = tx.value;
    savedTy.value = ty.value;
  };

  const reset = () => {
    "worklet";
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
    runOnJS(setZoom)(false);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(
        Math.max(savedScale.value * e.scale, 1),
        MAX_SCALE,
      );
    })
    .onEnd(() => {
      if (scale.value <= 1.02) {
        reset();
      } else {
        savedScale.value = scale.value;
        clampPan();
        runOnJS(setZoom)(true);
      }
    });

  const pan = Gesture.Pan()
    .enabled(zoomed)
    .onUpdate((e) => {
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      clampPan();
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        reset();
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
        runOnJS(setZoom)(true);
      }
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={st.slide}>
        <Animated.View style={[st.zoomBox, animatedStyle]}>
          <Image source={{ uri }} style={st.image} contentFit="contain" />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export function ImageViewer({
  images,
  startIndex,
  visible,
  onClose,
}: {
  images: string[];
  startIndex: number;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(startIndex);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const listRef = useRef<FlatList<string>>(null);

  useEffect(() => {
    if (visible) {
      setIndex(startIndex);
      setScrollEnabled(true);
    }
  }, [visible, startIndex]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={st.root}>
        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(uri, i) => `${uri}-${i}`}
          horizontal
          pagingEnabled
          scrollEnabled={scrollEnabled}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
          onMomentumScrollEnd={(e) => {
            setIndex(Math.round(e.nativeEvent.contentOffset.x / W));
          }}
          renderItem={({ item }) => (
            <ZoomableImage
              uri={item}
              onZoomChange={(z) => setScrollEnabled(!z)}
            />
          )}
        />

        <Pressable
          accessibilityLabel="Close image"
          onPress={onClose}
          style={[st.closeBtn, { top: insets.top + 12 }]}
        >
          <Text style={st.closeText}>✕</Text>
        </Pressable>

        {images.length > 1 && (
          <View style={[st.counter, { bottom: insets.bottom + 24 }]}>
            <Text style={st.counterText}>
              {index + 1} / {images.length}
            </Text>
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)" },
  slide: { width: W, height: H, alignItems: "center", justifyContent: "center" },
  zoomBox: { width: W, height: H },
  image: { width: "100%", height: "100%" },
  closeBtn: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  counter: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  counterText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
});