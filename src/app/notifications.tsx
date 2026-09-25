import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";

const notifications = [
  {
    id: "1",
    title: "Order shipped",
    body: "Your order #ESH-1024 is on the way.",
    time: "2 hours ago",
    type: "shipping" as const,
  },
  {
    id: "2",
    title: "Price drop",
    body: "MARS Cosmetics Matte Muse Lipstick is now ₹279.",
    time: "Yesterday",
    type: "deal" as const,
  },
  {
    id: "3",
    title: "Welcome to ESHOP",
    body: "Get 15% off your first order with ESHOP15.",
    time: "1 week ago",
    type: "promo" as const,
  },
];

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>Notifications</ThemedText>
        </View>

        {notifications.map((notification, index) => (
          <Pressable key={notification.id} style={styles.card}>
            <View style={styles.iconWrap}>
              <SymbolView
                name={
                  notification.type === "shipping"
                    ? { ios: "shippingbox.fill", android: "local_shipping", web: "local_shipping" }
                    : notification.type === "deal"
                      ? { ios: "tag.fill", android: "local_offer", web: "local_offer" }
                      : { ios: "bell.fill", android: "notifications", web: "notifications" }
                }
                size={22}
                tintColor="#17211D"
              />
            </View>
            <View style={styles.body}>
              <ThemedText style={styles.notificationTitle}>
                {notification.title}
              </ThemedText>
              <ThemedText style={styles.notificationBody}>
                {notification.body}
              </ThemedText>
              <ThemedText style={styles.notificationTime}>
                {notification.time}
              </ThemedText>
            </View>
            {index === 0 && (
              <View style={styles.dot} />
            )}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F4ED" },
  content: { padding: 20, paddingBottom: 40 },
  header: {
    marginBottom: 20,
  },
  title: {
    color: "#17211D",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -1.2,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0E4DC",
    position: "relative",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E8EFE7",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  notificationTitle: {
    color: "#17211D",
    fontSize: 16,
    fontWeight: "700",
  },
  notificationBody: {
    color: "#526057",
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4,
  },
  notificationTime: {
    color: "#6E786F",
    fontSize: 12,
    marginTop: 6,
  },
  dot: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#D5684A",
  },
});