import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

function getManualChunk(id: string) {
  const normalizedId = id.replaceAll("\\", "/");

  if (!normalizedId.includes("/node_modules/")) {
    return undefined;
  }

  if (
    normalizedId.includes("/node_modules/react/") ||
    normalizedId.includes("/node_modules/react-dom/") ||
    normalizedId.includes("/node_modules/scheduler/")
  ) {
    return "react-vendor";
  }

  if (
    normalizedId.includes("/node_modules/firebase/auth/") ||
    normalizedId.includes("/node_modules/@firebase/auth/")
  ) {
    return "firebase-auth";
  }

  if (
    normalizedId.includes("/node_modules/firebase/app/") ||
    normalizedId.includes("/node_modules/@firebase/app/") ||
    normalizedId.includes("/node_modules/@firebase/component/") ||
    normalizedId.includes("/node_modules/@firebase/logger/") ||
    normalizedId.includes("/node_modules/@firebase/util/")
  ) {
    return "firebase-app";
  }

  return undefined;
}

export default defineConfig({
  envDir: fileURLToPath(new URL("../..", import.meta.url)),
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png", "manifest.webmanifest"],
      manifest: false,
      workbox: {
        globPatterns: ["index.html", "manifest.webmanifest", "icons/*.{png,svg}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /\/assets\/.*\.(?:js|css)$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "bookmark-runtime-assets",
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 7 * 24 * 60 * 60
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/assets\/.*\.(?:png|svg|webp|jpg|jpeg|gif)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "bookmark-runtime-images",
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 30 * 24 * 60 * 60
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: getManualChunk
      }
    }
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
});
