/// <reference types="vitest" />
import { execSync } from 'child_process';
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Which code a bug report came from (src/lib/diagnostics.ts). Vercel sets
// VERCEL_GIT_COMMIT_SHA at build time; locally, ask git.
function commit(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12);
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_COMMIT__: JSON.stringify(commit()),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  server: {
    // 5173 by default, but honour PORT so a second dev server (another
    // session, another checkout) can run alongside instead of colliding.
    port: Number(process.env.PORT) || 5173,
    // Design-tool output (Hallmark's screenshots and compare.html, agent
    // skills) is not part of the app; an .html file changing there would
    // otherwise make Vite reload every open page.
    watch: { ignored: ['**/.hallmark/**', '**/.agents/**'] },
  },
});
