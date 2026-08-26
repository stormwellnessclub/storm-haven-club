import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  assetsInclude: ['**/*.pdf'],
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mcpPlugin(),
    mode === "development" && componentTagger(),
    VitePWA({
      selfDestroying: true,
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      manifestFilename: "manifest.webmanifest",
      includeAssets: [
        "favicon.ico",
        "favicon.png",
        "favicon-32x32.png",
        "favicon-16x16.png",
        "apple-touch-icon.png",
        "apple-touch-icon-152x152.png",
        "apple-touch-icon-167x167.png",
        "android-chrome-192x192.png",
        "android-chrome-512x512.png",
        "android-chrome-maskable-192x192.png",
        "robots.txt",
      ],
      manifest: {
        name: "Storm Wellness Club",
        short_name: "Storm Wellness",
        description: "Luxury wellness club - Classes, Spa, Cafe & More",
        theme_color: "#2C2C2C",
        background_color: "#FAF8F5",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/android-chrome-192x192.png?v=2",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/android-chrome-512x512.png?v=2",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/android-chrome-maskable-192x192.png?v=2",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa-maskable-512x512.png?v=2",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa-192x192.png?v=2",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png?v=2",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/apple-touch-icon.png?v=2",
            sizes: "180x180",
            type: "image/png",
            purpose: "any",
          },
        ],
      },

      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,pdf}"],
        globIgnores: ["**/assets/*.jpg", "**/assets/*.jpeg", "**/assets/*.webp"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: "index.html",
        runtimeCaching: [{
          urlPattern: /\.pdf$/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'pdf-cache',
          },
        }],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
