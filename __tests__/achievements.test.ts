import AsyncStorage from "@react-native-async-storage/async-storage";
import { checkAndUnlock, checkSwipeMilestones } from "../utils/achievements";

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("succès", () => {
  it("ne débloque un succès qu'une fois", async () => {
    expect(await checkAndUnlock("first_swipe")).not.toBeNull();
    expect(await checkAndUnlock("first_swipe")).toBeNull();
  });

  it("ne perd pas de succès quand plusieurs partent en parallèle", async () => {
    // C'était le bug: trois `checkAndUnlock` concurrents lisaient la même valeur et le
    // dernier écrivain gagnait. Les paliers testant une égalité exacte, le succès
    // écrasé était perdu à vie.
    const ids = ["first_swipe", "first_trash", "night_swipe"];
    const results = await Promise.all(ids.map((id) => checkAndUnlock(id)));
    expect(results.every((r) => r !== null)).toBe(true);

    const raw = await AsyncStorage.getItem("@app_achievements");
    expect(Object.keys(JSON.parse(raw!)).sort()).toEqual([...ids].sort());
  });

  it("débloque tous les paliers franchis d'un coup", async () => {
    // Reprise du compteur depuis l'ancienne clé: 0 -> 347 sans passer par les paliers.
    const highest = await checkSwipeMilestones(347);
    expect(highest?.id).toBe("swipes_200");

    const raw = await AsyncStorage.getItem("@app_achievements");
    const unlocked = Object.keys(JSON.parse(raw!));
    expect(unlocked).toEqual(
      expect.arrayContaining(["first_swipe", "swipes_10", "swipes_50", "swipes_100", "swipes_200"])
    );
    expect(unlocked).not.toContain("swipes_500");
  });

  it("ne renvoie rien quand tous les paliers atteints sont déjà débloqués", async () => {
    await checkSwipeMilestones(50);
    expect(await checkSwipeMilestones(50)).toBeNull();
  });

  it("ne débloque rien sous le premier palier", async () => {
    expect(await checkSwipeMilestones(0)).toBeNull();
    expect(await AsyncStorage.getItem("@app_achievements")).toBeNull();
  });
});
