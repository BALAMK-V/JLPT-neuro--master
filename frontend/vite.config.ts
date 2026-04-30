import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            // Cache API calls for flashcard review (so cards are available offline)
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api/flash/") ||
              url.pathname.startsWith("/api/vocab/") ||
              url.pathname.startsWith("/api/kanji/"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "jlpt-api-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "JLPT Neuro Master",
        short_name: "JLPTNeuro",
        description: "Smart Japanese learning system for JLPT preparation",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
