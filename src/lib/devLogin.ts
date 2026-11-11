/**
 * Password-gated test accounts, through the shared `dev-login` Edge Function
 * (see "Test accounts" in README.md). This is the on/off switch, set here in
 * code so no Vercel setting is needed. It's on for every build, the live site
 * included (decided Nov 2026): the site isn't marketed widely yet, and every
 * test account still needs the shared password. Set it to false and push to
 * turn the password box off.
 *
 * The function itself also has to be turned on, and it checks the password,
 * so this switch only decides whether the website asks.
 */
export const isDevLoginEnabled: boolean = true;
