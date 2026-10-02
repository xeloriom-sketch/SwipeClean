// components/FavFolderSheets.tsx — feuilles d'action des favoris (dossiers, partage)
//
// Même grammaire visuelle que la feuille de tri déjà présente dans Favoris :
// Modal translucide + glissement natif, poignée, lignes séparées par un hairline.
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
  FOLDER_EMOJIS,
  MAX_FOLDER_NAME,
  type FavFolder,
} from "../utils/favFolders";

export const ACCENT = "#1EB0AD";

type Theme = { dark: boolean };

/* ---------- Coquille commune ---------- */

export function Sheet({
  visible,
  dark,
  title,
  onClose,
  children,
}: Theme & {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!visible) return null;
  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ justifyContent: "flex-end" }}
      >
        <View style={[styles.sheet, { backgroundColor: dark ? "#1c1c1e" : "#fff" }]}>
          <View style={styles.handle} />
          {title ? (
            <Text style={[styles.title, { color: dark ? "#fff" : "#000" }]}>{title}</Text>
          ) : null}
          {children}
          <View style={{ height: Platform.OS === "ios" ? 28 : 18 }} />
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
  trailing,
  onPress,
}: Theme & {
  icon: keyof typeof Ionicons.glyphMap | null;
  label: string;
  sub?: string;
  destructive?: boolean;
  active?: boolean;
  trailing?: React.ReactNode;
  onPress: () => void;
}) {
  const color = destructive ? "#FF3B30" : active ? ACCENT : dark ? "#fff" : "#000";
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.6} onPress={onPress}>
      {icon ? (
        <Ionicons name={icon} size={21} color={color} style={{ width: 28 }} />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color }]} numberOfLines={1}>
          {label}
        </Text>
        {sub ? (
          <Text style={[styles.rowSub, { color: dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }]}>
            {sub}
          </Text>
        ) : null}
      </View>
      {trailing}
    </TouchableOpacity>
  );
}

/* ---------- Actions sur une photo ---------- */

export function ItemActionSheet({
  visible,
  dark,
  canShare,
  currentFolder,
  onShare,
  onMove,
  onRemove,
  onClose,
}: Theme & {
  visible: boolean;
  canShare: boolean;
  currentFolder: FavFolder | null;
  onShare: () => void;
  onMove: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} dark={dark} onClose={onClose}>
      {canShare && (
        <Row
          dark={dark}
          icon="share-social-outline"
          label="Partager"
          sub="Envoyer la photo à une autre app"
          onPress={onShare}
        />
      )}
      <Row
        dark={dark}
        icon="folder-outline"
        label="Déplacer vers un dossier"
        sub={currentFolder ? `Actuellement : ${currentFolder.emoji} ${currentFolder.name}` : "Sans dossier"}
        onPress={onMove}
      />
      <Row
        dark={dark}
        icon="heart-dislike-outline"
        label="Retirer des favoris"
        destructive
        onPress={onRemove}
      />
    </Sheet>
  );
}

/* ---------- Choix du dossier ---------- */

export function FolderPickSheet({
  visible,
  dark,
  folders,
  currentId,
  count,
  onPick,
  onCreate,
  onClose,
}: Theme & {
  visible: boolean;
  folders: FavFolder[];
  currentId: string | null;
  /** Nombre de photos concernées (1 ou sélection multiple). */
  count: number;
  onPick: (folderId: string | null) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      visible={visible}
      dark={dark}
      title={count > 1 ? `Déplacer ${count} photos` : "Déplacer la photo"}
      onClose={onClose}
    >
      <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
        <Row
          dark={dark}
          icon="remove-circle-outline"
          label="Sans dossier"
          active={currentId === null}
          trailing={currentId === null ? <Ionicons name="checkmark" size={20} color={ACCENT} /> : undefined}
          onPress={() => onPick(null)}
        />
        {folders.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={styles.row}
            activeOpacity={0.6}
            onPress={() => onPick(f.id)}
          >
            <Text style={{ fontSize: 19, width: 28 }}>{f.emoji}</Text>
            <Text
              style={[
                styles.rowLabel,
                { flex: 1, color: currentId === f.id ? ACCENT : dark ? "#fff" : "#000" },
              ]}
              numberOfLines={1}
            >
              {f.name}
            </Text>
            {currentId === f.id && <Ionicons name="checkmark" size={20} color={ACCENT} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Row dark={dark} icon="add-circle-outline" label="Nouveau dossier" active onPress={onCreate} />
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
  onSubmit: (name: string, emoji: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(FOLDER_EMOJIS[0]);
  const input = useRef<TextInput>(null);

  // La feuille est montée/démontée par `visible` côté parent, mais le state local
  // survit : on le réinitialise à chaque ouverture.
  useEffect(() => {
    if (!visible) return;
    setName(folder?.name ?? "");
    setEmoji(folder?.emoji ?? FOLDER_EMOJIS[0]);
    const t = setTimeout(() => input.current?.focus(), 280);
    return () => clearTimeout(t);
  }, [visible, folder]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit(trimmed, emoji);
  };

  const fieldBg = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";

  return (
    <Sheet
      visible={visible}
      dark={dark}
      title={folder ? "Renommer le dossier" : "Nouveau dossier"}
      onClose={onClose}
    >
      <View style={styles.emojiGrid}>
        {FOLDER_EMOJIS.map((e) => (
          <TouchableOpacity
            key={e}
            onPress={() => {
              Haptics.selectionAsync();
              setEmoji(e);
            }}
            activeOpacity={0.7}
            style={[
              styles.emojiCell,
              { backgroundColor: fieldBg },
              emoji === e && { backgroundColor: ACCENT },
            ]}
          >
            <Text style={{ fontSize: 20 }}>{e}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        ref={input}
        value={name}
        onChangeText={setName}
        placeholder="Nom du dossier"
        placeholderTextColor={dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.28)"}
        maxLength={MAX_FOLDER_NAME}
        returnKeyType="done"
        onSubmitEditing={submit}
        style={[styles.input, { backgroundColor: fieldBg, color: dark ? "#fff" : "#000" }]}
      />

      <TouchableOpacity
        style={[styles.cta, { backgroundColor: name.trim() ? ACCENT : fieldBg }]}
        activeOpacity={0.85}
        onPress={submit}
        disabled={!name.trim()}
      >
        <Text
          style={[
            styles.ctaText,
            { color: name.trim() ? "#fff" : dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)" },
          ]}
        >
          {folder ? "Enregistrer" : "Créer le dossier"}
        </Text>
      </TouchableOpacity>
    </Sheet>
  );
}

/* ---------- Gestion d'un dossier (appui long sur une puce) ---------- */

export function FolderManageSheet({
  visible,
  dark,
  folder,
  onRename,
  onDelete,
  onClose,
}: Theme & {
  visible: boolean;
  folder: FavFolder | null;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      visible={visible && !!folder}
      dark={dark}
      title={folder ? `${folder.emoji}  ${folder.name}` : undefined}
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

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.35)",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: "700", marginBottom: 8 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  rowLabel: { fontSize: 16 },
  rowSub: { fontSize: 12, marginTop: 2 },

  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
    marginBottom: 14,
  },
  emojiCell: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  cta: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  ctaText: { fontSize: 16, fontWeight: "700" },
});
