/**
 * Password-gated test accounts, through the shared `dev-login` Edge Function
 * (see "Test accounts on the website" in the app repo's README). Off unless
 * the build sets VITE_DEV_LOGIN=true. Set it on local and Preview only, never
 * on Production. The function itself also has to be turned on, and it checks
 * the password, so this flag only decides whether the website asks.
 */
export const isDevLoginEnabled: boolean = import.meta.env.VITE_DEV_LOGIN === 'true';
