import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During `vite dev`, proxy /api to the local Express server (run `npm start` in
// another terminal). In production the same Express server serves the built
// assets and /api from one origin, so no proxy is needed.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
});
