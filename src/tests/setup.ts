/**
 * Vitest Global Setup & Browser Polyfill for LocalStorage and DOM APIS
 */

class LocalStorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }

  get length() {
    return Object.keys(this.store).length;
  }

  key(index: number) {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }
}

const mockStorage = new LocalStorageMock();

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = mockStorage;
}

if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    localStorage: mockStorage,
    location: { href: 'http://localhost:3000' },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
} else if (!globalThis.window.localStorage) {
  (globalThis.window as any).localStorage = mockStorage;
}

if (typeof globalThis.navigator === 'undefined') {
  (globalThis as any).navigator = {
    userAgent: 'Node Vitest Runner',
    onLine: true,
  };
}
