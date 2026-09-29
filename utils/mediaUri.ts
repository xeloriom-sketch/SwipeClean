// utils/mediaUri.ts — normalisation des URI de médias (Android)
//
// Sur Android, expo-media-library construit l'URI d'un asset par simple
// concaténation `"file://" + MediaStore.DATA` (AssetUtils.kt). Deux conséquences :
//   1. le chemin n'est jamais encodé — un espace, un `#` ou un `%` dans le nom de
//      fichier casse `Uri.parse()` côté ExoPlayer (FileNotFoundException silencieuse),
//      alors que Glide (expo-image) tolère ;
//   2. quand `DATA` est absent (médias cloud / pending / accès partiel Android 14+),
//      la chaîne vaut littéralement `"file://null"`, qui est *truthy*.
//
// Sur iOS les URI sont des `ph://` opaques : aucune transformation.
import { Platform } from "react-native";

export type MediaKind = "photo" | "video";

export const isUnusableUri = (uri?: string | null): boolean =>
  !uri || uri === "file://null" || uri.endsWith("//null");

/** URI MediaStore, lisible même quand l'app n'a qu'un accès partiel à la galerie. */
const mediaStoreUri = (id: string, type: MediaKind) =>
  `content://media/external/${type === "video" ? "video" : "images"}/media/${id}`;

export function normalizeMediaUri(uri: string, id: string, type: MediaKind): string {
  if (Platform.OS !== "android") return uri;
  if (isUnusableUri(uri)) return mediaStoreUri(id, type);
  if (uri.startsWith("file://")) {
    try {
      const path = uri.slice("file://".length);
      if (/%[0-9A-Fa-f]{2}/.test(path)) return uri; // déjà encodé
      return "file://" + path.split("/").map(encodeURIComponent).join("/");
    } catch {
      return uri;
    }
  }
  return uri;
}

/**
 * URI prête à être passée à expo-image / react-native-video, ou `null` si le
 * média est définitivement inexploitable.
 */
export function resolveMediaUri(
  uri: string | null | undefined,
  id: string,
  type: MediaKind
): string | null {
  if (!isUnusableUri(uri)) return normalizeMediaUri(uri as string, id, type);
  return Platform.OS === "android" ? mediaStoreUri(id, type) : null;
}
