import { cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { guardTeamDestination } from './server/team-access.mjs';

const here = (file: string) => fileURLToPath(new URL(file, import.meta.url));

// Solaria Sign is its own page, so pdf.js never loads with the marketing site.
function signPages(): Plugin {
  let output: string;
  return {
    name: 'solaria-sign-pages',
    configResolved(config) {
      output = resolve(config.root, config.build.outDir, 'pdfjs');
      // Private local files are served only by their respective authenticated APIs.
      config.server.fs.deny.push('**/.sign-data/**', '**/.emulator/**', '**/firebase-export-*/**', '**/firebase-debug*.log');
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (await guardTeamDestination(req, res)) return;
        const path = (req.url ?? '').split('?')[0];
        if (path === '/sign/my' || path === '/sign/my/') {
          res.writeHead(301, { Location: '/sign', 'Cache-Control': 'no-cache' });
          res.end();
          return;
        }
        if (path === '/s' || path === '/sign' || path.startsWith('/sign/')) req.url = '/sign.html';
        if (path === '/staff' || path === '/staff/') req.url = '/staff.html';
        next();
      });
    },
    // pdf.js fetches these at runtime for PDFs that don't embed their fonts.
    closeBundle() {
      cpSync(here('./node_modules/pdfjs-dist/cmaps'), resolve(output, 'cmaps'), { recursive: true });
      cpSync(here('./node_modules/pdfjs-dist/standard_fonts'), resolve(output, 'standard_fonts'), { recursive: true });
    },
  };
}

// During `npm run dev`, forward /api/* to the local Node server
// (run separately with `npm run server`). In production both are
// served by the same Node process on Cloud Run.
export default defineConfig(({ command, isPreview }) => ({
  plugins: [react(), signPages()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: { main: here('./index.html'), sign: here('./sign.html'), staff: here('./staff.html') },
    },
  },
  server: {
    proxy: {
      ...(command === 'serve' && !isPreview ? {
        '^/staff/(launch/|outbox(?:$|\\?))': 'http://127.0.0.1:8787',
        '^/staff/local-api/(session|me|accounts(?:/[A-Za-z0-9_-]+(?:/invite)?)?)$': {
          target: 'http://127.0.0.1:8787',
          rewrite: (path: string) => path.slice('/staff/local-api'.length),
        },
      } : {}),
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Keep the original card URLs working in the preview. Node serves the
      // directory index pages and generates their native vCard downloads.
      '/card': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
}));
