/**
 * Pre-renders the site's public routes to static HTML after `vite build`, so
 * crawlers and link-unfurlers that don't execute JavaScript see real content
 * instead of the bare `<div id="root">` shell (see README "SEO" notes).
 *
 * Runs a headless Chromium (Playwright, already a devDependency) against the
 * built `dist/` output via Vite's own preview server, with
 * `prefers-reduced-motion: reduce` emulated so the landing page's ~6-8s
 * hyperspace intro is skipped (src/components/introSession.ts) and content
 * renders immediately. The original `<script type="module" src="/assets/...">`
 * tag is left in the output, so the SPA still hydrates and takes over exactly
 * as before once the client bundle loads.
 *
 * `/` is written back to dist/index.html (the file Vercel already serves at
 * the root). `/lineup` and `/roles` are written to sibling `.html` files
 * (dist/lineup.html, dist/roles.html) because the SPA catch-all rewrite in
 * vercel.json would otherwise serve dist/index.html for every path; see the
 * explicit rewrites added there for those two routes.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

const ROUTES = [
  { path: '/', out: 'index.html', wait: 'text=Get started' },
  { path: '/lineup', out: 'lineup.html', wait: '#sponsors-title' },
  { path: '/roles', out: 'roles.html', wait: 'text=Attending the Summit' },
];

async function main() {
  const server = await preview({ preview: { port: 4322, strictPort: true } });
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');

  const browser = await chromium.launch();
  const context = await browser.newContext({ reducedMotion: 'reduce' });

  for (const route of ROUTES) {
    const page = await context.newPage();
    await page.goto(`${base}${route.path}`, { waitUntil: 'networkidle' });
    try {
      await page.waitForSelector(route.wait, { timeout: 5000 });
    } catch {
      console.warn(`  [prerender] "${route.wait}" not found on ${route.path} — writing what rendered anyway`);
    }
    // HairlineFigure (src/landing/HairlineFigure.tsx) injects its kernel/figure
    // <script> tags at runtime via its own load-order bookkeeping (a global
    // `window.hairline` resolver set right before each script loads). Baking
    // those tags into static HTML as literal <script> elements breaks that
    // bookkeeping on a fresh page load ("hairline is not defined") — strip
    // them so only the real hydration bundle script remains; the component's
    // own effect re-adds them correctly once React mounts.
    await page.evaluate(() => {
      document.querySelectorAll('script[src^="/hairline/"]').forEach((el) => el.remove());
    });
    const html = await page.content();
    const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length;
    console.log(`  prerendered ${route.path} -> dist/${route.out} (${words} words)`);
    const outPath = path.resolve('dist', route.out);
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, `<!doctype html>\n${html}`);
    await page.close();
  }

  await context.close();
  await browser.close();
  await server.httpServer.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
