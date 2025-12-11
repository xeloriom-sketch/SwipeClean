//app/(tabs)/Favorites.tsx
import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    Image,
    StyleSheet,
    StatusBar,
    Dimensions,
    TouchableOpacity,
    ActivityIndicator,
    FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";

const { width } = Dimensions.get("window");
const FAVORITES_KEY = "@app_favorites";
const DARK_MODE_KEY = "@app_dark_mode";
const COLS = 2;
const GAP = 12;
const ITEM_W = (width - GAP * 3) / COLS;
const ITEM_H = ITEM_W * 1.4;

type Item = {
    id: string;
    uri: string;
    type?: string;
};

// ------------------- ICONS -------------------

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

const HeartStarIcon = ({ size = 36, color = "#E53935" }: { size?: number; color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <Path
            d="M18 32L15.5 29.7C8 22.9 3 18.4 3 12.8C3 8.3 6.5 4.8 11 4.8C13.5 4.8 15.9 5.95 18 7.9C20.1 5.95 22.5 4.8 25 4.8C29.5 4.8 33 8.3 33 12.8C33 18.4 28 22.9 20.5 29.7L18 32Z"
            fill={color}
        />
        <Path
            d="M18 12L19.5 16H23.5L20.5 18.5L21.5 22.5L18 20L14.5 22.5L15.5 18.5L12.5 16H16.5L18 12Z"
            fill="#fff"
        />
    </Svg>
);

export default function FavoritesScreen() {
    const [images, setImages] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [darkMode, setDarkMode] = useState(false);

    // NEW: fullscreen image state
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    useEffect(() => {
        loadFavorites();
        loadDarkMode();
    }, []);

    const loadFavorites = async () => {
        try {
            const raw = await AsyncStorage.getItem(FAVORITES_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            setImages(arr);
        } catch (e) {
            console.warn("Failed to load favorites", e);
        }
        setLoading(false);
    };

    const loadDarkMode = async () => {
        try {
            const raw = await AsyncStorage.getItem(DARK_MODE_KEY);
            setDarkMode(raw === "true");
        } catch (e) {
            console.warn("Failed to load dark mode", e);
        }
    };

    const toggleDarkMode = async () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        await AsyncStorage.setItem(DARK_MODE_KEY, newMode ? "true" : "false");
    };

    const handleRemove = async (item: Item) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        const updated = images.filter((i) => i.id !== item.id);
        setImages(updated);
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, darkMode && styles.containerDark]}>
                <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={darkMode ? "#fff" : "#000"} />
                    <Text style={[styles.loadingText, darkMode && { color: "#fff" }]}>
                        Chargement...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, darkMode && styles.containerDark]}>
            <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />

            {/* ---------------- HEADER ---------------- */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
                    <BackArrowIcon size={36} color={darkMode ? "#fff" : "#000"} />
                </TouchableOpacity>

                <View style={styles.titleWrap}>
                    <Text style={[styles.title, darkMode && { color: "#fff" }]}>Favoris</Text>
                    {images.length > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{images.length}</Text>
                        </View>
                    )}
                </View>

                <TouchableOpacity style={styles.headerBtn} onPress={toggleDarkMode}>
                    <HeartStarIcon size={34} color={darkMode ? "#ff6b6b" : "#E53935"} />
                </TouchableOpacity>
            </View>

            {/* ---------------- GALLERY ---------------- */}
            {images.length > 0 ? (
                <FlatList
                    data={images}
                    numColumns={COLS}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.gallery}
                    columnWrapperStyle={{ gap: GAP }}
                    ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            activeOpacity={0.9}
                            style={styles.item}
                            onPress={() => setSelectedImage(item.uri)} // FULLSCREEN
                        >
                            <Image source={{ uri: item.uri }} style={styles.image} />

                            <TouchableOpacity
                                activeOpacity={0.85}
                                style={styles.deleteBtn}
                                onPress={() => handleRemove(item)}
                            >
                                <Ionicons name="close" color="#fff" size={18} />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    )}
                />
            ) : (
                <View style={styles.empty}>
                    <Ionicons name="heart-outline" size={64} color="rgba(0,0,0,0.15)" />
                    <Text style={[styles.emptyTitle, darkMode && { color: "#fff" }]}>
                        Pas de favoris
                    </Text>
                    <Text style={[styles.emptySubtitle, darkMode && { color: "rgba(255,255,255,0.6)" }]}>
                        Swipez vers le haut pour ajouter des favoris
                    </Text>
                </View>
            )}

            {/* ---------------- FULLSCREEN IMAGE ---------------- */}
            {selectedImage && (
                <View style={styles.fullscreenContainer}>
                    <TouchableOpacity
                        activeOpacity={1}
                        style={styles.fullscreenBackground}
                        onPress={() => setSelectedImage(null)}
                    >
                        <Image
                            source={{ uri: selectedImage }}
                            style={styles.fullscreenImage}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

// ------------------------- STYLES -------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFF",
    },
    containerDark: {
        backgroundColor: "#121212",
    },

    loading: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        fontWeight: "500",
    },

    header: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    headerBtn: {
        padding: 4,
    },
    titleWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: "700",
        letterSpacing: 0.4,
        color: "#000",
    },
    badge: {
        backgroundColor: "#E53935",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    badgeText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "700",
    },

    gallery: {
        paddingHorizontal: GAP,
        paddingTop: GAP,
        paddingBottom: 40,
    },
    item: {
        width: ITEM_W,
        height: ITEM_H,
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: "#000",
    },
    image: {
        width: "100%",
        height: "100%",
    },

    deleteBtn: {
        position: "absolute",
        top: 8,
        right: 8,
        backgroundColor: "rgba(0,0,0,0.6)",
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
    },

    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 40,
    },
    emptyTitle: {
        marginTop: 18,
        fontSize: 20,
        fontWeight: "700",
        color: "#000",
    },
    emptySubtitle: {
        marginTop: 6,
        fontSize: 14,
        color: "rgba(0,0,0,0.45)",
        textAlign: "center",
    },

    // --------- FULLSCREEN IMAGE ----------
    fullscreenContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.9)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999,
    },
    fullscreenBackground: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
    },
    fullscreenImage: {
        width: "90%",
        height: "90%",
        borderRadius: 12,
    },
});