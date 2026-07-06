import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA notes (why each knob is set the way it is):
//   registerType: 'autoUpdate'  -> new SW takes over as soon as the tab reloads,
//                                  so users can't get stuck on a stale build.
//   injectRegister: 'auto'      -> the plugin injects the SW registration script
//                                  into index.html itself. We do NOT touch main.jsx.
//   workbox.globPatterns        -> precache the ENTIRE build output (js, css, html,
//                                  wasm, images, fonts, svgs). This is what makes
//                                  the app — including the Three.js bundle and the
//                                  cube solver — usable with zero network.
//   navigateFallback: 'index.html' -> any client-side route hits the shell offline.
//   devOptions.enabled: false   -> don't run the SW in `vite` dev; only in build/preview.

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'favicon.ico',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'icon.svg',
      ],
      manifest: {
        name: 'CubeCoach',
        short_name: 'CubeCoach',
        description: "Solve any Rubik's Cube and actually learn how.",
        theme_color: '#0a0a0f',
        background_color: '#0a0a0f',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache everything Vite emits into dist/.
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2,ttf,json,wasm}',
        ],
        // Client-side routing fallback: any navigation request that isn't
        // an asset gets served the app shell from cache.
        navigateFallback: '/index.html',
        // The Three.js chunk pushes past the default 2 MiB per-file cap.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
