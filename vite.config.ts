import { defineConfig } from 'vite';

export default defineConfig({
  // three.js is most of the bundle; one chunk is fine for a single-page app.
  build: { chunkSizeWarningLimit: 900 },
});
