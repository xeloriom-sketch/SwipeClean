import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Dimensions,
  Image,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Platform,
} from "react-native";
import * as MediaLibrary from "expo-media-library";
import Svg, { Path, Circle } from "react-native-svg";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";


/*******************************************/
/*************** RESPONSIVE ****************/
/*******************************************/
const { width } = Dimensions.get("window");

// Ajustement automatique selon plateforme
const SCALE = Platform.OS === "android" ? 0.9 : 1;

// Largeur des cartes (fluide)
const CARD_WIDTH = width * 0.28 * SCALE;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

const DARK_MODE_KEY = "@app_dark_mode";

type Gallery = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  count: number;
  coverUris: string[];
};


// ----------------- Icons -----------------

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


// Stack de cartes
const GalleryCardStack = ({ uris, darkMode }) => {
  const positions = ["leftCard", "centerCard", "rightCard"];
  const images = uris?.slice(0, 3) || [];

  return (
    <View style={styles.stackContainer}>
      {images.map((uri, i) => (
        <View
          key={i}
          style={[
            styles.stackCard,
            styles[positions[i]],
            { backgroundColor: darkMode ? "#222" : "#111" },
          ]}
        >
          <Image source={{ uri }} style={styles.stackImage} />
        </View>
      ))}
    </View>
  );
};


// ----------------- MAIN ------------------

export default function GalleryScreen() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(DARK_MODE_KEY);
      setDarkMode(stored === "true");
    })();
  }, []);

  const fetchGalleries = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") return;

    const albums = await MediaLibrary.getAlbumsAsync();

    const galleriesData = await Promise.all(
      albums.map(async (album) => {
        const assets = await MediaLibrary.getAssetsAsync({
          album: album.id,
          mediaType: "photo",
          first: 3,
          sortBy: [["creationTime", false]],
        });

        if (!assets.totalCount) return null;

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

        const startDate = assets.assets.length
          ? new Date(
              assets.assets[assets.assets.length - 1].creationTime
            ).toLocaleDateString()
          : "-";

        const endDate = assets.assets.length
          ? new Date(assets.assets[0].creationTime).toLocaleDateString()
          : "-";

        return {
          id: album.id,
          title: album.title,
          startDate,
          endDate,
          count: assets.totalCount,
          coverUris: uris,
        };
      })
    );

    setGalleries(galleriesData.filter(Boolean) as Gallery[]);
  };

  useEffect(() => {
    fetchGalleries();
  }, []);

  const renderItem = ({ item }: { item: Gallery }) => (
    <TouchableOpacity
      style={[
        styles.itemContainer,
        { backgroundColor: darkMode ? "#121212" : "#fff" },
      ]}
      onPress={() => router.push(`/Gallery/${item.id}`)}
    >
      <Text style={[styles.name, { color: darkMode ? "#E0E0E0" : "#000" }]}>
        {item.title}
      </Text>

      <Text style={[styles.date, { color: darkMode ? "#aaa" : "#555" }]}>
        {item.startDate} - {item.endDate}
      </Text>

      <GalleryCardStack uris={item.coverUris} darkMode={darkMode} />

      <Text style={[styles.nbPhoto, { color: darkMode ? "#aaa" : "#555" }]}>
        {item.count} photos
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: darkMode ? "#121212" : "#fff" },
      ]}
    >
      <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
        <BackArrowIcon size={36} color={darkMode ? "#E0E0E0" : "#000"} />
      </TouchableOpacity>

      {galleries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyGalleryIcon size={120} color={darkMode ? "#555" : "#ccc"} />
          <Text style={[styles.emptyText, { color: darkMode ? "#aaa" : "#999" }]}>
            Vous n’avez aucune galerie
          </Text>
        </View>
      ) : (
        <FlatList
          data={galleries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </SafeAreaView>
  );
}


// ----------------- STYLES -----------------

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
    marginVertical: 18,
    paddingVertical: 10,
  },

  name: {
    fontSize: width * 0.055, // responsive
    fontWeight: "700",
    marginBottom: 10,
  },

  date: {
    fontSize: width * 0.035,
    marginBottom: 25,
  },

  nbPhoto: {
    fontSize: width * 0.035,
    marginTop: 10,
  },

  /************* STACK *************/
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

  stackImage: {
    width: "100%",
    height: "100%",
  },

  /************* EMPTY *************/
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