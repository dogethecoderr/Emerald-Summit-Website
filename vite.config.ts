/// <reference types="vitest" />
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
