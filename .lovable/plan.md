
## Three Fixes: Mobile Layout, Waiver UX & Rename

### Issue 1 — Class cards cut off on mobile (Schedule page)

The day-view card grid uses `sm:grid-cols-2` on a container with no horizontal padding inside `container`. On a narrow iPhone (375px), the two-column grid forces each card to be ~170px wide, which clips the content (class name, time, button). The cards need to be single-column on mobile and only go 2-column on larger screens.

Additionally, the filter buttons row (`flex-wrap gap-2`) overflows horizontally and wraps awkwardly on mobile. It should scroll horizontally rather than wrap.

The day selector strip and week nav also need tighter spacing on mobile.

**Changes to `src/pages/Schedule.tsx`:**
- Change the day-view grid from `grid gap-3 sm:grid-cols-2` to `grid gap-3 grid-cols-1 sm:grid-cols-2` (single column on mobile only)
- Change the filters row from `flex flex-wrap gap-2 mb-6` to `flex gap-2 mb-6 overflow-x-auto pb-2 flex-nowrap` so filters scroll horizontally instead of wrapping across multiple lines
- Add `px-4` to the inner container on mobile so cards don't sit flush against screen edges
- Tighten week nav text from `min-w-[180px]` to `min-w-0 flex-1 text-center` so it doesn't overflow on small screens

### Issue 2 — "Sign the waiver" message requires scrolling; waiver not inline

Currently when a user has no liability waiver, the `BookingModal` shows a red alert with a button that navigates them away to `/member/waivers`. This means they leave the modal, go sign a waiver on a completely different page, then have to come back and find the class again. On mobile this is especially jarring.

**The fix: Inline the waiver signing directly inside the BookingModal.**

Instead of navigating away, when `hasLiabilityWaiver` is false, render an inline expandable waiver card inside the modal itself. The user can:
1. See a compact "Liability Waiver Required" notice
2. Tap "Sign Waiver" → the waiver section expands inline showing the PDF link and a "I have read and agree" checkbox + sign button
3. After signing, the modal automatically refreshes and shows the payment options — no page navigation needed

**Changes to `src/components/booking/BookingModal.tsx`:**
- Add a local `showWaiverInline` boolean state (default `false`)
- Replace the current "Sign Liability Waiver" navigate button with:
  - A compact alert showing "Liability Waiver required to book"
  - A "Sign Now" button that sets `showWaiverInline = true`
  - When expanded: show a link to open the PDF + a checkbox "I agree to the Liability Waiver" + a "Sign & Continue" button that calls `signWaiver()` from `useUserProfile`
- Import `useUserProfile` (already imported), `useQueryClient` to invalidate cache after signing
- After signing, invalidate the `user-profile` query so `hasLiabilityWaiver` updates immediately and the payment method selection appears without closing the modal

This keeps the user in the booking flow the whole time — they never leave the modal.

### Issue 3 — Rename "Single Class Pass Agreement" → "Class Waiver"

The title appears in two places:
1. `src/pages/member/Waivers.tsx` — line 244: `title: "Single Class Pass Agreement"`
2. `src/pages/member/Waivers.tsx` — line 245: `description: "Required for single class pass purchases"`

**Change in `src/pages/member/Waivers.tsx`:**
- Line 244: `"Single Class Pass Agreement"` → `"Class Waiver"`
- Line 245: `"Required for single class pass purchases"` → `"Required for class pass purchases"`

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Schedule.tsx` | Mobile grid fix (single column), horizontal scroll filters, tighter nav |
| `src/components/booking/BookingModal.tsx` | Inline waiver signing — no page navigation needed |
| `src/pages/member/Waivers.tsx` | Rename "Single Class Pass Agreement" → "Class Waiver" |
