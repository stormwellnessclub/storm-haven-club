# Fix: Aya Abusalah blocked from booking her class pass

## What's actually happening

Aya's record is fine on the pass side — she has an active single class pass (1 class left, expires Sep 4) and her liability waiver is signed. What she has **not** signed is the **Single Class Pass Agreement** (`single_class_pass_agreement_signed` is false on both her member and non-member profile records).

The booking flow blocks any booking paid with a pass whose type contains "single" or "guest" unless that specific agreement is signed, and it does so with a dead-end error message — no way to sign from inside the booking screen. So she is stuck: she owns the pass but can't use it.

Her pass was created today at 3:40pm alongside a guest pass purchase, a path that never collected the Single Class Pass Agreement — which is why the purchase succeeded but booking fails.

## The fix

### 1. Unblock Aya now
Have her sign the Single Class Pass Agreement (it exists and is active) — after the change in step 2 she can do it right in the booking screen in one tap, and the booking resumes automatically. No manual database edit; the signature stays a real, recorded consent.

### 2. Stop the dead end for everyone
When a pass-based booking is blocked by a missing Guest Pass or Single Class Pass agreement, show the inline sign-and-continue card instead of an error toast:
- Booking attempt detects the missing agreement before calling the booking RPC.
- The booking screen shows the agreement card (same component already used when buying passes), with the document link.
- On signing, the pending booking automatically retries, so the member never has to re-navigate.

This applies to both members and non-members, writing to whichever profile record the person has.

### 3. Close the gap at the source
Collect the Single Class Pass Agreement at the point where guest-pass / bundled class passes are issued, so future buyers arrive at the booking screen already cleared. Passes issued by staff still fall back to the inline prompt in step 2.

## Technical notes

- Gate lives in `src/hooks/useBooking.ts` (lines ~180-228): replace the two `throw new Error(...)` branches with a typed error the booking UI can catch (e.g. `AgreementRequiredError` carrying `agreementType`).
- Booking screens (`src/pages/member/BookClass.tsx`, `src/pages/portal/BookClass.tsx`, and the roster/session booking sheets) render `SimpleAgreementCard` on that error, reusing the signing pattern in `src/components/booking/BuyPassesDrawer.tsx` (`signSingleClassPassAgreement` from `useUserProfile` / `useNonMemberProfile`), then re-invoke the booking mutation.
- No schema change needed: `agreements` already has an active `single_class_pass` row, and both `profiles` and `non_member_profiles` have the signed flag + timestamp columns.
- Guest-pass purchase path: add the agreement step where the bundled `class_passes` row is created, matching the existing inline waiver flow used on the class pass checkout.
