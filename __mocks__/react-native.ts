// Doublure minimale de react-native pour tester la logique pure en Node.
// `Platform.OS` est pilotable depuis les tests: la normalisation des URI se comporte
// différemment sur Android et iOS, et c'est précisément ce qu'on veut couvrir.
export const Platform = {
  OS: "android" as "android" | "ios" | "web",
  select: (obj: Record<string, unknown>) => obj[Platform.OS] ?? obj.default,
};

export const AppState = {
  currentState: "active",
  addEventListener: () => ({ remove: () => {} }),
};
