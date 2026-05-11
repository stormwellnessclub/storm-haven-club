## Goal
Members must have an active Kids Care pass before they can book a Kids Care session. If they don't, show an inline **Buy Kids Care Pass** button right where they tried to book — no navigating away.

## Current state

- `useKidsCarePasses()` (`src/hooks/useKidsCareBooking.ts`) already returns active passes with `classes_remaining > 0`.
- `src/components/booking/KidsCareBookingModal.tsx` (line 398–405) already shows an alert when there are no passes, but it just links to `/class-passes` (wrong route — Kids Care isn't sold there) and there's no inline buy button.
- `src/pages/member/KidsCareBookings.tsx` — the page with the "Book a Session" CTA and the upcoming-slot "Book" buttons — does **not** check pass status before opening the booking modal.
- `src/pages/member/KidsCare.tsx` already has a working embedded Stripe checkout flow that calls `stripe-payment` with `action: create_kids_care_checkout, embedded: true` and renders Stripe's `EmbeddedCheckout`. We will reuse this exact flow rather than rebuilding it.
- Purchase is gated on the Kids Care agreement being signed (`profile.kids_care_agreement_signed`). If unsigned, we cannot let them buy inline — they must go to `/member/kids-care` to sign first.

## What changes

### 1. New small component: `KidsCarePassGate`
`src/components/booking/KidsCarePassGate.tsx`

Reusable banner/card that:
- Reads `useKidsCarePasses()` and `useUserProfile()`.
- Renders nothing when an active pass exists.
- When no pass + **agreement signed** → shows an inline **Buy Kids Care Pass — $75/mo** button. Clicking it calls `stripe-payment` with `create_kids_care_checkout, embedded: true` and opens the returned `clientSecret` in a `Dialog` containing `EmbeddedCheckoutProvider` + `EmbeddedCheckout` (same pattern as `KidsCare.tsx`). On success (Stripe returns to `?session_id=...`) invalidate `["kids-care-passes"]`.
- When no pass + **agreement not signed** → shows the same banner but the button becomes **Sign agreement & buy pass** and navigates to `/member/kids-care`.

### 2. Gate the bookings page
`src/pages/member/KidsCareBookings.tsx`
- Render `<KidsCarePassGate />` near the top (under the "Book a Session" header).
- When no active pass, disable the **Book a Session** button and the per-slot **Book** buttons; hovering / tapping shows a tooltip "Active Kids Care Pass required."

### 3. Tighten the modal fallback
`src/components/booking/KidsCareBookingModal.tsx`
- Replace the existing "no pass" alert (lines 398–405) with `<KidsCarePassGate />` so the same inline-buy UX appears if someone reaches the modal another way (e.g. resume-booking banner).

### 4. No backend changes
- `stripe-payment` already supports `create_kids_care_checkout` with `embedded: true`.
- No DB / RPC / RLS changes.
- No new edge functions.

## Files touched

- **New**: `src/components/booking/KidsCarePassGate.tsx`
- **Edit**: `src/pages/member/KidsCareBookings.tsx` (mount the gate, disable booking CTAs when no pass)
- **Edit**: `src/components/booking/KidsCareBookingModal.tsx` (swap inner alert for the gate)

## Out of scope

- Portal (non-member) flow — request is for "members".
- Admin-side overrides.
- Changing the $75/mo product, expiration, or session quota.
- Touching booking RPCs — the existing atomic deduction in `useKidsCareBooking.ts` already prevents booking without remaining sessions on the server side; this plan adds the matching client-side affordance + inline purchase.