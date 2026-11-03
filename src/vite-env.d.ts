/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** Apps Script web app for expert/volunteer approvals (apps-script/README.md). */
  readonly VITE_APPROVALS_URL?: string;
  /** 'true' turns on demo (bypass) sign-in in a production build. */
  readonly VITE_ENABLE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
