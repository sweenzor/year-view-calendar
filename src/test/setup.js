import '@testing-library/jest-dom/vitest';

const createTestStorage = () => {
  const store = new Map();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.get(String(key)) ?? null;
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key) {
      store.delete(String(key));
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
  };
};

const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const needsLocalStoragePolyfill = !localStorageDescriptor
  || typeof localStorageDescriptor.value?.clear !== 'function';

if (needsLocalStoragePolyfill) {
  const localStorage = createTestStorage();

  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorage,
    configurable: true,
  });

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: localStorage,
      configurable: true,
    });
  }
}
