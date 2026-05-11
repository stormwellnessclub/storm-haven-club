## Goal

Make booking one-tap accessible from the bottom of every member and non-member screen, and keep buying credits inside the booking flow so members never have to leave the page.

## Navigation changes

**Member bottom nav (`MemberBottomNav.tsx`)** — replace `Credits` with `Book`:

```
Home · Entry · Book · More
```

`Credits` moves into the sidebar "More" menu (it already lives there). The `Book` tab routes to `/member/book`.

**Non-member portal** — add a new mobile bottom nav mirroring the member one:

```
Home · Book · Passes · More
```

- New component `src/components/portal/PortalBottomNav.tsx` (mirrors `MemberBottomNav`)
- Mounted in `PortalLayout.tsx`, visible only on `md:hidden` so desktop keeps the sidebar
- `More` opens the existing portal sidebar

## New pages

### Book hub
- `src/pages/member/Book.tsx` at `/member/book`
- `src/pages/portal/Book.tsx` at `/portal/book`

Layout: three large cards stacked on mobile, 3-up on tablet+:

```text
┌─────────────────────────┐
│ 🧘  Book a Class        │  → /member/book/class
│ Reformer · Cycling      │
├─────────────────────────┤
│ 💆  Book Spa            │  → /member/book/spa
│ Massage · Recovery      │
├─────────────────────────┤
│ 👶  Book Kids Care      │  → /member/book/kids
│ Drop-off care            │
└─────────────────────────┘
```

Each card shows the user's relevant balance underneath (class credits, spa packages count, kids-care sessions left).

### Book Class (in-portal)
- `src/pages/member/BookClass.tsx` at `/member/book/class`
- `src/pages/portal/BookClass.tsx` at `/portal/book/class`

Top strip — always visible:

```text
┌───────────────────────────────────────────────┐
│ Your credits                                  │
│ Reformer Pilates: 4   Cycling: 2              │
│                              [ Buy more ▸ ]   │
└───────────────────────────────────────────────┘
```

Below the strip: the existing class schedule UI from `src/pages/Schedule.tsx`, refactored into a reusable component `<ScheduleBrowser />` so it can be embedded without the public-page chrome (header, footer, marketing copy). The standalone `/schedule` and `/book` routes keep working by rendering the same component inside the public layout.

**Inline "Buy more" drawer (`<BuyPassesDrawer />`)**:
- Opens as a bottom Sheet (mobile) / right Drawer (desktop)
- Lists the current `pilates_cycling` pass SKUs ($25 single, $30 single, multi-packs) using the same pricing logic as `/class-passes`
- Embedded Stripe Elements form (reuses the existing `stripeRemountKey` pattern from class-pass purchase flow — see memory)
- Inline waiver signing if not yet on file (existing pattern from class-pass purchase flow)
- On success: closes drawer, refetches credits query, toast confirms. The user is still on the Book Class page with their new balance reflected in the top strip.

### Book Spa (in-portal)
- `src/pages/member/BookSpa.tsx` at `/member/book/spa`
- `src/pages/portal/BookSpa.tsx` at `/portal/book/spa`

Embeds the existing `SpaBookingModal` flow as inline content (service picker → therapist → time → confirm). No changes to spa booking logic, RPCs, or waiver/card requirements.

### Book Kids Care (in-portal)
- `src/pages/member/BookKids.tsx` at `/member/book/kids`
- (Non-members: link out to `/portal/passes` if they don't have a kids-care plan — kids care is members + active plan only)

Top strip shows remaining sessions and a "Buy more sessions" button that opens an inline drawer to add the $40 single or $75 monthly plan. Below: the existing kids-care booking calendar from `MemberKidsCare`, extracted into `<KidsCareBookingPanel />`.

## File changes

**Edited**
- `src/components/member/MemberBottomNav.tsx` — swap Credits for Book
- `src/components/portal/PortalLayout.tsx` — mount new `PortalBottomNav`, add `pb-16 md:pb-0` to main
- `src/App.tsx` — register 6 new routes (3 member, 3 portal) under `ProtectedMemberRoute` / `ProtectedPortalRoute`
- `src/pages/Schedule.tsx` — extract schedule grid into `<ScheduleBrowser />` so it can be embedded
- `src/pages/member/KidsCare.tsx` — extract booking calendar into `<KidsCareBookingPanel />`

**Created**
- `src/components/portal/PortalBottomNav.tsx`
- `src/components/booking/ScheduleBrowser.tsx` (refactor target)
- `src/components/booking/KidsCareBookingPanel.tsx` (refactor target)
- `src/components/booking/BuyPassesDrawer.tsx` — inline Stripe purchase
- `src/components/booking/CreditsStrip.tsx` — reusable top strip
- `src/pages/member/Book.tsx`, `BookClass.tsx`, `BookSpa.tsx`, `BookKids.tsx`
- `src/pages/portal/Book.tsx`, `BookClass.tsx`, `BookSpa.tsx`

## What is NOT changing

- No changes to booking RPCs, credit deduction logic, waiver flow, or Stripe webhooks
- No changes to public `/schedule`, `/spa`, `/class-passes`, or `/book` routes — they keep working
- No pricing or fee logic changes
- The existing `/member/credits` page stays (accessible from More menu) — we only remove it from the bottom nav

## Verification

1. On mobile, member sees Home · Entry · **Book** · More; tapping Book → hub → Book a Class → schedule list with credits at top
2. Tap "Buy more" → drawer opens, can complete purchase, drawer closes, credit count updates without page navigation
3. Non-member at `/portal` sees the new bottom nav and can complete the same flow
4. `/schedule` (public) still renders correctly with marketing chrome
5. Existing spa booking modal works identically when launched from the new Book Spa page
