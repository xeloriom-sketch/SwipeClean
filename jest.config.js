/**
 * Harnais volontairement réduit à la logique pure.
 *
 * L'ancienne configuration pointait vers `@testing-library/jest-native`, qui n'est pas
 * installé: aucun test ne pouvait tourner, et il n'y en avait aucun. Plutôt que de
 * monter un rendu React Native complet — lent, fragile, et peu rentable pour ce code —
 * on teste ce qui concentre les pièges et ne dépend d'aucun rendu: normalisation des
 * URI, réducteurs des dossiers, paliers de succès, logique du tutoriel.
 *
 * `react-native` et AsyncStorage sont remplacés par des doublures (voir `__mocks__`),
 * ce qui permet d'utiliser ts-jest en environnement Node.
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  moduleNameMapper: {
    "^react-native$": "<rootDir>/__mocks__/react-native.ts",
    "^@react-native-async-storage/async-storage$":
      "<rootDir>/__mocks__/async-storage.ts",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react", esModuleInterop: true } }],
  },
};
