// utils/coach.ts — logique du tutoriel guidé du premier lancement
//
// Le tutoriel se joue sur le vrai écran de tri, avec les vraies photos de la personne:
// l'ancien écran séparé enseignait un autre langage visuel que l'app (overlay teinté
// avec le mot écrit contre un simple cercle à icône, quatre couleurs différentes sur
// quatre, carte d'une autre taille, thème toujours sombre) et personne ne faisait le
// lien entre les deux. Ici il n'y a rien à transposer puisqu'il n'y a pas de second
// écran.
//
// La logique vit à part de l'affichage pour être testable sans rendu.

export type CoachDirection = "left" | "right" | "top" | "bottom";

export type CoachStep = {
  /** Geste attendu à cette étape. */
  dir: CoachDirection;
  /** Le geste, en gros: c'est ce qu'il faut faire, pas ce que l'app sait faire. */
  gesture: string;
  /** La conséquence, en dessous. Court: on est posé sur une photo, pas sur une page. */
  detail: string;
  /** Confirmation, une fois le geste réussi. */
  done: string;
};

export const COACH_STEPS: CoachStep[] = [
  {
    dir: "left",
    gesture: "Glisse à gauche",
    detail: "pour jeter. Elle part à la corbeille : tu pourras la récupérer.",
    done: "À la corbeille. Récupérable à tout moment.",
  },
  {
    dir: "right",
    gesture: "Glisse à droite",
    detail: "pour garder. Elle reste dans ta galerie et ne te sera plus proposée.",
    done: "Gardée.",
  },
  {
    dir: "top",
    gesture: "Glisse vers le haut",
    detail: "pour mettre en favori. Les boutons en bas font la même chose, sans les mains.",
    done: "En favori. À toi de jouer.",
  },
];

/** Au-delà, on avance quoi qu'il arrive: un tutoriel ne doit jamais retenir quelqu'un. */
export const MAX_ATTEMPTS_PER_STEP = 3;

export type CoachState = {
  /** Index dans COACH_STEPS, ou `null` quand le tutoriel est terminé. */
  step: number | null;
  /** Gestes effectués sur l'étape courante, bons ou mauvais. */
  attempts: number;
};

export const INITIAL_COACH: CoachState = { step: 0, attempts: 0 };

/**
 * Fait avancer le tutoriel après un swipe réellement validé.
 *
 * On avance sur le bon geste, et aussi après `MAX_ATTEMPTS_PER_STEP` essais: quelqu'un
 * qui glisse systématiquement dans une autre direction a de toute évidence compris le
 * principe, et le bloquer sur sa propre photo serait le pire des accueils.
 */
export function advanceCoach(state: CoachState, direction: CoachDirection): CoachState {
  if (state.step === null) return state;

  const current = COACH_STEPS[state.step];
  if (!current) return { step: null, attempts: 0 };

  const attempts = state.attempts + 1;
  const satisfied = direction === current.dir || attempts >= MAX_ATTEMPTS_PER_STEP;
  if (!satisfied) return { step: state.step, attempts };

  const next = state.step + 1;
  return next >= COACH_STEPS.length ? { step: null, attempts: 0 } : { step: next, attempts: 0 };
}

/** Vrai quand le geste attendu vient d'être fait (pour la confirmation et l'haptique). */
export function isExpected(state: CoachState, direction: CoachDirection): boolean {
  if (state.step === null) return false;
  return COACH_STEPS[state.step]?.dir === direction;
}
