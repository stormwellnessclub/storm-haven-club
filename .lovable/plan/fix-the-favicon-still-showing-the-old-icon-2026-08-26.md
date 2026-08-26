# Fix the favicon still showing the old icon

## What's actually happening

The new gold Storm icons are live and correct — `favicon.png`, `favicon-32x32.png`, and the Apple touch icons all serve the new artwork on stormwellnessclub.com. Two things are still causing the old icon to appear:

1. **The old Lovable heart icon is still served at `/favicon.ico`.** The file was removed from the project, but the live site still returns it (a 256x256 purple/orange heart). Browsers and Google request `/favicon.ico` by default, and many will prefer or fall back to it — so tabs, bookmarks, and search results keep showing the old mark.
2. **The published manifest is one build behind.** The live `manifest.webmanifest` doesn't include the newly added `android-chrome` icons, so the last deploy didn't pick up the most recent config change.

Browser and OS caching also plays a part: Chrome caches favicons aggressively, and an iOS home-screen shortcut keeps its original snapshot until removed and re-added.

## Plan

1. Add a real `public/favicon.ico` generated from the gold Storm mark (multi-size 16/32/48 ICO), so the default `/favicon.ico` request returns the correct brand icon instead of the leftover heart.
2. Add an explicit `<link rel="icon" href="/favicon.ico?v=2" sizes="any">` entry in `index.html` alongside the existing PNG links, ordered so modern browsers still prefer the PNGs.
3. Make sure the ICO is included in the PWA precache/include list in `vite.config.ts` so it deploys with the build.
4. Republish so the site picks up both the new ICO and the updated manifest with the `android-chrome` icons.
5. Verify after deploy: confirm `/favicon.ico` returns the new artwork, `/manifest.webmanifest` lists the android-chrome icons, and the rendered page head links resolve.

## Notes

- After publish, a hard refresh (or visiting `stormwellnessclub.com/favicon.ico?v=2` once) clears Chrome's cached tab icon.
- An existing iPhone home-screen shortcut must be deleted and re-added to refresh its icon; that's an iOS limitation, not a site issue.
- Google's search-result favicon updates only on the next crawl, which can take days.
