// app/(tabs)/Trash.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as MediaLibrary from "expo-media-library";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";

const { width } = Dimensions.get("window");

const TRASH_KEY = "@app_trash";
const DARK_MODE_KEY = "@app_dark_mode";

const COLUMNS = 3;
const GAP = 8;
const CARD_SIZE = (width - 32 - GAP * (COLUMNS - 1)) / COLUMNS;

type Item = { id: string; uri: string; type?: string };


// =====================================================
// 🔒 IMAGE 100% IMMUTABLE (ANTI BUG ANDROID)
// =====================================================
const StableImage = React.memo(({ uri }: { uri: string }) => {
  return (
    <Image
      source={{ uri }}
      style={styles.thumb}
      contentFit="cover"
      transition={0}
      recyclingKey={uri} // 🔥 CRUCIAL ANDROID
    />
  );
});


// =====================================================
// ITEM
// =====================================================
const TrashItem = ({
  item,
  isSelected,
  onToggle,
}: {
  item: Item;
  isSelected: boolean;
  onToggle: (id: string) => void;
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onToggle(item.id)}
      style={styles.card}
    >
      {/* IMAGE IMMUTABLE */}
      <StableImage uri={item.uri} />

      {/* OVERLAY (au lieu de modifier la card/image) */}
      {isSelected && <View style={styles.selectionOverlay} />}

      {/* CHECK */}
      <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
        {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
      </View>

      {/* VIDEO */}
      {item.type === "video" && (
        <View style={styles.videoIcon}>
          <Ionicons name="play" size={12} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
};


// =====================================================
// SCREEN
// =====================================================
export default function TrashScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [darkMode, setDarkMode] = useState(false);

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;
  const allSelected = items.length > 0 && items.every(i => selectedIds[i.id]);

  useEffect(() => {
    (async () => {
      const [raw, dark] = await Promise.all([
        AsyncStorage.getItem(TRASH_KEY),
        AsyncStorage.getItem(DARK_MODE_KEY),
      ]);

      setDarkMode(dark === "true");

      const parsed: Item[] = raw ? JSON.parse(raw) : [];
      setItems(parsed);

      const init: Record<string, boolean> = {};
      parsed.forEach(i => (init[i.id] = false));
      setSelectedIds(init);
    })();
  }, []);

  const persist = async (arr: Item[]) => {
    await AsyncStorage.setItem(TRASH_KEY, JSON.stringify(arr));
    setItems(arr);

    const reset: Record<string, boolean> = {};
    arr.forEach(i => (reset[i.id] = false));
    setSelectedIds(reset);
  };

  const toggleSelect = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const selectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next: Record<string, boolean> = {};
    items.forEach(i => (next[i.id] = !allSelected));
    setSelectedIds(next);
  };

  const restoreSelected = async () => {
    if (!selectedCount) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await persist(items.filter(i => !selectedIds[i.id]));
  };

  const deleteSelected = async () => {
    const ids = items.filter(i => selectedIds[i.id]).map(i => i.id);
    if (!ids.length) return;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await MediaLibrary.deleteAssetsAsync(ids);
      await persist(items.filter(i => !selectedIds[i.id]));
    } catch {}
  };

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.containerDark]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={30} color={darkMode ? "#fff" : "#000"} />
        </TouchableOpacity>

        <Text style={[styles.title, darkMode && styles.textDark]}>
          Corbeille {items.length > 0 && `(${items.length})`}
        </Text>

        <TouchableOpacity onPress={selectAll}>
          <Ionicons
            name={allSelected ? "checkbox" : "square-outline"}
            size={26}
            color={darkMode ? "#fff" : "#000"}
          />
        </TouchableOpacity>
      </View>

      {/* GRID */}
      <FlashList
        data={items}
        numColumns={COLUMNS}
        estimatedItemSize={CARD_SIZE}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TrashItem
            item={item}
            isSelected={selectedIds[item.id]}
            onToggle={toggleSelect}
          />
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      />

      {/* ACTION BAR */}
      {selectedCount > 0 && (
        <View style={styles.actionsContainer}>
          <View style={styles.actionsCard}>
            <TouchableOpacity onPress={restoreSelected}>
              <View style={styles.btnRestore}>
                <Ionicons name="arrow-undo" size={22} color="#fff" />
              </View>
              <Text style={styles.actionLabel}>Restaurer</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={deleteSelected}>
              <LinearGradient
                colors={["#FF5555", "#CC3333"]}
                style={styles.btnDelete}
              >
                <Ionicons name="trash" size={22} color="#fff" />
              </LinearGradient>
              <Text style={styles.actionLabel}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}


// =====================================================
// STYLES
// =====================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  containerDark: { backgroundColor: "#121212" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "700" },
  textDark: { color: "#fff" },

  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#eee",
  },

  thumb: { width: "100%", height: "100%" },

  // 🔥 OVERLAY AU LIEU DE MODIFIER L’IMAGE
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,184,230,0.18)",
    borderWidth: 3,
    borderColor: "#00B8E6",
    borderRadius: 14,
  },

  selectCircle: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  selectCircleActive: {
    backgroundColor: "#00B8E6",
  },

  videoIcon: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 10,
    padding: 4,
  },

  actionsContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 30,
  },
  actionsCard: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#111",
    borderRadius: 26,
    paddingVertical: 16,
  },
  btnRestore: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#22C55E",
    justifyContent: "center",
    alignItems: "center",
  },
  btnDelete: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
  },
});