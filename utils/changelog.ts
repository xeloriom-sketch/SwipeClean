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
