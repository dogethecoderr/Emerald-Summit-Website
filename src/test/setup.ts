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
