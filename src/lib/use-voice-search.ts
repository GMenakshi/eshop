import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";

// onText fires with live text while speaking, and isFinal=true at the end.
// `active` stops this screen from reacting when another screen is listening.
export function useVoiceSearch(
  onText: (text: string, isFinal: boolean) => void,
  active = true,
) {
  const [listening, setListening] = useState(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const activeRef = useRef(active);
  activeRef.current = active;

  useSpeechRecognitionEvent("start", () => {
    if (activeRef.current) setListening(true);
  });
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    if (!activeRef.current) return;
    const text = event.results[0]?.transcript ?? "";
    if (text) onTextRef.current(text, event.isFinal);
  });
  useSpeechRecognitionEvent("error", (event) => {
    setListening(false);
    if (!activeRef.current) return;
    if (event.error === "no-speech" || event.error === "aborted") return;
    Alert.alert("Voice search", event.message || "Couldn't hear you. Try again.");
  });

  const start = useCallback(async () => {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Microphone needed",
        "Allow microphone access in your phone settings to use voice search.",
      );
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: "en-IN",
      interimResults: true,
      continuous: false,
    });
  }, []);

  const stop = useCallback(() => ExpoSpeechRecognitionModule.stop(), []);
  const toggle = useCallback(() => (listening ? stop() : void start()), [listening, start, stop]);

  return { listening, toggle };
}