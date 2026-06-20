# Milestone Unlock Celebration — Interactive Mockup

Build a standalone preview page at `/mockup/milestones` so you can play with the unlock moment before we wire it into the real portals. No backend, no real data — pure UX prototype using mock state.

## The psychology we're designing for

1. **Anticipation** — visible "next milestone" with a progress ring that fills as you simulate completing classes. Brain releases dopamine *before* the reward, not after.
2. **Peak moment** — the unlock itself: ring completes → gold burst → badge materializes → soft chime. ~2 seconds of pure earned pride.
3. **Endowment** — once unlocked, the badge sits in a personal "trophy shelf" that's visibly *yours*. Loss aversion makes you protect it.
4. **Goal gradient** — the closer you get to the next tier, the more the UI nudges (subtle glow intensifies near 90%).
5. **Variable reward** — first-time-in-class-type ⭐ badges appear unpredictably alongside count milestones, keeping novelty alive.

## What the mockup will show

A single page with three stacked sections:

**Section 1 — Hero counter (calm luxury)**
- Massive serif number ("12 classes") on near-black bg, soft gold glow underneath
- Subhead: "Three away from your next milestone"
- Gold progress ring around the number, animated fill on mount

**Section 2 — Simulator controls (the interactive part)**
- A single primary button: "Complete a class →"
- Each click increments the counter by 1 with a smooth count-up animation
- When the count crosses a tier (1, 5, 10, 25, 50, 100, 200, 500): full-screen overlay unlock sequence
  - Backdrop blur to charcoal
  - Gold particle burst (Magic UI Meteors or custom)
  - Badge scales in (serif numeral on brushed-gold disc)
  - Headline: "10 Classes" / "Consistency is becoming you"
  - Auto-dismiss after 3s or tap to close
- Secondary buttons: "Reset" and "Jump to next milestone" (so you can demo without 25 clicks)
- Toggle: "Trigger a First-in-Type ⭐ badge" — fires a smaller, side-sliding toast unlock for variety

**Section 3 — Trophy shelf**
- Horizontal scrolling row of all milestone badges (1, 5, 10, 25, 50, 100, 200, 500)
- Unlocked = full gold + soft glow; locked = charcoal outline with the number faintly visible
- First-in-type badges below as a second row of smaller chips with ⭐ + class name
- Hover/tap any unlocked badge → mini-modal showing "Earned [date]"

## Visual language (Storm calm luxury)

- Background: `#0d0d0d` → `#1a1a1a` subtle vertical gradient
- Primary gold: `#c9a84c`; highlight gold: `#f0d78c`; muted gold for locked states: `#3a3328`
- Headlines: existing project serif (Cormorant / brand serif already in use)
- Body: existing sans
- Motion: slow, confident easing (cubic-bezier(0.22, 1, 0.36, 1)); nothing bouncy
- Particles: gold flecks, low count (~20), fade out over 1.5s — luxurious, not Vegas

## Technical details

New files:
- `src/pages/mockup/MilestoneMockup.tsx` — the page (all local state, no backend)
- `src/components/mockup/MilestoneRing.tsx` — animated SVG progress ring
- `src/components/mockup/MilestoneUnlockOverlay.tsx` — full-screen unlock sequence
- `src/components/mockup/TrophyShelf.tsx` — badge grid
- `src/components/mockup/FirstTypeToast.tsx` — side-sliding ⭐ unlock

Add route in `src/App.tsx`: `/mockup/milestones` (public, no auth gate so you can share/preview easily).

Reuse: existing shadcn `Button`, `Card`, `Dialog`; Tailwind `animate-fade-in` / `animate-scale-in`; Magic UI `Meteors` for the gold burst (install if not present).

State is purely local React (`useState` for count, `useState<MilestoneTier[]>` for unlocked). No DB writes.

## Out of scope (next step after you approve the feel)

- Wiring the unlock overlay into the real `useKioskCheckIn` flow on actual class completion
- Replacing the current `ClassMilestonesCard` with the new compact dashboard variant
- Sound (chime) — easy to add but skipping until you've seen the visuals

After you click around the mockup and approve, the second pass swaps mock state for the real `user_class_achievements` data and integrates into member/non-member portals.
