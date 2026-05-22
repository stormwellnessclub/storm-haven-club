## Memorial Day Hours Banner — Member Portal

Add a dismissible holiday-hours banner shown on the member portal pages during the week leading up to Memorial Day 2026.

### Where it appears
- Top of member portal content, inside `MemberLayout` — placed just above `WifiBanner` so it sits with the other info banners (below the priority `NotificationBar`).
- Visible on every `/member/*` route automatically via the shared layout.

### What it says
- Heading: "Memorial Day Weekend Hours"
- Lines:
  - Sunday, May 24 — 8:00 AM – 5:00 PM
  - Monday, May 25 (Memorial Day) — 7:00 AM – 5:00 PM
- Small note: "Regular hours resume Tuesday."

### Visual style
- Patriotic-but-restrained: deep navy gradient background with subtle gold accent border (matches the existing `MothersDayBanner` pattern — gradient + 1px accent border + dismiss X).
- Calendar icon on the left, two-line hours stacked, dismiss button top-right.
- Mobile-first: stacks vertically under 640px.

### Behavior
- Visible from now through end-of-day Monday 5/25/26 in `America/Chicago`, then auto-hides.
- Dismissible — stores `memorial-day-2026-dismissed` in `localStorage` so it stays gone for that browser.
- Pure presentation, no backend, no analytics.

### Files
- New: `src/components/member/MemorialDayHoursBanner.tsx`
- Edit: `src/components/member/MemberLayout.tsx` — render `<MemorialDayHoursBanner />` next to the other info banners.

No DB, edge function, or routing changes.
