import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

export type DialogAction = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  // Simple mode: one action button + Cancel
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm?: () => void;
  onCancel: () => void;
  // Custom mode: several stacked action buttons, Cancel is added at the bottom
  actions?: DialogAction[];
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = "OK",
  cancelText = "Cancel",
  destructive,
  onConfirm,
  onCancel,
  actions,
}: Props) {
  const list: DialogAction[] = actions ?? [
    { label: confirmText, destructive, onPress: onConfirm ?? onCancel },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.buttons}>
            {list.map((action) => (
              <Pressable
                key={action.label}
                style={({ pressed }) => [
                  styles.btn,
                  pressed && styles.btnPressed,
                ]}
                onPress={action.onPress}
              >
                <Text
                  style={[
                    styles.btnText,
                    action.destructive && styles.destructiveText,
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
              onPress={onCancel}
            >
              <Text style={styles.btnText}>{cancelText}</Text>
            </Pressable>
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