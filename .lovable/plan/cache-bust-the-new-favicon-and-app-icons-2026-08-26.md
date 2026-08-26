# Cache-bust the new favicon and app icons

## Problem

Browsers cache favicons aggressively and keep serving `/favicon.png` from disk cache, so returning visitors still see the old icon even though the file changed. The filenames stayed the same, so nothing signals a change.

## Approach

Add a version marker to every icon URL. Bump the marker whenever the icons change.

1. `index.html` — append `?v=2` to each icon href:
   - `/favicon.png?v=2`, `/favicon-32x32.png?v=2`, `/favicon-16x16.png?v=2`
   - `/apple-touch-icon.png?v=2`, `-167x167`, `-152x152`
   - `/manifest.webmanifest?v=2` (so the manifest itself is re-fetched and its icon list is re-read)
2. `vite.config.ts` — same `?v=2` suffix on the manifest `icons[].src` entries (192, 512, maskable, 180) so installed PWAs pull fresh art.

The query string leaves the actual files and paths untouched, so nothing else in the app needs to change. Future icon changes only require bumping `v`.

## Notes

- Browser tabs and Android/Chrome installs will pick up the new icon on the next load after publishing.
- iOS home-screen shortcuts are the one exception: iOS snapshots the icon when the shortcut is created and no query string forces a refresh. An existing shortcut must be removed and re-added; new saves get the correct icon.
