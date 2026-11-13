import '@testing-library/jest-dom';

if (!process.env.VITE_SUPABASE_URL) {
  process.env.VITE_SUPABASE_URL = 'https://mock-emerald-summit.supabase.co';
}
if (!process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_mock-key';
}

if (typeof import.meta !== 'undefined' && import.meta.env) {
  if (!import.meta.env.VITE_SUPABASE_URL) {
    (import.meta.env as Record<string, string>).VITE_SUPABASE_URL = 'https://mock-emerald-summit.supabase.co';
  }
  if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    (import.meta.env as Record<string, string>).VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_mock-key';
  }
}

/**
 * Node 26 puts its own `localStorage` / `sessionStorage` on the global object,
 * and without `--localstorage-file` they are undefined, which hides the ones
 * jsdom would provide. Wherever a working Storage is missing, give the tests a
 * small in-memory one with the same methods.
 */
class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() { return this.items.size; }
  clear() { this.items.clear(); }
  getItem(key: string) { return this.items.has(key) ? this.items.get(key)! : null; }
  key(index: number) { return [...this.items.keys()][index] ?? null; }
  removeItem(key: string) { this.items.delete(key); }
  setItem(key: string, value: string) { this.items.set(key, String(value)); }
}

function usable(name: 'localStorage' | 'sessionStorage') {
  try {
    const s = (globalThis as Record<string, unknown>)[name] as Storage | undefined;
    return !!s && typeof s.getItem === 'function' && typeof s.clear === 'function';
  } catch {
    return false;
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (usable(name)) continue;
  const store = new MemoryStorage();
  Object.defineProperty(globalThis, name, { value: store, configurable: true, writable: true });
  if (typeof window !== 'undefined' && window !== globalThis) {
    Object.defineProperty(window, name, { value: store, configurable: true, writable: true });
  }
}
