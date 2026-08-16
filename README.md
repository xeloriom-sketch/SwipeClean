# SwipeClean

Application mobile React Native / Expo pour nettoyer sa galerie photo par swipe, comme Tinder pour les photos et vidéos.

---

## Stack

| Couche | Technologie |
|---|---|
| Framework | Expo SDK 54 / React Native 0.81 |
| Navigation | expo-router 6 (file-based) + Slot layout |
| Animations | react-native-reanimated ~4.1.1 |
| Gestes | react-native-gesture-handler ~2.28 |
| Images | expo-image ~3.0.11 |
| Vidéos | react-native-video ^6.18 (native build uniquement) |
| Lottie | lottie-react-native ^7.4 |
| Listes | @shopify/flash-list 2.0.2 |
| Stockage local | @react-native-async-storage/async-storage ^2.2 |
| Haptics | expo-haptics ~15.0 |
| Audio | expo-av ^16.0 |
| Notifications | expo-notifications ~0.32 |
| Médias | expo-media-library ^18.2 |
| Blur | expo-blur ^15.0 |
| Gradient | expo-linear-gradient ^15.0 |
| OTA | expo-updates ~0.28 (EAS Update) |
| CI/CD | EAS Build + GitHub Actions |
| Tests | Jest 30 + @testing-library/react-native |
| Types | TypeScript ~5.9 |

**React Compiler** activé (`experiments.reactCompiler: true`), **New Architecture** activée.

---

## Architecture

### Fichiers clés

```
app/
  _layout.tsx               — root layout (Slot)
  (tabs)/
    _layout.tsx             — tab layout (Slot, pas de tab bar native)
    index.tsx               — écran principal swipe
    Favorites.tsx           — favoris
    Trash.tsx               — corbeille
    Gallery.tsx             — galerie complète
    Stats.tsx               — statistiques de tri
    Achievements.tsx        — succès débloqués
    Settings.tsx            — paramètres
    Onboarding.tsx          — tutoriel first-launch
    Gallery/[id].tsx        — détail photo/vidéo

components/
  AppLoader.tsx             — splash loading avec Lottie + tips rotatifs
  ui/                       — icon-symbol, collapsible

constants/
  theme.ts                  — Colors (light/dark) + Fonts (Platform.select)

utils/
  achievements.ts           — logique succès (AsyncStorage)
  notifications.ts          — push notifications

assets/
  animations/               — fichiers .lottie (loader, etc.)
  sounds/                   — swipe-delete.wav, swipe-keep.wav, swipe-star.wav
  images/                   — icônes, logo, splash
```

### SwipeableCard — mécanique centrale

- `stackProgress: SharedValue<number>` passé du parent vers les cartes
- La carte du dessus **écrit** stackProgress pendant le drag
- La carte du dessous **lit** stackProgress pour son animation de scale (0.95 → 1.0)
- `key={item.id}` sur les cartes → React réutilise l'instance bottom card quand elle devient top card (pas de remount)

### MediaItem type

```ts
type MediaItem = {
  id: string;
  uri: string;
  type: "photo" | "video";
  createdAt: number;
  width?: number;
  height?: number;
  duration?: number;
};
```

Chargé depuis `expo-media-library` par batch de 40, photos + vidéos.

---

## Directions de swipe

| Direction | Action |
|---|---|
| Gauche | Corbeille (delete) |
| Droite | Garder |
| Haut | Favori |

### Haptics par action

| Action | Pattern |
|---|---|
| Delete (gauche) | `Haptics.impactAsync(Heavy)` |
| Keep (droite) | `Haptics.impactAsync(Light)` × 2, espacés de 90ms |
| Favorite (haut) | `Haptics.notificationAsync(Success)` |

---

## Clés AsyncStorage

| Clé | Contenu |
|---|---|
| `@app_trash` | IDs photos en corbeille |
| `@app_favorites` | IDs photos favorites |
| `@gallery_last_index_v2` | Dernier index de card consulté |
| `@app_dark_mode` | Mode sombre forcé |
| `@app_dark_auto` | Mode auto (suit système) |
| `@app_vibrate_swipe` | Haptics activés |
| `@app_sound` | Sons activés |
| `@app_sort_order` | Ordre de tri |
| `@app_auto_trash_days` | Jours avant purge auto corbeille |
| `@app_onboarded` | Tutoriel déjà vu |
| `@app_achievements` | Succès débloqués (Record<id, timestamp>) |

---

## Succès (Achievements)

16 succès définis dans `utils/achievements.ts` :

- **Swipes** : 1, 10, 50, 100, 200, 500, 1000, 2000, 5000 photos triées
- **Favoris** : 1er favori, 10, 50 favoris
- **Corbeille** : 1er envoi, corbeille vidée
- **Galerie** : galerie ouverte
- **Night Swipe** : trier après minuit

---

## AppLoader

Splash screen affiché pendant le chargement initial :
- Animation Lottie (`assets/animations/loader.lottie`)
- 12 tips rotatifs toutes les 3.5s (Ionicons + texte)
- Adapté light/dark

---

## Configuration Expo (app.json)

- **Bundle ID iOS** : `com.houirib.SwipeClean`
- **Package Android** : `com.houirib.SwipeClean`
- **EAS Project ID** : `68746496-800f-49b7-920a-862ba3267588`
- **OTA URL** : `https://u.expo.dev/68746496-800f-49b7-920a-862ba3267588`
- **Runtime version policy** : `appVersion`
- **Orientation** : portrait uniquement
- **UI Style** : automatic (light + dark)

---

## EAS Build

```json
{
  "development": { "developmentClient": true, "channel": "development" },
  "preview":     { "distribution": "internal", "channel": "preview" },
  "production":  { "channel": "production", "android": { "buildType": "apk" } }
}
```

---

## Lancer le projet

```bash
# Install
npm install

# Dev (Expo Go ou dev client)
npm start

# Build iOS natif
npm run ios

# Build Android natif
npm run android

# Tests
npm test

# Lint
npm run lint
```

> **Note** : `react-native-video` nécessite un build natif — indisponible dans Expo Go.
> Le code le détecte via `UIManager.hasViewManagerConfig("RCTVideo")` et se rabat sur un placeholder.

---

## Version actuelle

`1.0.14` — dernier build : `SwipeClean-15-1.0.14-beta.apk`

Dernières évolutions :
- Fix animation flicker carte suivante
- Bouton replay tutoriel dans Settings
- Écran Achievements
- Animations Lottie dans AppLoader
