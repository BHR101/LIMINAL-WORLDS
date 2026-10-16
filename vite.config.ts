import { defineConfig } from 'vite';

// A relative base makes the build work at any sub-path, including
// GitHub Pages project sites (https://<user>.github.io/liminal-worlds/).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
