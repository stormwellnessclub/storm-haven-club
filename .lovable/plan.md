

## Fix Philosophy Section Issues

### Problems Identified

1. **Unused `zerobodyRoom` import** — The old background image (`zerobody-room.jpg`) is still imported on line 25 but never used in JSX. This dead import may cause the bundler to include it, and could be related to the stale rendering you see.

2. **"ZeroBody cryo room with pods and marble interior" text** — This appears to be alt text from a broken or ghost image reference. It is not present in the current Index.tsx code, suggesting a stale preview cache. Removing the unused import and triggering a clean rebuild should resolve it.

3. **The "BUILT WITH INTENTION" section still appearing** — The code already has the correct "WHY WE EXIST" section. This is a stale preview issue that a code change (removing the dead import) will force to refresh.

### Changes

#### File: `src/pages/Index.tsx`
- **Remove line 25**: Delete the unused `import zerobodyRoom from "@/assets/zerobody-room.jpg"` import
- This forces a rebuild and clears the stale preview, ensuring only the "WHY WE EXIST" section renders with clean dark background, no image

One line removed. No other changes.

