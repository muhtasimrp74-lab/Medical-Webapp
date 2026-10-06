import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// base './' + HashRouter => deployable on GitHub Pages / any static host / subfolder.
export default defineConfig({
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  worker: { format: 'es' },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'MedStudy — Textbook Reader',
        short_name: 'MedStudy',
        description: 'Study reader for medical exams (MRCP, USMLE, professional exams).',
        theme_color: '#3b2f77', background_color: '#f6f5f1',
        display: 'standalone', start_url: './', scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell is precached. Book data is NOT precached (41 MB): it is cached as it is read.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['data/**', 'pages/**'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/data\/(chapters\/ch\d+|index|front_matter|back_matter)\.json$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'chapters-v1', expiration: { maxEntries: 40 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => /\/pages\/\d+\.webp$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'page-images-v1', expiration: { maxEntries: 400 }, cacheableResponse: { statuses: [200] } },
          },
        ],
      },
    }),
  ],
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] },
});
