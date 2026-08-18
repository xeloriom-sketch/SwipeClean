import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Dimensions,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  useColorScheme,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import Svg, { Path, Circle } from "react-native-svg";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppLoader from "../../components/AppLoader";
import { unlockAndNotify } from "../../utils/achievements";

const { width } = Dimensions.get("window");
const SCALE = Platform.OS === "android" ? 0.9 : 1;
const CARD_WIDTH = width * 0.28 * SCALE;
const CARD_HEIGHT = CARD_WIDTH * 1.4;
const DARK_MODE_KEY = "@app_dark_mode";

type Gallery = {
  id: string;
  title: string;
  count: number;
  coverUris: string[];
};

const BackArrowIcon = ({ size = 32, color = "#000" }) => (
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

const EmptyGalleryIcon = ({ size = 100, color = "#ccc" }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <Circle cx="32" cy="32" r="30" stroke={color} strokeWidth="4" />
    <Path
      d="M16 40 L28 24 L40 36 L48 28"
      stroke={color}
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

function SkeletonCard({ darkMode }: { darkMode: boolean }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={[
        styles.stackCard,
        { backgroundColor: darkMode ? "#2a2a2a" : "#e0e0e0", opacity: anim },
      ]}
    />
  );
}

const STACK_POS: (keyof typeof styles)[] = ["leftCard", "centerCard", "rightCard"];

const GalleryCardStack = React.memo(function GalleryCardStack({
  uris,
  darkMode,
}: {
  uris: string[];
  darkMode: boolean;
}) {
  const images = (uris ?? []).slice(0, 3);
  const isLoading = images.length === 0;

  return (
    <View style={styles.stackContainer}>
      {isLoading
        ? [0, 1, 2].map((i) => (
            <View key={i} style={[styles.stackCard, styles[STACK_POS[i]] as object]}>
              <SkeletonCard darkMode={darkMode} />
            </View>
          ))
        : images.map((uri, i) => (
            <View
              key={uri}
              style={[
                styles.stackCard,
                styles[STACK_POS[i]] as object,
                { backgroundColor: darkMode ? "#222" : "#111" },
              ]}
            >
              <Image
                source={{ uri }}
                style={styles.stackImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={uri}
              />
            </View>
          ))}
    </View>
  );
});

export default function GalleryScreen() {
  const systemScheme = useColorScheme();
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [darkMode, setDarkMode] = useState(systemScheme === "dark");
  const [initialLoading, setInitialLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem(DARK_MODE_KEY)
      .then((v) => { if (v !== null) setDarkMode(v === "true"); })
      .catch(() => {});
    unlockAndNotify("gallery_open");
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadCovers = async (album: MediaLibrary.Album): Promise<{ id: string; uris: string[] } | null> => {
      try {
        const assets = await MediaLibrary.getAssetsAsync({
          album: album.id,
          mediaType: "photo",
          first: 3,
          sortBy: [["creationTime", false]],
        });
        if (!assets.assets.length) return null;
        const uris = await Promise.all(
          assets.assets.map(async (asset) => {
            let uri = asset.uri;
            if (Platform.OS === "ios" && uri.startsWith("ph://")) {
              const info = await MediaLibrary.getAssetInfoAsync(asset);
              uri = info.localUri || uri;
            }
            return uri;
          })
        );
        return { id: album.id, uris: uris.filter(Boolean) as string[] };
      } catch {
        return null;
      }
    };

    (async () => {
      const startTime = Date.now();

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        if (mounted) setInitialLoading(false);
        return;
      }

      const albums = await MediaLibrary.getAlbumsAsync();
      const valid = albums.filter((a) => a.assetCount > 0);

      if (!mounted) return;
      setGalleries(valid.map((a) => ({ id: a.id, title: a.title, count: a.assetCount, coverUris: [] })));

      // Charger toutes les couvertures par chunks de 6 avant d'afficher
      for (let i = 0; i < valid.length; i += 6) {
        if (!mounted) return;
        const chunk = valid.slice(i, i + 6);
        const results = await Promise.all(
          chunk.map((album) =>
            Promise.race([
              loadCovers(album),
              new Promise<null>((res) => setTimeout(() => res(null), 4000)),
            ])
          )
        );
        if (!mounted) return;
        setGalleries((prev) =>
          prev.map((g) => {
            const r = results.find((x) => x?.id === g.id);
            return r ? { ...g, coverUris: r.uris } : g;
          })
        );
      }

      const elapsed = Date.now() - startTime;
      if (elapsed < 400) await new Promise((r) => setTimeout(r, 400 - elapsed));
      if (!mounted) return;
      // Filtrer les albums sans couverture chargée (URI invalide ou erreur)
      setGalleries((prev) => prev.filter((g) => g.coverUris.length > 0));
      setInitialLoading(false);
    })();

    return () => { mounted = false; };
  }, []);

  const bg = darkMode ? "#121212" : "#fff";
  const text = darkMode ? "#E0E0E0" : "#000";
  const sub = darkMode ? "#aaa" : "#555";

  if (initialLoading) return <AppLoader dark={darkMode} />;

  const renderItem = ({ item }: { item: Gallery }) => (
    <TouchableOpacity
      style={[styles.itemContainer, { backgroundColor: bg }]}
      onPress={() => router.push(`/Gallery/${item.id}`)}
      activeOpacity={0.75}
    >
      <Text style={[styles.name, { color: text }]}>{item.title}</Text>
      <Text style={[styles.count, { color: sub }]}>{item.count} photos</Text>
      <GalleryCardStack uris={item.coverUris} darkMode={darkMode} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
        <BackArrowIcon size={36} color={text} />
      </TouchableOpacity>

      {galleries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyGalleryIcon size={120} color={darkMode ? "#555" : "#ccc"} />
          <Text style={[styles.emptyText, { color: sub }]}>
            Vous n'avez aucune galerie
          </Text>
        </View>
      ) : (
        <FlatList
          data={galleries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={10}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerBtn: {
    padding: 10,
    paddingTop: Platform.OS === "android" ? 16 : 10,
    margin: 10,
  },

  itemContainer: {
    width: "100%",
    alignItems: "center",
    marginVertical: 16,
    paddingVertical: 10,
  },

  name: {
    fontSize: width * 0.055,
    fontWeight: "700",
    marginBottom: 6,
  },

  count: {
    fontSize: width * 0.035,
    marginBottom: 20,
  },

  stackContainer: {
    width: CARD_WIDTH * 2.2,
    height: CARD_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },

  stackCard: {
    position: "absolute",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 18,
    overflow: "hidden",
    elevation: 8,
  },

  leftCard: { transform: [{ rotate: "-10deg" }], left: 0 },
  centerCard: { transform: [{ rotate: "0deg" }], zIndex: 2 },
  rightCard: { transform: [{ rotate: "10deg" }], right: 0 },

  stackImage: { width: "100%", height: "100%" },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: width * 0.045,
    marginTop: 14,
    textAlign: "center",
  },
});
