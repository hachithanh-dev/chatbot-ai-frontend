import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },

  server: {
    port: 5173,      // Fixed port — Google OAuth only allows pre-registered origins
    strictPort: true, // Fail fast if port is already in use (don't silently pick another)
    headers: {
      // CRITICAL: Google Identity Services (GIS) uses popup + postMessage.
      // Vite 7 sends COOP: same-origin by default which blocks cross-origin popups.
      // Setting unsafe-none allows Google's auth flow to work correctly.
      'Cross-Origin-Opener-Policy': 'unsafe-none',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
    proxy: {
      // Proxy /api calls to Spring Boot backend — avoids CORS in development
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        // Rewrite cookie domain so browser stores cookies from proxied backend
        cookieDomainRewrite: 'localhost',
      },
    },
  },
});
