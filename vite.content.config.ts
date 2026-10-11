import { defineConfig } from 'vite';

// Content script: single self-contained IIFE, appended to the popup build output.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2022',
    lib: {
      entry: 'src/content/index.ts',
      name: 'VioletAudioContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});
