import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During `npm run dev`, forward /api/* to the local Node server
// (run separately with `npm run server`). In production both are
// served by the same Node process on Cloud Run.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
