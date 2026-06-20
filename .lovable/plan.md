## Goal

Replace the current sparse confetti in the milestone unlock celebration with the **Celestial Gold** direction the user selected. The overlay still fires on the same trigger (crossing 1/5/10/25/50/100/200/500 classes) and still auto-closes — only the visual layer changes.

Scope is **class milestones only** (the new system). The older `/member/achievements` page is untouched.

## What changes

**File:** `src/components/mockup/MilestoneUnlockOverlay.tsx` — full rewrite of the visual layers, keeping the same props (`milestone`, `onClose`) and timing.

New composition, all using existing Storm palette (`#0d0d0d`, `#c9a84c`, `#f0d78c`, `#f5f0e0`):

1. **Ambient backdrop** — large soft radial gold glow behind everything (~20% opacity, heavy blur).
2. **Rotating conic light rays** — slow 30s `animate-spin` on a conic-gradient disc, ~30% opacity, blurred — gives the "sun behind clouds" feel.
3. **Concentric pulse rings** — two faint gold borders that `ping` at staggered intervals (4s, 6s) outward from the badge.
4. **Layered particle field** — replaces today's 28 flecks with ~60 particles across three depth layers:
   - **Bokeh** (large, blurred, slow-pulse): 8–10 soft circles
   - **Floating flakes** (small rectangles, rotated, gentle `bounce` 3–5s): 15–20
   - **Shimmer flecks** (tiny dots, `ping`): 25–30, staggered delays
5. **Central badge disc** — keep the existing gold radial-gradient disc + tier number, but:
   - Add an outer halo (blurred gold circle, scale-125, 20% opacity)
   - Add 2 floating "glints" near the badge edge that pulse
   - Slight shadow lift: `0 0 50px rgba(201,168,76,0.5)`
6. **Footer copy** — keep the existing milestone copy ("Milestone Unlocked" + tier name), tighten letter-spacing to `0.25em` for the luxe feel.

## Behavior — unchanged

- Auto-closes after 4.2s
- Click anywhere to dismiss
- Fires from `MilestoneMockup.tsx` exactly as it does today
- No new dependencies; pure CSS keyframes + Tailwind animation utilities

## Out of scope (next step)

- Wiring this into the real `ClassMilestonesCard` on the member + non-member dashboards with live `user_class_achievements` data. We'll do that once you've seen the new celebration playing on `/mockup/milestones` and confirmed it feels right.

## Verification

After the edit I'll run Playwright against `/mockup/milestones`, click "Jump to next milestone," and screenshot the overlay mid-animation to confirm the new particle density and rotating rays render correctly.
