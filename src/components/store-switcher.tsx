import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { StoreCard } from "@/components/store-card";
import { ThemedText } from "@/components/themed-text";
import { useStore, type SavedStore } from "@/lib/store-context";
import { fetchStoreDetails, type StoreSummary } from "@/lib/stores-api";

export function StoreSwitcher() {
  const { stores, storeId, switchStore } = useStore();
  const [details, setDetails] = useState<Record<string, Partial<StoreSummary>>>({});
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const selected = stores.find((s) => s.id === storeId) ?? stores[0];
  const selectedId = selected?.id;

  // load details for the selected store only
  useEffect(() => {
    if (!selectedId || details[selectedId]) return;
    let active = true;
    fetchStoreDetails(selectedId).then((d) => {
      if (active && d) setDetails((prev) => ({ ...prev, [selectedId]: d }));
    });
    return () => {
      active = false;
    };
  }, [selectedId]);

  if (stores.length === 0 || !selected) return null;
  const single = stores.length === 1;

  const toSummary = (s: SavedStore): StoreSummary => {
    const d = details[s.id];
    return {
      ...d,
      _id: d?._id ?? s.mongoId ?? s.id,
      storeName: d?.storeName ?? s.name ?? s.id,
      storeUniqueId: d?.storeUniqueId ?? s.id,
      whatsappNo: d?.whatsappNo ?? s.phone,
    };
  };

  const onSelect = async (id: string) => {
    setOpen(false);
    if (id === selected.id || switching) return;
    setSwitching(true);
    try {
      await switchStore(id);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.heading}>
        {single ? "MY STORE" : "MY STORES"}
      </ThemedText>

      {!single && (
        <View>
          <Pressable style={styles.selector} onPress={() => setOpen((v) => !v)}>
            <ThemedText style={styles.selectorText} numberOfLines={1}>
              {toSummary(selected).storeName}
            </ThemedText>
            <Ionicons
              name={open ? "chevron-up" : "chevron-down"}
              size={18}
              color="#17211D"
            />
          </Pressable>

          {open && (
            <View style={styles.menu}>
              {stores.map((s, i) => {
                const isSelected = s.id === selected.id;
                return (
                  <Pressable
                    key={s.id}
                    style={[styles.option, i > 0 && styles.optionDivider]}
                    onPress={() => onSelect(s.id)}
                  >
                    <ThemedText
                      style={[styles.optionText, isSelected && styles.optionTextSelected]}
                      numberOfLines={1}
                    >
                      {toSummary(s).storeName}
                    </ThemedText>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color="#E8875C" />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}

      <StoreCard store={toSummary(selected)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginVertical: 16 },
  heading: { color: "#999", fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E4DC",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  selectorText: { flex: 1, color: "#17211D", fontSize: 15, fontWeight: "700" },
  menu: {
    marginTop: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E4DC",
    borderRadius: 14,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  optionDivider: { borderTopWidth: 1, borderTopColor: "#EEF0EA" },
  optionText: { flex: 1, color: "#17211D", fontSize: 14, fontWeight: "600" },
  optionTextSelected: { fontWeight: "800" },
});