// AsyncStorage en mémoire. Le vrai module est natif; ici on veut seulement vérifier
// que la logique lit et écrit ce qu'elle prétend.
const store = new Map<string, string>();

const AsyncStorage = {
  getItem: async (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: async (k: string, v: string) => {
    store.set(k, v);
  },
  removeItem: async (k: string) => {
    store.delete(k);
  },
  multiGet: async (keys: string[]) => keys.map((k) => [k, store.get(k) ?? null]),
  clear: async () => store.clear(),
  __store: store,
};

export default AsyncStorage;
