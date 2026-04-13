

## Fix: Waiver PDF 404 Error

**Root cause**: The PWA service worker (Workbox) is likely intercepting PDF asset requests. The `globPatterns` only caches `js,css,html,ico,png,svg` files — PDFs are excluded. When the service worker intercepts a PDF request, it either returns the `navigateFallback` (index.html) or fails with a 404-like response.

### Changes

**File: `vite.config.ts`**

1. Add `pdf` to the Workbox `globPatterns` so PDF assets are cached by the service worker:
   ```
   globPatterns: ["**/*.{js,css,html,ico,png,svg,pdf}"]
   ```

2. Alternatively (and more robustly), add a Workbox runtime caching rule for PDF files so they're fetched network-first:
   ```js
   runtimeCaching: [{
     urlPattern: /\.pdf$/,
     handler: 'NetworkFirst',
     options: {
       cacheName: 'pdf-cache',
     }
   }]
   ```

This ensures PDF files served as Vite assets are properly handled by the service worker instead of being intercepted and returning fallback HTML.

**Scope**: One file changed (`vite.config.ts`), specifically the Workbox configuration block. No changes to PDF resolution logic, waiver pages, or agreement components.

