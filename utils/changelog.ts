// utils/changelog.ts
// Ajouter une nouvelle entrée en tête de tableau à chaque version

export type ChangelogFeature = {
  icon: string;
  color: string;
  title: string;
  description: string;
};

export type ChangelogEntry = {
  version: string;
  tagline: string;
  features: ChangelogFeature[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.0.20",
    tagline: "Tes favoris, enfin rangés.",
    features: [
      {
        icon: "folder-outline",
        color: "#1EB0AD",
        title: "Dossiers de favoris",
        description: "Crée autant de dossiers que tu veux, avec un nom et une icône — Vacances, Famille, Boulot…",
      },
      {
        icon: "hand-left-outline",
        color: "#AF52DE",
        title: "Ranger en un appui long",
        description: "Appui long sur une photo, « Déplacer vers un dossier », et c'est rangé. Un appui long sur un dossier pour le renommer ou le supprimer.",
      },
      {
        icon: "funnel-outline",
        color: "#FF9500",
        title: "Filtrer et exporter par dossier",
        description: "Un tap sur un dossier n'affiche que ses photos, et l'export crée un album dédié dans ta photothèque.",
      },
    ],
  },
  {
    version: "1.0.18",
    tagline: "Une grande mise à jour t'attend !",
    features: [
      {
        icon: "copy-outline",
        color: "#FF9500",
        title: "Détection de doublons",
        description: "Scanne ta photothèque, regroupe les photos identiques et libère de l'espace en un tap.",
      },
      {
        icon: "grid-outline",
        color: "#AF52DE",
        title: "Favoris façon Pinterest",
        description: "Les favoris s'affichent dans leur format d'origine — portrait, paysage, carré — avec un layout masonry.",
      },
      {
        icon: "swap-vertical-outline",
        color: "#007AFF",
        title: "Tri des favoris",
        description: "Trie tes favoris par date (récent/ancien) ou par taille depuis le bouton ↕ dans les favoris.",
      },
      {
        icon: "sparkles-outline",
        color: "#34C759",
        title: "Popups animées",
        description: "Les confirmations et alertes sont maintenant intégrées à l'app — plus jolies, plus cohérentes.",
      },
    ],
  },
];
