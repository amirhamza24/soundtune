import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Popup build. The content script is built separately (vite.content.config.ts)
// because content scripts cannot be ES modules with shared chunks.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: { popup: 'app.html' },
    },
  },
});
