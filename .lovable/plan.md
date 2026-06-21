# Member Portal Redesign — Visual-Only Implementation Plan

## Guarantee: zero behavior changes

The redesign touches **only presentation**: markup, classes, layout, copy of section labels. Every route, hook, query, click handler, and conditional render stays exactly as it is. Nothing in `src/hooks/`, `src/lib/`, `src/integrations/`, `supabase/`, or any router/data layer gets touched.

## Files I will edit (3 total)

1. **`src/components/member/MemberSidebar.tsx`** — restyle only
2. **`src/components/member/MemberBottomNav.tsx`** — restyle + add Activity/Support/Account tabs that link to existing routes
3. **`src/pages/member/Dashboard.tsx`** — restructure JSX to match the v5 mockup

## Files I will NOT touch

- `MemberLayout.tsx` (notification banners, providers stay as-is)
- Any hook (`useUserMembership`, `useNextMemberPayment`, `useUserCredits`, `useUserClassAchievements`, etc.)
- Any route definition in `App.tsx`
- Any data/RPC/RLS code
- Any other member page (`Bookings`, `Wellness`, `Membership`, `PaymentMethods`, etc.)

## How tabs/links are kept working

**Sidebar (`MemberSidebar.tsx`)**
Every NavLink keeps the same `to={url}` it has today. I'll only change colors, spacing, fonts, group labels' uppercase styling, and the active-state pill. The current `mainItems` + `collapsibleGroups` arrays already point at all the right routes:
- `/member`, `/member/entry`, `/member/support`, `/member/cafe`, `/shop`
- `/member/membership`, `/member/credits`, `/member/payment-methods`, `/member/payment-history`, `/class-passes`
- `/member/bookings`, `/member/check-in-history`, `/member/kids-care`, `/member/wellness`
- `/member/health-score`, `/member/workouts`, `/member/habits`, `/member/goals`, `/member/achievements`, `/member/fitness-profile`
- `/member/profile`, `/member/waivers`, `/member/freeze`, `/member/credits`, `/member/referrals`

I'll keep the `<Collapsible>` groups expanded by default (matching mockup which shows everything open) but won't remove the collapse logic.

**Bottom nav (`MemberBottomNav.tsx`)**
Currently: Home, Entry, Book, More. New: Book → `/member/book`, Activity → `/member/check-in-history` (with badge from existing `useUnresolvedFailedCount` or upcoming-bookings count — read-only, no new query), Support → `/member/support`, Account → `/member/profile`. All routes already exist.

**Dashboard (`Dashboard.tsx`)**
Every tile/button keeps its existing `<Link to=...>` or `onClick` handler. The "Book Anything" 5 icons map to:
- Book Class → `/member/book`
- Book Amenity → `/member/wellness`
- Spa Aella → `/spa` (existing)
- Café Order → `/member/cafe`
- Buy Passes → `/class-passes`

The 4 stat cards keep their current data sources: `useUserMembership` (tier), `useUserCredits` (credits), existing visit count query, `useNextMemberPayment` (billing). The Up Next / Recent Workouts / Achievements / Recover banner all reuse the existing hooks already imported in `Dashboard.tsx`.

## Verification steps after build

1. **Build + typecheck** — runs automatically; catches broken imports/props
2. **Browser smoke test via Playwright** — log in, click every sidebar item and every bottom-nav tab on the new dashboard, screenshot each destination to prove the route loads (not 404)
3. **Visual diff** — screenshot the new `/member` against the v5 mockup at desktop + mobile widths

## Out of scope

- No new features, no new data, no new routes
- Bottom nav badge count: I'll wire it only if a hook already exposes the number; otherwise I'll show the tab without a badge rather than add a query
- Implementation only after you approve this plan
