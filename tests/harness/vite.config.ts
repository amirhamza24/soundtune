import { defineConfig } from 'vite';
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'tests/harness/out', emptyOutDir: true,
    lib: { entry: 'tests/harness/entry.ts', name: 'VioletTest', formats: ['iife'], fileName: () => 'harness.js' },
  },
});
