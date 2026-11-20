// AsyncStorage in memory. Tests can fill it before loading something and clear it after.
const store = new Map<string, string>();

const AsyncStorage = {
  getItem: async (k: string) => store.get(k) ?? null,
  setItem: async (k: string, v: string) => void store.set(k, v),
  removeItem: async (k: string) => void store.delete(k),
  clear: async () => store.clear(),
  getAllKeys: async () => [...store.keys()],
};

export default AsyncStorage;
