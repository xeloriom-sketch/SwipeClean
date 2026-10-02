// utils/favFolders.ts — dossiers de favoris
//
// Une photo appartient à zéro ou un dossier : l'état tient dans une seule clé
// AsyncStorage (`folders` + la table `assign` itemId -> folderId), donc une seule
// écriture par opération et aucun risque de désynchronisation entre deux clés.
// `@app_favorites` reste la source de vérité de ce qui est favori ; `assign` ne fait
// que ranger. Les ids orphelins sont purgés au chargement (`pruneAssignments`).
import AsyncStorage from "@react-native-async-storage/async-storage";

export const FAV_FOLDERS_KEY = "@app_fav_folders";

export type FavFolder = {
  id: string;
  name: string;
  /** Nom d'icône Ionicons. */
  icon: string;
  createdAt: number;
};

export type FavFoldersState = {
  folders: FavFolder[];
  /** itemId -> folderId */
  assign: Record<string, string>;
};

export const EMPTY_FOLDERS: FavFoldersState = { folders: [], assign: {} };

export const FOLDER_ICONS = [
  "folder-outline",
  "airplane-outline",
  "heart-outline",
  "people-outline",
  "home-outline",
  "restaurant-outline",
  "briefcase-outline",
  "paw-outline",
  "camera-outline",
  "musical-notes-outline",
  "football-outline",
  "leaf-outline",
];

export const DEFAULT_FOLDER_ICON = FOLDER_ICONS[0];

/** Dossiers créés avant le passage aux icônes : on retrouve l'intention de l'emoji. */
const LEGACY_EMOJI_ICONS: Record<string, string> = {
  "📁": "folder-outline",
  "⭐️": "star-outline",
  "❤️": "heart-outline",
  "🌴": "airplane-outline",
  "🏔️": "leaf-outline",
  "🐾": "paw-outline",
  "🍔": "restaurant-outline",
  "🎉": "sparkles-outline",
  "👨‍👩‍👧": "people-outline",
  "💼": "briefcase-outline",
  "🎨": "color-palette-outline",
  "🚗": "car-sport-outline",
};

export const MAX_FOLDERS = 30;
export const MAX_FOLDER_NAME = 24;

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- Persistance ---------- */

export async function loadFavFolders(): Promise<FavFoldersState> {
  try {
    const raw = await AsyncStorage.getItem(FAV_FOLDERS_KEY);
    if (!raw) return EMPTY_FOLDERS;
    const parsed = JSON.parse(raw);
    const folders: FavFolder[] = Array.isArray(parsed?.folders)
      ? parsed.folders
          .filter((f: any) => f && typeof f.id === "string" && typeof f.name === "string")
          .map((f: any) => ({
            id: f.id,
            name: f.name,
            icon:
              typeof f.icon === "string"
                ? f.icon
                : LEGACY_EMOJI_ICONS[f.emoji] ?? DEFAULT_FOLDER_ICON,
            createdAt: typeof f.createdAt === "number" ? f.createdAt : Date.now(),
          }))
      : [];
    const assign: Record<string, string> =
      parsed?.assign && typeof parsed.assign === "object" ? parsed.assign : {};
    return { folders, assign };
  } catch {
    return EMPTY_FOLDERS;
  }
}

export function saveFavFolders(state: FavFoldersState): void {
  AsyncStorage.setItem(FAV_FOLDERS_KEY, JSON.stringify(state)).catch(() => {});
}

/* ---------- Opérations (pures) ---------- */

export function createFolder(
  state: FavFoldersState,
  name: string,
  icon: string
): FavFoldersState {
  const folder: FavFolder = {
    id: newId(),
    name: name.trim().slice(0, MAX_FOLDER_NAME) || "Dossier",
    icon: icon || DEFAULT_FOLDER_ICON,
    createdAt: Date.now(),
  };
  return { ...state, folders: [...state.folders, folder] };
}

export function renameFolder(
  state: FavFoldersState,
  id: string,
  name: string,
  icon: string
): FavFoldersState {
  return {
    ...state,
    folders: state.folders.map((f) =>
      f.id === id
        ? {
            ...f,
            name: name.trim().slice(0, MAX_FOLDER_NAME) || f.name,
            icon: icon || f.icon,
          }
        : f
    ),
  };
}

/** Supprime le dossier — les photos restent en favoris, elles redeviennent non rangées. */
export function deleteFolder(state: FavFoldersState, id: string): FavFoldersState {
  const assign: Record<string, string> = {};
  for (const [itemId, folderId] of Object.entries(state.assign)) {
    if (folderId !== id) assign[itemId] = folderId;
  }
  return { folders: state.folders.filter((f) => f.id !== id), assign };
}

/** `folderId === null` sort les photos de tout dossier. */
export function moveItems(
  state: FavFoldersState,
  itemIds: string[],
  folderId: string | null
): FavFoldersState {
  const assign = { ...state.assign };
  for (const itemId of itemIds) {
    if (folderId === null) delete assign[itemId];
    else assign[itemId] = folderId;
  }
  return { ...state, assign };
}

/** Retire les affectations dont la photo n'est plus favorite. */
export function pruneAssignments(
  state: FavFoldersState,
  favoriteIds: string[]
): FavFoldersState {
  const alive = new Set(favoriteIds);
  const known = new Set(state.folders.map((f) => f.id));
  const assign: Record<string, string> = {};
  let changed = false;
  for (const [itemId, folderId] of Object.entries(state.assign)) {
    if (alive.has(itemId) && known.has(folderId)) assign[itemId] = folderId;
    else changed = true;
  }
  return changed ? { ...state, assign } : state;
}

/* ---------- Lecture ---------- */

export function countByFolder(
  state: FavFoldersState,
  favoriteIds: string[]
): { byFolder: Record<string, number>; unfiled: number } {
  const byFolder: Record<string, number> = {};
  let unfiled = 0;
  for (const id of favoriteIds) {
    const folderId = state.assign[id];
    if (folderId) byFolder[folderId] = (byFolder[folderId] ?? 0) + 1;
    else unfiled++;
  }
  return { byFolder, unfiled };
}
