import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Read the monorepo-root .env (same file the backend reads via
  // config.ts) instead of frontend/.env, which doesn't exist — only
  // VITE_-prefixed keys are ever exposed to the client bundle.
  envDir: '../',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
