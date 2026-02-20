
## Add "Class Schedule Is Live" Banner to Public Site & Member Portal

### What This Does

A new dismissible banner component will appear at the very top of both the public website and the member portal, announcing that the reformer pilates class schedule is now live and linking directly to `/schedule`. It will be session-dismissible (disappears until the next browser session) and will automatically stop showing after March 18, 2026 (the end of the soft-launch period).

---

### New Component: `ClassScheduleBanner`

A single new file `src/components/ClassScheduleBanner.tsx` will be created, following the exact same pattern as `SoftLaunchHoursBanner.tsx`:

- Gold/accent color scheme (`bg-gold/10 border-gold/30`) to make it visually distinct
- A `CalendarDays` icon on the left
- Headline: **"Reformer Pilates Schedule Is Now Live"**
- Sub-text: *"Feb 20 – Mar 18, 2026 · Book your spot now"*
- A `→ View Schedule` link to `/schedule`
- A dismiss `×` button in the top-right corner
- Session-based dismissal (uses `sessionStorage` with key `class-schedule-banner-dismissed`)
- Auto-hides after March 18, 2026

---

### Where It Gets Added

**Public site — `src/components/Layout.tsx`**

The banner is inserted between `<Navigation />` and `<PWAInstallPrompt />`:

```text
<Navigation />
<ClassScheduleBanner />   ← NEW
<PWAInstallPrompt />
<main>…</main>
<Footer />
```

**Member portal — `src/components/member/MemberLayout.tsx`**

The banner is inserted right after `<SoftLaunchHoursBanner />` (which is the first item in the layout):

```text
<SoftLaunchHoursBanner />
<ClassScheduleBanner />   ← NEW
<WifiBanner />
…
```

---

### Files to Create / Modify

| File | Change |
|------|--------|
| `src/components/ClassScheduleBanner.tsx` | New component |
| `src/components/Layout.tsx` | Import and render `<ClassScheduleBanner />` |
| `src/components/member/MemberLayout.tsx` | Import and render `<ClassScheduleBanner />` |

No database changes needed. No new dependencies needed.
