// app/(tabs)/Trash.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    FlatList,
    Image,
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
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");
const TRASH_KEY = "@app_trash";
const DARK_MODE_KEY = "@app_dark_mode";
const COLUMNS = 3;
const GAP = 6;
const CARD_SIZE = (width - 32 - GAP * (COLUMNS - 1)) / COLUMNS;

type Item = { id: string; uri: string; type?: string };

// ==================== CUSTOM SVG ICONS ====================
const BackArrowIcon = ({ size = 32, color = "#000" }: { size?: number; color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <Path
            d="M20 8L12 16L20 24"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

const SelectAllIcon = ({
    size = 32,
    color = "#000",
    selected = false,
}: {
    size?: number;
    color?: string;
    selected?: boolean;
}) => (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <Path
            d="M6 8H22V24H6V8Z"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={selected ? color : "none"}
        />
        <Path
            d="M10 4H26V20"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        {selected && (
            <Path
                d="M10 16L13 19L18 12"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        )}
    </Svg>
);

// ==================== FIX: TrashItem SANS MEMO ====================
const TrashItem = ({
    item,
    isSelected,
    onToggle,
    darkMode,
}: {
    item: Item;
    isSelected: boolean;
    onToggle: (id: string) => void;
    darkMode: boolean;
}) => {
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            style={[
                styles.card,
                isSelected && styles.cardSelected,
                darkMode && styles.cardDark,
            ]}
            onPress={() => onToggle(item.id)}
        >
            <Image
                source={{ uri: item.uri }}
                style={styles.thumb}
                resizeMode="cover"
                fadeDuration={0}
            />

            {/* Selection indicator */}
            <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
                {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
            </View>

            {/* Video indicator */}
            {item.type === "video" && (
                <View style={styles.videoIcon}>
                    <Ionicons name="play" size={10} color="#fff" />
                </View>
            )}
        </TouchableOpacity>
    );
};

export default function TrashScreen() {
    const [items, setItems] = useState<Item[]>([]);
    const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [darkMode, setDarkMode] = useState(false);

    const selectedCount = Object.values(selectedIds).filter((v) => v === true).length;
    const allSelected = items.length > 0 && items.every((it) => selectedIds[it.id] === true);

    // Charger dark mode + items
    useEffect(() => {
        const load = async () => {
            try {
                const [rawItems, savedDarkMode] = await Promise.all([
                    AsyncStorage.getItem(TRASH_KEY),
                    AsyncStorage.getItem(DARK_MODE_KEY),
                ]);

                if (savedDarkMode !== null) {
                    setDarkMode(savedDarkMode === "true");
                }

                const loadedItems = rawItems ? JSON.parse(rawItems) : [];
                setItems(loadedItems);

                const initialSelection: Record<string, boolean> = {};
                loadedItems.forEach((item: Item) => {
                    initialSelection[item.id] = false;
                });
                setSelectedIds(initialSelection);
            } catch (e) {
                console.error("Load error", e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const persist = async (arr: Item[]) => {
        await AsyncStorage.setItem(TRASH_KEY, JSON.stringify(arr));
        setItems(arr);

        const newSelection: Record<string, boolean> = {};
        arr.forEach((item) => {
            newSelection[item.id] = false;
        });
        setSelectedIds(newSelection);
    };

    const toggleSelect = useCallback((id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedIds((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    }, []);

    const selectAll = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        setSelectedIds(() => {
            const next: Record<string, boolean> = {};
            items.forEach((it) => {
                next[it.id] = !allSelected;
            });
            return next;
        });
    }, [items, allSelected]);

    const restoreSelected = async () => {
        if (!selectedCount) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const rest = items.filter((it) => !selectedIds[it.id]);
        await persist(rest);
    };

    const deleteSelected = async () => {
        const toDelete = items.filter((it) => selectedIds[it.id]).map((i) => i.id);
        if (!toDelete.length) return;

        try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await MediaLibrary.deleteAssetsAsync(toDelete);
            const rest = items.filter((it) => !selectedIds[it.id]);
            await persist(rest);
        } catch (e) {
            console.warn("delete failed", e);
        }
    };

    const renderItem = useCallback(
        ({ item }: { item: Item }) => {
            return (
                <TrashItem
                    item={item}
                    isSelected={selectedIds[item.id] === true}
                    onToggle={toggleSelect}
                    darkMode={darkMode}
                />
            );
        },
        [selectedIds, toggleSelect, darkMode]
    );

    const keyExtractor = useCallback((item: Item) => item.id, []);

    const EmptyState = () => (
        <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconRing, darkMode && styles.emptyIconRingDark]}>
                <Ionicons
                    name="trash-outline"
                    size={60}
                    color={darkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}
                />
            </View>
            <Text style={[styles.emptyTitle, darkMode && styles.textDark]}>Corbeille vide</Text>
            <Text style={[styles.emptySubtitle, darkMode && styles.subtitleDark]}>
                Les médias supprimés apparaîtront ici
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, darkMode && styles.containerDark]}>
            <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                >
                    <BackArrowIcon size={36} color={darkMode ? "#E0E0E0" : "#000"} />
                </TouchableOpacity>

                <View style={styles.titleContainer}>
                    <Text style={[styles.title, darkMode && styles.textDark]}>Corbeille</Text>
                    {items.length > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{items.length}</Text>
                        </View>
                    )}
                </View>

                <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={selectAll}
                    activeOpacity={0.7}
                >
                    <SelectAllIcon
                        size={32}
                        color={darkMode ? "#E0E0E0" : "#000"}
                        selected={allSelected}
                    />
                </TouchableOpacity>
            </View>

            {/* Stats bar */}
            {items.length > 0 && (
                <View style={styles.statsBar}>
                    <Text style={[styles.statsText, darkMode && styles.statsTextDark]}>
                        {selectedCount > 0
                            ? `${selectedCount} sélectionné${selectedCount > 1 ? "s" : ""}`
                            : `${items.length} élément${items.length > 1 ? "s" : ""}`}
                    </Text>
                </View>
            )}

            {/* Grid */}
            <FlatList
                data={items}
                keyExtractor={keyExtractor}
                numColumns={COLUMNS}
                contentContainerStyle={styles.listContent}
                columnWrapperStyle={styles.row}
                renderItem={renderItem}
                ListEmptyComponent={EmptyState}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={false}
                maxToRenderPerBatch={21}
                updateCellsBatchingPeriod={100}
                windowSize={7}
                initialNumToRender={21}
            />

            {/* Bottom Actions */}
            {selectedCount > 0 && (
                <View style={styles.actionsContainer}>
                    <View style={[styles.actionsCard, darkMode && styles.actionsCardDark]}>
                        {/* Restore button */}
                        <TouchableOpacity
                            onPress={restoreSelected}
                            style={styles.actionBtn}
                            activeOpacity={0.8}
                        >
                            <View style={styles.btnRestore}>
                                <Ionicons name="arrow-undo" size={22} color="#fff" />
                            </View>
                            <Text style={styles.actionLabel}>Restaurer</Text>
                        </TouchableOpacity>

                        {/* Delete button */}
                        <TouchableOpacity
                            onPress={deleteSelected}
                            style={styles.actionBtn}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={["#FF5555", "#CC3333"]}
                                start={{ x: 0.0, y: 0.0 }}
                                end={{ x: 1.0, y: 1.0 }}
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    containerDark: {
        backgroundColor: "#121212",
    },

    // Header
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    headerBtn: {
        padding: 4,
    },
    titleContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: "#000",
        letterSpacing: 0.3,
    },
    textDark: {
        color: "#E0E0E0",
    },
    badge: {
        backgroundColor: "#E53935",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    badgeText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "700",
    },

    // Stats bar
    statsBar: {
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    statsText: {
        fontSize: 14,
        color: "rgba(0,0,0,0.5)",
        fontWeight: "500",
    },
    statsTextDark: {
        color: "rgba(255,255,255,0.5)",
    },

    // Grid
    listContent: {
        padding: 16,
        paddingBottom: 140,
    },
    row: {
        gap: GAP,
        marginBottom: GAP,
    },

    // Card
    card: {
        width: CARD_SIZE,
        height: CARD_SIZE,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#f0f0f0",
    },
    cardDark: {
        backgroundColor: "#1a1a1a",
    },
    cardSelected: {
        borderWidth: 3,
        borderColor: "#00B8E6",
    },
    thumb: {
        width: "100%",
        height: "100%",
    },
    selectCircle: {
        position: "absolute",
        top: 6,
        right: 6,
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.8)",
        backgroundColor: "rgba(0,0,0,0.2)",
        justifyContent: "center",
        alignItems: "center",
    },
    selectCircleActive: {
        backgroundColor: "#00B8E6",
        borderColor: "#00B8E6",
    },
    videoIcon: {
        position: "absolute",
        bottom: 6,
        left: 6,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },

    // Empty State
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: height * 0.2,
    },
    emptyIconRing: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 2,
        borderColor: "rgba(0,0,0,0.08)",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.02)",
        marginBottom: 20,
    },
    emptyIconRingDark: {
        borderColor: "rgba(255,255,255,0.08)",
        backgroundColor: "rgba(255,255,255,0.02)",
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#000",
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: "rgba(0,0,0,0.4)",
    },
    subtitleDark: {
        color: "rgba(255,255,255,0.4)",
    },

    // Actions
    actionsContainer: {
        position: "absolute",
        bottom: 30,
        left: 16,
        right: 16,
    },
    actionsCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        backgroundColor: "rgba(10,10,10,0.95)",
        borderRadius: 24,
        paddingVertical: 16,
        paddingHorizontal: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 10,
    },
    actionsCardDark: {
        backgroundColor: "rgba(30,30,30,0.95)",
    },
    actionBtn: {
        alignItems: "center",
        gap: 6,
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
        fontSize: 11,
        fontWeight: "600",
        color: "#fff",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
});