// components/FavFolderSheets.tsx — feuilles d'action des favoris (dossiers)
//
// Parti pris : les photos sont la seule couleur de l'écran, donc le chrome reste
// monochrome et l'accent ne sert qu'à une chose à la fois — l'élément actif. Pas de
// filet entre chaque ligne (c'est du chrome de liste) : la ligne active se signale par
// un fond teinté, les autres par leur seul espacement.
//
// Tous les styles de texte portent un `lineHeight` explicite : sans lui, Android rogne
// le haut et le bas des glyphes hauts dans une boîte serrée.
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  DEFAULT_FOLDER_ICON,
  FOLDER_ICONS,
  MAX_FOLDER_NAME,
  type FavFolder,
} from "../utils/favFolders";

export const ACCENT = "#1EB0AD";
export const ACCENT_SOFT = "rgba(30,176,173,0.13)";
const DANGER = "#FF453A";

type IconName = keyof typeof Ionicons.glyphMap;
type Theme = { dark: boolean };

const palette = (dark: boolean) => ({
  surface: dark ? "#1A1A1C" : "#FFFFFF",
  fill: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.045)",
  text: dark ? "#FFFFFF" : "#0d0d0d",
  muted: dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.42)",
});

/* ---------- Coquille commune ---------- */

export function Sheet({
  visible,
  dark,
  title,
  subtitle,
  onClose,
  children,
}: Theme & {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!visible) return null;
  const c = palette(dark);
  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ justifyContent: "flex-end" }}
      >
        <View style={[styles.sheet, { backgroundColor: c.surface }]}>
          <View style={styles.handle} />
          {title ? (
            <View style={styles.sheetHead}>
              <Text style={[styles.sheetTitle, { color: c.text }]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.sheetSub, { color: c.muted }]}>{subtitle}</Text>
              ) : null}
            </View>
          ) : null}
          {children}
          <View style={{ height: Platform.OS === "ios" ? 26 : 16 }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Row({
  icon,
  label,
  sub,
  dark,
  destructive,
  active,
  count,
  onPress,
}: Theme & {
  icon: IconName;
  label: string;
  sub?: string;
  destructive?: boolean;
  active?: boolean;
  count?: number;
  onPress: () => void;
}) {
  const c = palette(dark);
  const tone = destructive ? DANGER : active ? ACCENT : c.text;
  return (
    <TouchableOpacity
      style={[styles.row, active && { backgroundColor: ACCENT_SOFT }]}
      activeOpacity={0.6}
      onPress={onPress}
    >
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: destructive ? "rgba(255,69,58,0.12)" : active ? "transparent" : c.fill },
        ]}
      >
        <Ionicons name={icon} size={19} color={tone} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: tone }]} numberOfLines={1}>
          {label}
        </Text>
        {sub ? <Text style={[styles.rowSub, { color: c.muted }]}>{sub}</Text> : null}
      </View>
      {count !== undefined && (
        <Text style={[styles.rowCount, { color: active ? ACCENT : c.muted }]}>{count}</Text>
      )}
      {active && <Ionicons name="checkmark" size={19} color={ACCENT} />}
    </TouchableOpacity>
  );
}

/* ---------- Choix du dossier ---------- */

export function FolderPickSheet({
  visible,
  dark,
  folders,
  counts,
  currentId,
  count,
  onPick,
  onCreate,
  onClose,
}: Theme & {
  visible: boolean;
  folders: FavFolder[];
  counts: Record<string, number>;
  /** Dossier commun aux photos sélectionnées, `null` si aucun ou s'il diverge. */
  currentId: string | null;
  count: number;
  onPick: (folderId: string | null) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      visible={visible}
      dark={dark}
      title="Ranger dans"
      subtitle={count > 1 ? `${count} photos sélectionnées` : "1 photo sélectionnée"}
      onClose={onClose}
    >
      <ScrollView style={{ maxHeight: 316 }} showsVerticalScrollIndicator={false}>
        {folders.map((f) => (
          <Row
            key={f.id}
            dark={dark}
            icon={f.icon as IconName}
            label={f.name}
            count={counts[f.id] ?? 0}
            active={currentId === f.id}
            onPress={() => onPick(f.id)}
          />
        ))}
        <Row
          dark={dark}
          icon="remove-circle-outline"
          label="Aucun dossier"
          active={currentId === null}
          onPress={() => onPick(null)}
        />
      </ScrollView>
      <TouchableOpacity style={styles.newFolder} activeOpacity={0.7} onPress={onCreate}>
        <View style={styles.newFolderIcon}>
          <Ionicons name="add" size={20} color={ACCENT} />
        </View>
        <Text style={[styles.rowLabel, { color: ACCENT }]}>Créer un dossier</Text>
      </TouchableOpacity>
    </Sheet>
  );
}

/* ---------- Création / renommage ---------- */

export function FolderFormSheet({
  visible,
  dark,
  folder,
  onSubmit,
  onClose,
}: Theme & {
  visible: boolean;
  /** `null` = création. */
  folder: FavFolder | null;
  onSubmit: (name: string, icon: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(DEFAULT_FOLDER_ICON);
  const input = useRef<TextInput>(null);
  const c = palette(dark);

  // La feuille est montée/démontée par `visible` côté parent, mais le state local
  // survit : on le réinitialise à chaque ouverture.
  useEffect(() => {
    if (!visible) return;
    setName(folder?.name ?? "");
    setIcon(folder?.icon ?? DEFAULT_FOLDER_ICON);
    const t = setTimeout(() => input.current?.focus(), 260);
    return () => clearTimeout(t);
  }, [visible, folder]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit(trimmed, icon);
  };

  const ready = !!name.trim();

  return (
    <Sheet
      visible={visible}
      dark={dark}
      title={folder ? "Renommer" : "Nouveau dossier"}
      onClose={onClose}
    >
      <View style={styles.nameRow}>
        <View style={[styles.namePreview, { backgroundColor: ACCENT }]}>
          <Ionicons name={icon as IconName} size={22} color="#fff" />
        </View>
        <TextInput
          ref={input}
          value={name}
          onChangeText={setName}
          placeholder="Vacances, Famille, Boulot…"
          placeholderTextColor={c.muted}
          maxLength={MAX_FOLDER_NAME}
          returnKeyType="done"
          onSubmitEditing={submit}
          style={[styles.input, { backgroundColor: c.fill, color: c.text }]}
        />
      </View>

      <View style={styles.iconGrid}>
        {FOLDER_ICONS.map((name_) => {
          const on = icon === name_;
          return (
            <TouchableOpacity
              key={name_}
              onPress={() => {
                Haptics.selectionAsync();
                setIcon(name_);
              }}
              activeOpacity={0.7}
              style={[styles.iconCell, { backgroundColor: on ? ACCENT : c.fill }]}
            >
              <Ionicons name={name_ as IconName} size={21} color={on ? "#fff" : c.muted} />
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.cta, { backgroundColor: ready ? ACCENT : c.fill }]}
        activeOpacity={0.85}
        onPress={submit}
        disabled={!ready}
      >
        <Text style={[styles.ctaText, { color: ready ? "#fff" : c.muted }]}>
          {folder ? "Enregistrer" : "Créer le dossier"}
        </Text>
      </TouchableOpacity>
    </Sheet>
  );
}

/* ---------- Gestion d'un dossier (appui long sur une tuile) ---------- */

export function FolderManageSheet({
  visible,
  dark,
  folder,
  photoCount,
  onRename,
  onDelete,
  onClose,
}: Theme & {
  visible: boolean;
  folder: FavFolder | null;
  photoCount: number;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      visible={visible && !!folder}
      dark={dark}
      title={folder?.name}
      subtitle={`${photoCount} photo${photoCount > 1 ? "s" : ""}`}
      onClose={onClose}
    >
      <Row dark={dark} icon="pencil-outline" label="Renommer" onPress={onRename} />
      <Row
        dark={dark}
        icon="trash-outline"
        label="Supprimer le dossier"
        sub="Les photos restent dans tes favoris"
        destructive
        onPress={onDelete}
      />
    </Sheet>
  );
}

/* ---------- Tri ---------- */

export type SortMode = "custom" | "newest" | "oldest" | "largest";

const SORT_ROWS: { mode: SortMode; icon: IconName; label: string }[] = [
  { mode: "custom", icon: "hand-left-outline", label: "Ordre d'ajout" },
  { mode: "newest", icon: "arrow-down-outline", label: "Plus récentes d'abord" },
  { mode: "oldest", icon: "arrow-up-outline", label: "Plus anciennes d'abord" },
  { mode: "largest", icon: "expand-outline", label: "Plus grandes d'abord" },
];

export function SortSheet({
  visible,
  dark,
  mode,
  onPick,
  onClose,
}: Theme & {
  visible: boolean;
  mode: SortMode;
  onPick: (mode: SortMode) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} dark={dark} title="Trier" onClose={onClose}>
      {SORT_ROWS.map((r) => (
        <Row
          key={r.mode}
          dark={dark}
          icon={r.icon}
          label={r.label}
          active={mode === r.mode}
          onPress={() => onPick(r.mode)}
        />
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 10,
    paddingHorizontal: 14,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.3)",
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetHead: { paddingHorizontal: 8, marginBottom: 10 },
  sheetTitle: { fontSize: 21, lineHeight: 27, fontWeight: "800", letterSpacing: -0.4 },
  sheetSub: { fontSize: 13, lineHeight: 18, marginTop: 2 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 16,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 16, lineHeight: 22, fontWeight: "500" },
  rowSub: { fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  rowCount: { fontSize: 14, lineHeight: 20, fontWeight: "600" },

  newFolder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 9,
    marginTop: 4,
  },
  newFolderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8 },
  namePreview: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
  },

  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    paddingHorizontal: 8,
    marginTop: 16,
  },
  iconCell: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  cta: {
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    marginHorizontal: 8,
  },
  ctaText: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
});
