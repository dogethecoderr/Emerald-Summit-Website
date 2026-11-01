/**
 * Demo (bypass) sign-in is for development and testing only. It is on under
 * `npm run dev` and off in production builds (Vercel runs `vite build`, where
 * DEV is false), unless the deploy sets VITE_ENABLE_DEMO_MODE=true — e.g. on
 * a Preview environment only.
 */
export const isDemoModeEnabled: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_MODE === 'true';
