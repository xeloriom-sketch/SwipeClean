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
    version: "1.0.22",
    tagline: "On apprend en triant, pas avant.",
    features: [
      {
        icon: "hand-left-outline",
        color: "#1EB0AD",
        title: "Un tutoriel sur tes vraies photos",
        description:
          "Fini l'écran d'explications à part : le tutoriel se joue directement sur l'écran de tri, avec ta galerie. Trois gestes, vingt secondes, et tu es déjà en train de trier.",
      },
      {
        icon: "shield-checkmark-outline",
        color: "#30D158",
        title: "Tes photos ne bougent plus toutes seules",
        description:
          "Une suppression refusée n'est plus comptée comme faite, la corbeille vidée ne se repeuple plus, et une photo ne peut plus atterrir à la fois dans la corbeille et dans les favoris.",
      },
      {
        icon: "stats-chart-outline",
        color: "#FF9500",
        title: "Des statistiques enfin justes",
        description:
          "L'espace libéré est compté au moment où les fichiers disparaissent vraiment — et le ménage des doublons y est enfin inclus.",
      },
      {
        icon: "medkit-outline",
        color: "#AF52DE",
        title: "Un filet en cas de pépin",
        description:
          "Si l'app rencontre une erreur, tu vois un écran de récupération au lieu d'un écran blanc, avec un bouton pour nous envoyer le rapport.",
      },
    ],
  },
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
        icon: "checkmark-done-outline",
        color: "#AF52DE",
        title: "Sélection multiple",
        description: "Appui long pour démarrer la sélection, tape les photos à ajouter, puis « Déplacer » — ou « Tout » pour prendre le dossier entier d'un coup.",
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
