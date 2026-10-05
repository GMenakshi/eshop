import { useEffect, useState } from "react";
import {
  Alert,
  type AlertButton,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type AlertState = {
  title: string;
  message?: string;
  buttons: AlertButton[];
} | null;

let setHostState: ((s: AlertState) => void) | null = null;
const nativeAlert = Alert.alert.bind(Alert);

// Every Alert.alert(...) in the app now opens the custom popup.
// If the host isn't mounted yet, it falls back to the native one.
Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
  if (!setHostState) {
    nativeAlert(title, message, buttons);
    return;
  }
  setHostState({
    title,
    message,
    buttons: buttons?.length ? buttons : [{ text: "OK" }],
  });
};

export function AppAlertHost() {
  const [state, setState] = useState<AlertState>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setHostState = (s) => {
      setState(s);
      setVisible(true);
    };
    return () => {
      setHostState = null;
    };
  }, []);

  const buttons = state
    ? [...state.buttons].sort(
        (a, b) => Number(a.style === "cancel") - Number(b.style === "cancel"),
      )
    : [];

  const close = () => setVisible(false);
  const dismiss = () => {
    const cancel = state?.buttons.find((b) => b.style === "cancel");
    close();
    cancel?.onPress?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
    >
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{state?.title}</Text>
          {!!state?.message && (
            <Text style={styles.message}>{state.message}</Text>
          )}
          <View style={styles.buttons}>
            {buttons.map((b, i) => (
              <Pressable
                key={`${b.text}-${i}`}
                style={({ pressed }) => [
                  styles.btn,
                  pressed && styles.btnPressed,
                ]}
                onPress={() => {
                  close();
                  b.onPress?.();
                }}
              >
                <Text
                  style={[
                    styles.btnText,
                    b.style === "destructive" && styles.destructiveText,
                  ]}
                >
                  {b.text ?? "OK"}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#F0F0F0",
    borderRadius: 32,
    paddingHorizontal: 18,
    paddingTop: 26,
    paddingBottom: 18,
  },
  title: {
    color: "#000000",
    fontSize: 20,
    textAlign: "center",
    marginBottom: 20,
  },
  message: {
    color: "#555555",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: -10,
    marginBottom: 20,
  },
  buttons: { gap: 12 },
  btn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: "#D3D3D3",
    alignItems: "center",
    justifyContent: "center",
  },
  btnPressed: { backgroundColor: "#C6C6C6" },
  btnText: { color: "#000000", fontSize: 18, fontWeight: "500" },
  destructiveText: { color: "#FF3B47" },
});