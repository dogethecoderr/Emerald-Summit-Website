/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Apps Script web app for expert/volunteer approvals (apps-script/README.md). */
  readonly VITE_APPROVALS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
