## Clarifying Freeze Semantics

You want a **membership freeze** to mean exactly two things:

1. **Stripe billing is paused** — no monthly dues or annual fee charged during the freeze.
2. **Membership-only benefits are paused** — no monthly class credits, no Red Light/Cryo credits, no member pricing, no QR check-in as a member.

It should **NOT** affect:
- Logging into the site
- Accessing their member dashboard / portal
- Browsing the schedule, shop, cafe, etc.
- Buying class passes, booking spa appointments, or paying as a guest/non-member at non-member pricing
- Using class passes they already own (e.g., a 10-pack they bought separately)

---

## Current State (What I Found)

### ✅ Already correct
- **Stripe billing is paused on freeze activation** — `useAdminFreezeRequests.ts` calls `stripe-payment` with `pause_subscription` for both the monthly dues sub and annual fee sub.
- **Billing resumes automatically** — the `process-freeze-expirations` edge function (now scheduled daily via cron) un-pauses Stripe and flips the member back to `active`.
- **Portal access is NOT blocked** — `ProtectedMemberRoute.tsx` lets `frozen` members into `/member` with no restriction. They see an "AccessRevoked" screen only if they're on the `blocked_persons` list, which is separate.
- **Frozen members keep their already-purchased class passes** — `useUserCredits.ts` queries members with status `IN ('active', 'frozen')`, and the booking RPC `book_class_session` accepts both statuses.
- **Member monthly class credits are correctly hidden** when frozen — `useAvailableCreditsForCategory` only exposes `classCredits` when `memberStatus === 'active'`.

### ⚠️ Gaps vs. your stated intent

1. **QR scanner / front-desk check-in denies frozen members entirely.**
   `process_member_scan` returns `denial_reason = 'membership_frozen'` and blocks entry. If a frozen member walks in to take a class they paid for with a class pass (or a single drop-in), the scanner won't let them in. This contradicts "they can still do non-member things."
   - **Fix:** Allow scanner entry for frozen members but display a clear banner ("Membership Frozen — non-member rates apply") so front desk knows to charge a guest rate or verify a valid class pass / spa booking before allowing the activity. Booking RPCs already enforce credit/pass validity, so the scanner doesn't need to be the sole gate.

2. **Portal UI may still feel "frozen" / restrictive.**
   `useMemberBenefitsStatus` returns `hasFrozenBenefits = true` and `canCheckIn = false` for frozen members. Several Dashboard sections key off this and likely show big "Your membership is frozen" warnings everywhere instead of just on membership-specific cards.
   - **Fix:** Audit the Dashboard so the frozen banner is informational (one place at the top), and non-membership tiles (Class Passes, Spa, Shop, Schedule) remain fully usable without warning overlays.

3. **Booking flows treat frozen members as members for class-credit lookup.**
   The class-booking RPC accepts `frozen` status — which is good for using a pre-paid class pass — but we should confirm it does NOT silently let them spend a member monthly class credit. (Quick re-read of the RPC will confirm; the front-end already hides them.)

4. **Spa/Wellness booking parity.**
   Need to verify a frozen member can still book Red Light / Cryo / Massage **at non-member pricing** by paying directly, even if their membership-included credits are paused. Current behavior in `book_wellness_appointment` may simply error out instead of falling back to "pay as guest."

---

## Proposed Changes (once you approve)

| # | File | Change |
|---|------|--------|
| 1 | `supabase/migrations/<new>` | Update `process_member_scan` to return `access_granted = true` for `frozen` members with a new `warning_reason = 'membership_frozen_non_member_access'` field — front desk sees a yellow banner instead of a red denial. |
| 2 | `src/pages/admin/Scanner.tsx` | Render the warning banner ("Frozen — verify pass/booking or charge non-member rate") instead of the current red "Membership Frozen" denial. |
| 3 | `src/pages/member/Dashboard.tsx` | Reduce the frozen-state UI to a single top-of-page informational banner. Stop graying out tiles for non-membership features (Class Passes, Spa booking, Shop, Schedule). |
| 4 | `src/hooks/useMemberBenefitsStatus.ts` | Add a new flag `canActAsNonMember` (always true unless cancelled/blocked) so components can distinguish "membership benefits paused" from "all access revoked." |
| 5 | `supabase/functions/book-spa-appointment` (or RPC) | Verify frozen members can book any spa service by paying upfront at non-member rates. If not, add a fall-through path. |
| 6 | Verify `book_class_session` RPC | Confirm it never debits `member_credits` when `members.status = 'frozen'` (only allows pass-based or paid bookings). Add an explicit guard if missing. |

---

## What I will NOT change

- The Stripe pause/resume flow — already working correctly per your intent.
- The "frozen" status itself or the freeze fee ($30/mo).
- The blocked-persons system — that's a separate, harder revocation.

---

## Question before I proceed

**Should a frozen member who walks in be able to check in for a class they already paid for with a pre-purchased class pass without any front-desk intervention** — or do you want the front desk to manually verify them every time during a freeze? This determines whether item #1 above is a soft warning (auto-allow) or a manual override (block + admin override button).