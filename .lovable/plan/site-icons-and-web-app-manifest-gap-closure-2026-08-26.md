# Site icons and web app manifest — gap closure

Most of this is already in place from the recent favicon work, verified against the project files:

- `favicon-16x16.png` (16x16), `favicon-32x32.png` (32x32), `favicon.png` (64x64)
- Apple touch icons at 180x180, 167x167, 152x152
- Android/PWA icons at 192x192 and 512x512, plus a 512 maskable icon
- A generated web app manifest with name, short name, theme and background colors, standalone display and icon entries
- Head links in `index.html` for every favicon size, all three Apple touch icons, and the manifest, each with a cache-busting version

Two real gaps remain.

## What changes

1. **Android Chrome icons under their conventional names.** The 192 and 512 icons currently ship as `pwa-192x192.png` / `pwa-512x512.png`. Add `android-chrome-192x192.png` and `android-chrome-512x512.png` (same gold Storm mark on the dark background) so tooling, audits, and anything expecting the standard filenames resolve them, and reference them from the manifest.

2. **Maskable icon at 192.** Only a 512 maskable exists. Add `android-chrome-maskable-192x192.png` so Android has a correctly padded adaptive icon at the smaller size too.

Both new sizes get manifest entries alongside the existing ones, with the same cache-busting version, and the existing entries stay so already-installed apps keep resolving their icons.

## Technical notes
- Icons are generated from `public/storm-logo-gold.png`, centered and padded (not stretched) on the brand dark background `#0d0d0f`; maskable variants get extra safe-zone padding.
- Manifest icon list lives in the PWA config in `vite.config.ts` — no service-worker or caching behavior changes.
- Verification: rebuild, confirm each generated file's pixel dimensions, request each icon and the manifest from the local preview, and confirm the manifest lists every icon.

Publishing is required before devices see the updated icon set; iOS home-screen shortcuts saved earlier keep their old icon until removed and re-added.
