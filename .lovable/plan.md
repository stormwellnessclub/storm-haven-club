

## Plan: Fix PWA Not Updating Automatically

### Problem
When members install the app to their home screen, the service worker caches old files. Even though `registerType: "autoUpdate"` is set, the workbox config is missing `skipWaiting` and `clientsClaim`, so the new service worker sits waiting until the user fully closes and reopens the app (or deletes the bookmark).

### Fix

**Update `vite.config.ts`** — add three workbox options:

```typescript
workbox: {
  globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
  globIgnores: ["**/assets/*.jpg", "**/assets/*.jpeg", "**/assets/*.webp"],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  skipWaiting: true,        // New SW activates immediately
  clientsClaim: true,       // Takes control of all open pages
  navigateFallback: "index.html",  // SPA fallback for offline nav
},
```

- **`skipWaiting: true`** — Forces the new service worker to activate without waiting for old tabs to close
- **`clientsClaim: true`** — New service worker takes control of existing pages immediately
- **`navigateFallback`** — Ensures SPA routing works properly in standalone mode

This is a one-file change. After deployment, the next time a member opens the app, it will auto-update in the background and they'll always get the latest version.

