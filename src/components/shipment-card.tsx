import { Linking, Pressable, StyleSheet, View } from "react-native";
import { format } from "date-fns";

import { ThemedText } from "@/components/themed-text";

const ink = "#17211D";
const muted = "#748078";
const STEPS = ["Confirmed", "Shipment", "AWB", "Pickup", "In transit", "Delivered"];

const stepOf = (o: any) => {
  const s = o?.shipment;
  if (o?.status === "DELIVERED" || /^delivered$/i.test(s?.status ?? "")) return 6;
  if (o?.status === "SHIPPED" && s?.pickupRequestedAt) return 5;
  if (/transit|out for delivery|picked/i.test(s?.status ?? "")) return 5;
  if (s?.pickupRequestedAt) return 4;
  if (s?.awb) return 3;
  if (s?.shipmentId) return 2;
  if (o?.status === "CONFIRMED" || o?.status === "SHIPPED") return 1;
  return 0;
};

const fmt = (d?: string | null) => (d ? format(new Date(d), "dd MMM yyyy") : "—");

export function ShipmentCard({ order }: { order: any }) {
  const s = order?.shipment;
  const d = order?.deliveryInfo;
  if (!order) return null;

  const step = stepOf(order);
  const courier = s?.courierName ?? d?.courierName ?? "—";
  const weight = s?.appliedWeight ?? d?.chargeableWeightKg;

  const Cell = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.cell}>
      <ThemedText style={styles.cellLabel}>{label}</ThemedText>
      <ThemedText style={styles.cellValue} numberOfLines={2}>
        {value}
      </ThemedText>
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <ThemedText style={styles.title}>Courier & Shipment</ThemedText>
        <View style={styles.pill}>
          <ThemedText style={styles.pillText}>
            {s?.awb ? (s.status ?? "Shipped").replace(/_/g, " ") : "Not shipped"}
          </ThemedText>
        </View>
      </View>

      <View style={styles.steps}>
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <View key={label} style={styles.step}>
              <View style={[styles.dot, (done || active) && styles.dotOn]}>
                <ThemedText style={[styles.dotText, (done || active) && { color: "#fff" }]}>
                  {i + 1}
                </ThemedText>
              </View>
              <ThemedText style={styles.stepLabel} numberOfLines={1}>
                {label}
              </ThemedText>
            </View>
          );
        })}
      </View>

      {!s?.shipmentId && (
        <View style={styles.notice}>
          <ThemedText style={styles.noticeText}>
            The store has not created the courier shipment yet.
          </ThemedText>
        </View>
      )}

      <View style={styles.grid}>
        <Cell label="COURIER" value={courier} />
        <Cell label="COURIER RATE" value={d?.courierRate != null ? `₹${d.courierRate}` : "—"} />
        <Cell label="WEIGHT" value={weight ? `${weight} kg` : "—"} />
        <Cell label="ESTIMATED DELIVERY" value={s?.etd ? fmt(s.etd) : (d?.etaLabel ?? "—")} />
        {!!s?.awb && <Cell label="AWB" value={s.awb} />}
        {!!s?.pickupScheduledDate && <Cell label="PICKUP" value={fmt(s.pickupScheduledDate)} />}
      </View>

      {!!s?.trackingUrl && (
        <Pressable style={styles.trackBtn} onPress={() => Linking.openURL(s.trackingUrl)}>
          <ThemedText style={styles.trackText}>TRACK SHIPMENT</ThemedText>
        </Pressable>
      )}

      {(s?.events?.length ?? 0) > 0 && (
        <View style={{ marginTop: 12, gap: 8 }}>
          {[...s.events].reverse().slice(0, 6).map((e: any, i: number) => (
            <View key={i}>
              <ThemedText style={styles.evTitle}>{e.activity || e.status}</ThemedText>
              <ThemedText style={styles.evMeta}>
                {[e.location, e.at ? fmt(e.at) : null].filter(Boolean).join(" · ")}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 14, marginBottom: 16 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: ink, fontSize: 16, fontWeight: "800" },
  pill: { backgroundColor: "#F0F0F0", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: muted, fontSize: 11, fontWeight: "700" },
  steps: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  step: { alignItems: "center", flex: 1, gap: 4 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: "#D5D5D5", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  dotOn: { backgroundColor: "#f19c87", borderColor: "#f19c87" },
  dotText: { fontSize: 11, fontWeight: "800", color: muted },
  stepLabel: { fontSize: 9, color: muted },
  notice: { backgroundColor: "#FFF8E1", borderRadius: 10, padding: 10, marginTop: 14 },
  noticeText: { color: "#8A5A00", fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  cell: { width: "48.5%", backgroundColor: "#F8F9FB", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "#ECEEF2" },
  cellLabel: { color: muted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  cellValue: { color: ink, fontSize: 14, fontWeight: "700", marginTop: 6 },
  trackBtn: { marginTop: 12, height: 44, borderRadius: 22, backgroundColor: "#f8c9b1", alignItems: "center", justifyContent: "center" },
  trackText: { color: "#000", fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  evTitle: { color: ink, fontSize: 13, fontWeight: "600" },
  evMeta: { color: muted, fontSize: 11, marginTop: 1 },
});