// What the browser knows about itself, for bug reports (src/services/bugReports.ts).
//
// From page load it keeps, in memory only, the last few:
//   * pages visited (path + time), so a report filed from Profile still says
//     where the bug happened;
//   * console errors and warnings, uncaught errors and unhandled rejections;
//   * failed requests (status >= 400 or a network error): method, path,
//     status and the start of the error body, which for Supabase is the RPC's
//     refusal message.
// Nothing is sent anywhere until someone submits a report, and the report's
// email copy shows them all of it. Request headers are never read, and query
// strings keep their keys but lose secret-looking values.

declare const __APP_COMMIT__: string;
declare const __APP_BUILT_AT__: string;

const MAX_ROUTES = 15;
const MAX_ERRORS = 25;
const MAX_REQUESTS = 15;
const MAX_TEXT = 600;

export interface RouteEntry { path: string; at: string }
export interface ErrorEntry { level: 'error' | 'warn' | 'uncaught' | 'rejection'; message: string; at: string }
export interface RequestEntry { method: string; url: string; status: number | null; message: string; at: string }

const routes: RouteEntry[] = [];
const errors: ErrorEntry[] = [];
const requests: RequestEntry[] = [];
let installed = false;

const now = () => new Date().toISOString();
const clip = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…` : s);
function push<T>(list: T[], item: T, max: number) {
  list.push(item);
  if (list.length > max) list.splice(0, list.length - max);
}

function describe(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}${value.stack ? `\n${value.stack.split('\n').slice(1, 4).join('\n')}` : ''}`;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const SECRET_PARAM = /^(token|apikey|api_key|access_token|refresh_token|code|key|signature|sig|password)$/i;

/** Drops the origin for same-site URLs and blanks secret-looking query values. */
export function redactUrl(raw: string): string {
  try {
    const url = new URL(raw, window.location.origin);
    for (const key of [...url.searchParams.keys()]) {
      if (SECRET_PARAM.test(key)) url.searchParams.set(key, '[hidden]');
    }
    const query = url.search ? decodeURIComponent(url.search) : '';
    const base = url.origin === window.location.origin ? url.pathname : `${url.host}${url.pathname}`;
    return clip(base + query);
  } catch {
    return clip(raw);
  }
}

/** Records a page visit. Called by RouteTracker on every path change. */
export function noteRoute(path: string) {
  if (routes[routes.length - 1]?.path === path) return;
  push(routes, { path, at: now() }, MAX_ROUTES);
}

/** Starts recording. Safe to call more than once. */
export function installDiagnostics() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  for (const level of ['error', 'warn'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      push(errors, { level, message: clip(args.map(describe).join(' ')), at: now() }, MAX_ERRORS);
      original(...args);
    };
  }
  window.addEventListener('error', (e) => {
    push(errors, { level: 'uncaught', message: clip(describe(e.error ?? e.message)), at: now() }, MAX_ERRORS);
  });
  window.addEventListener('unhandledrejection', (e) => {
    push(errors, { level: 'rejection', message: clip(describe(e.reason)), at: now() }, MAX_ERRORS);
  });

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const url = redactUrl(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    try {
      const res = await originalFetch(input, init);
      if (res.status >= 400) {
        let body = '';
        try {
          body = await res.clone().text();
        } catch { /* body already used or unreadable */ }
        push(requests, { method, url, status: res.status, message: clip(body), at: now() }, MAX_REQUESTS);
      }
      return res;
    } catch (error) {
      push(requests, { method, url, status: null, message: clip(describe(error)), at: now() }, MAX_REQUESTS);
      throw error;
    }
  };
}

function resolvedTheme(): string {
  const root = document.documentElement;
  if (root.classList.contains('dark')) return 'dark';
  return 'light';
}

/** Everything the browser sends with a report, as stored in bug_reports.client. */
export function collectClientContext() {
  const nav = window.navigator;
  return {
    app: 'website',
    page: window.location.pathname,
    route_history: [...routes],
    errors: [...errors],
    failed_requests: [...requests],
    build: {
      commit: typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : '',
      built_at: typeof __APP_BUILT_AT__ === 'string' ? __APP_BUILT_AT__ : '',
      mode: import.meta.env.MODE,
    },
    device: {
      user_agent: nav.userAgent,
      language: nav.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      local_time: new Date().toString(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen: `${window.screen.width}x${window.screen.height} @${window.devicePixelRatio}x`,
      touch: nav.maxTouchPoints > 0,
      online: nav.onLine,
      theme: resolvedTheme(),
      theme_choice: safeStorage('theme') ?? 'system',
      reduced_motion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
      installed_app: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
    },
  };
}

function safeStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** For tests. */
export function resetDiagnostics() {
  routes.length = 0;
  errors.length = 0;
  requests.length = 0;
}
