

## Plan: Update Homepage Hero Section

### Changes to `src/pages/Index.tsx`

**1. Copy uploaded image into project**
- Copy `user-uploads://DSC08249-Edit-Edit-2.jpeg` to `src/assets/lobby-hero.jpeg`
- Import it and replace `gymArea2` as the hero background

**2. Update hero image + overlay** (lines 98-105)
- Replace `src={gymArea2}` with the new lobby image
- Increase opacity slightly (the lobby is lighter than the gym shot) — use `opacity-60` so marble and arches remain visible
- Keep the gradient overlay but lighten it slightly so the space is felt

**3. Replace headline** (lines 109-113)
```
This is what it feels like
to finally <span className="text-accent">arrive.</span>
```

**4. Replace subheading** (line 114-116)
```
A private wellness club designed for people who take every detail of their life seriously.
```

**5. Remove "Explore Memberships" button** (lines 123-127)
Delete the second `<Link to="/memberships">` button entirely.

**6. Update primary CTA** (lines 117-122)
- Change text from "Apply for Membership" to "Explore Memberships"
- Change link from `/apply` to `/memberships`

**7. Remove "Download App" link** (lines 130-143)
Delete the entire `isStandalone` block with the Download App ghost button.

### Files
- **Copy**: `DSC08249-Edit-Edit-2.jpeg` → `src/assets/lobby-hero.jpeg`
- **Edit**: `src/pages/Index.tsx` (hero section only, lines 97-143)

No other sections of the page are touched.

