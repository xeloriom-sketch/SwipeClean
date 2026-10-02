// utils/shareMedia.ts — partage d'un média via la feuille de partage système
//
// `expo-sharing` est un module natif : sur un binaire compilé avant son ajout — ce qui
// est le cas de tout ce qui tourne déjà, une mise à jour OTA n'embarquant aucun code
// natif — `requireNativeModule('ExpoSharing')` lève dès l'import. D'où le require
// protégé et `isShareSupported()`, que l'UI interroge avant d'afficher le bouton :
// la fonction s'allumera d'elle-même au prochain build natif, sans toucher au code.
//
// Android : `SharingModule.shareAsync` n'accepte qu'une URL `file://` et vérifie
// l'autorisation de lecture via expo-file-system, qui ne l'accorde que dans les
// dossiers de l'app. Un chemin DCIM est donc refusé — on copie d'abord le média dans
// le cache, couvert par le `cache-path` du FileProvider d'expo-sharing.
import * as MediaLibrary from "expo-media-library";
import { isUnusableUri, normalizeMediaUri } from "./mediaUri";

type SharingModule = {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (url: string, options?: Record<string, unknown>) => Promise<void>;
};

let Sharing: SharingModule | null = null;
try {
  const mod = require("expo-sharing");
  if (mod && typeof mod.shareAsync === "function") Sharing = mod as SharingModule;
} catch {}

let supported: boolean | null = null;

/** `false` sur un binaire sans expo-sharing : l'appelant masque alors le bouton. */
export async function isShareSupported(): Promise<boolean> {
  if (supported !== null) return supported;
  if (!Sharing) {
    supported = false;
    return false;
  }
  try {
    supported = await Sharing.isAvailableAsync();
  } catch {
    supported = false;
  }
  return supported;
}

export type ShareResult = "ok" | "unavailable" | "error";

const SHARE_DIR = "swipeclean-share";

/** Nom de fichier sûr, extension préservée (Android en déduit le mimeType). */
function safeName(name: string, fallbackExt: string): string {
  const cleaned = name.replace(/[^\w.-]+/g, "_").replace(/^_+/, "");
  if (/\.[A-Za-z0-9]{2,5}$/.test(cleaned)) return cleaned;
  return (cleaned || "media") + fallbackExt;
}

function cacheCopy(srcUri: string, filename: string): string {
  // Require paresseux: le module natif de expo-file-system n'est sollicité que sur le
  // chemin de partage, jamais au simple montage de l'écran Favoris.
  const { Directory, File, Paths } = require("expo-file-system");
  const dir = new Directory(Paths.cache, SHARE_DIR);
  // La copie précédente doit survivre au partage (l'app receveuse lit après coup),
  // on la nettoie donc au partage suivant plutôt qu'immédiatement.
  try {
    if (dir.exists) dir.delete();
  } catch {}
  dir.create({ intermediates: true });
  const dest = new File(dir, filename);
  new File(srcUri).copy(dest);
  return dest.uri;
}

/**
 * Ouvre la feuille de partage pour un asset de la photothèque.
 * Ne lève jamais : l'appelant affiche un message selon le code retourné.
 */
export async function shareMedia(
  id: string,
  type: "photo" | "video" = "photo",
  fallbackUri?: string
): Promise<ShareResult> {
  if (!(await isShareSupported()) || !Sharing) return "unavailable";

  try {
    let src: string | undefined = fallbackUri;
    let filename = "";
    try {
      const info = await MediaLibrary.getAssetInfoAsync(id);
      if (!isUnusableUri(info.localUri)) src = info.localUri as string;
      else if (!isUnusableUri(info.uri)) src = info.uri;
      filename = info.filename ?? "";
    } catch {}

    // Un `content://` (média cloud ou accès partiel Android 14+) n'est pas copiable
    // par l'API fichier : impossible de le passer au FileProvider.
    if (!src || !src.startsWith("file://")) return "error";
    // expo-media-library ne percent-encode pas ses chemins Android : un espace dans le
    // nom de fichier casse le `Uri.parse` que fait expo-file-system.
    src = normalizeMediaUri(src, id, type);

    if (!filename) {
      try {
        filename = decodeURIComponent(src.split("/").pop() ?? "");
      } catch {
        filename = src.split("/").pop() ?? "";
      }
    }

    const uri = cacheCopy(src, safeName(filename, type === "video" ? ".mp4" : ".jpg"));
    await Sharing.shareAsync(uri, {
      dialogTitle: "Partager",
      UTI: type === "video" ? "public.movie" : "public.image",
    });
    return "ok";
  } catch {
    return "error";
  }
}
