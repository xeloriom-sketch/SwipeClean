import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUnlocked, type Achievement } from "../../utils/achievements";

const { width } = Dimensions.get("window");
const DARK_MODE_KEY = "@app_dark_mode";
const ICON_SIZE = 52;

function AchievIcon({ achievement, locked }: { achievement: Achievement; locked: boolean }) {
  const glow = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!locked) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.6, duration: 1800, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [locked]);

  if (locked) {
    return (
      <View style={[styles.iconWrap, { backgroundColor: "rgba(128,128,128,0.12)" }]}>
        <Ionicons name="lock-closed" size={26} color="rgba(128,128,128,0.5)" />
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.iconWrap,
        {
          backgroundColor: achievement.color + "22",
          borderColor: achievement.color + "55",
          borderWidth: 1.5,
          shadowColor: achievement.color,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: 8,
          opacity: glow,
        },
      ]}
    >
      <Ionicons name={achievement.icon as any} size={28} color={achievement.color} />
    </Animated.View>
  );
}

export default function AchievementsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    (async () => {
      const [dm, achiev] = await Promise.all([
        AsyncStorage.getItem(DARK_MODE_KEY),
        getUnlocked(),
      ]);
      if (dm !== null) setDarkMode(dm === "true");
      setAchievements(achiev);
    })();
  }, []);

  const bg = darkMode ? "#0d0d0d" : "#F2F2F7";
  const card = darkMode ? "#1a1a1a" : "#fff";
  const text = darkMode ? "#fff" : "#0d0d0d";
  const sub = darkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)";
  const border = darkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";

  const unlocked = achievements.filter((a) => a.unlockedAt);
  const locked = achievements.filter((a) => !a.unlockedAt);
  const pct = achievements.length ? Math.round((unlocked.length / achievements.length) * 100) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: text }]}>Succès</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Score card */}
        <View style={[styles.scoreCard, { backgroundColor: card, borderColor: border }]}>
          <View style={styles.scoreRow}>
            <View>
              <Text style={[styles.scoreNum, { color: text }]}>{unlocked.length}</Text>
              <Text style={[styles.scoreOf, { color: sub }]}>sur {achievements.length} succès</Text>
            </View>
            <View style={styles.scoreCircle}>
              <Text style={[styles.scorePct, { color: text }]}>{pct}%</Text>
            </View>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: darkMode ? "#2a2a2a" : "#eee" }]}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
        </View>

        {/* Unlocked */}
        {unlocked.length === 0 ? (
          <View style={[styles.emptyEncourage, { backgroundColor: card, borderColor: border }]}>
            <Ionicons name="flash" size={32} color="#FFD60A" />
            <Text style={[styles.encourageTitle, { color: text }]}>Commence à swiper !</Text>
            <Text style={[styles.encourageSub, { color: sub }]}>Tes premiers succès t'attendent</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.section, { color: sub }]}>DÉBLOQUÉS — {unlocked.length}</Text>
            <View style={styles.grid}>
              {unlocked.map((a) => (
                <View key={a.id} style={[styles.achCard, { backgroundColor: card, borderColor: a.color + "44" }]}>
                  <AchievIcon achievement={a} locked={false} />
                  <Text style={[styles.achTitle, { color: text }]} numberOfLines={2}>{a.title}</Text>
                  <Text style={[styles.achDesc, { color: sub }]} numberOfLines={2}>{a.desc}</Text>
                  {a.unlockedAt && (
                    <Text style={[styles.achDate, { color: a.color + "99" }]}>
                      {new Date(a.unlockedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                    </Text>
                  )}
                  <View style={[styles.checkBadge, { backgroundColor: a.color + "22" }]}>
                    <Ionicons name="checkmark" size={12} color={a.color} />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Locked */}
        {locked.length > 0 && (
          <>
            <Text style={[styles.section, { color: sub, marginTop: 28 }]}>À DÉBLOQUER — {locked.length}</Text>
            <View style={styles.grid}>
              {locked.map((a) => (
                <View key={a.id} style={[styles.achCard, { backgroundColor: card, borderColor: border, opacity: 0.45 }]}>
                  <AchievIcon achievement={a} locked />
                  <Text style={[styles.achTitle, { color: text }]} numberOfLines={2}>{a.title}</Text>
                  <Text style={[styles.achDesc, { color: sub }]} numberOfLines={2}>{a.desc}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const CARD_SIZE = (width - 48) / 2;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 14,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: "700" },

  content: { paddingHorizontal: 16, paddingBottom: 56 },

  scoreCard: {
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  scoreNum: { fontSize: 52, fontWeight: "800", letterSpacing: -2, lineHeight: 56 },
  scoreOf: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  scoreCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(76,255,94,0.12)",
    borderWidth: 2,
    borderColor: "rgba(76,255,94,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  scorePct: { fontSize: 20, fontWeight: "800" },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#4CFF5E",
  },

  section: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.9,
    marginBottom: 14,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  achCard: {
    width: CARD_SIZE,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    alignItems: "flex-start",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },

  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  achTitle: { fontSize: 13, fontWeight: "700", marginBottom: 4, lineHeight: 18 },
  achDesc: { fontSize: 11, lineHeight: 15 },
  achDate: { fontSize: 10, fontWeight: "600", marginTop: 5 },

  emptyEncourage: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    gap: 8,
    marginBottom: 28,
  },
  encourageTitle: { fontSize: 17, fontWeight: "700", marginTop: 4 },
  encourageSub: { fontSize: 13, textAlign: "center" },

  checkBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
});
