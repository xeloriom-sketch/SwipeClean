import React, { useEffect, useState } from "react";
import { View, Text, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";

const TIPS: { icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap; text: string }[] = [
  { icon: "hand-left-outline",   text: "Swipe gauche pour envoyer une photo à la corbeille" },
  { icon: "hand-right-outline",  text: "Swipe droite pour garder une photo en sécurité" },
  { icon: "arrow-up-outline",    text: "Swipe vers le haut pour ajouter aux favoris" },
  { icon: "star-outline",        text: "Retrouve tous tes favoris dans l'onglet ⭐" },
  { icon: "trash-outline",       text: "Les photos supprimées restent dans la corbeille jusqu'à la purge" },
  { icon: "images-outline",      text: "Explore toute ta galerie depuis le menu" },
  { icon: "flash-outline",       text: "Plus tu swipes vite, plus tu nettoies vite" },
  { icon: "heart-outline",       text: "Tes favoris ne seront jamais supprimés accidentellement" },
  { icon: "videocam-outline",    text: "Les vidéos aussi peuvent être triées et nettoyées" },
  { icon: "checkmark-circle-outline", text: "Swipe tout pour avoir une galerie 100% propre" },
  { icon: "time-outline",        text: "SwipeClean trie tes médias du plus récent au plus ancien" },
  { icon: "phone-portrait-outline", text: "Appuie sur les boutons en bas pour swiper sans les mains" },
];

function pickRandom<T>(arr: T[], exclude?: T): T {
  const pool = exclude !== undefined ? arr.filter(x => x !== exclude) : arr;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function AppLoader({ dark: darkProp }: { dark?: boolean }) {
  const scheme = useColorScheme();
  const dark = darkProp !== undefined ? darkProp : scheme === "dark";

  const [tip, setTip] = useState(() => pickRandom(TIPS));

  useEffect(() => {
    const id = setInterval(() => {
      setTip(prev => pickRandom(TIPS, prev));
    }, 3500);
    return () => clearInterval(id);
  }, []);

  const bg   = dark ? "#0d0d0d" : "#f5f5f5";
  const fg   = dark ? "#ffffff" : "#111111";
  const sub  = dark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)";
  const card = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";

  return (
    <View style={{ flex: 1, backgroundColor: bg, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
      <LottieView
        source={{ uri: "https://lottie.host/8db10b17-18a9-4006-aa6d-af1dd6435fa9/UlAWQqZjew.lottie" }}
        autoPlay
        loop
        style={{ width: 160, height: 160 }}
      />

      <Text style={{ color: fg, fontSize: 26, fontWeight: "800", letterSpacing: 1.5, marginTop: 20 }}>
        SwipeClean
      </Text>
      <Text style={{ color: sub, fontSize: 13, marginTop: 6, letterSpacing: 0.4 }}>
        Chargement de vos médias…
      </Text>

      {/* Tip card */}
      <View style={{
        marginTop: 48,
        backgroundColor: card,
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        width: "100%",
      }}>
        <Ionicons name={tip.icon} size={26} color={sub} />
        <Text style={{ color: sub, fontSize: 13.5, lineHeight: 20, flex: 1 }}>
          {tip.text}
        </Text>
      </View>
    </View>
  );
}
