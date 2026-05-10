## Problem

When a member with a purchased class pass tries to book a class, the Payment Method radio and the selected pass keep flickering / snapping back to the first option. Users can't reliably keep their selection long enough to confirm.

## Root cause

Two compounding issues:

1. **`useAvailableCreditsForCategory` returns a new object and a new `availablePasses` array on every render** (it calls `.filter(...)` inline without memoization). Any consumer that depends on this value sees "changed" deps every render.

2. **`BookingModal`'s init-defaults effect** (the one that sets `paymentMethod` / `selectedPassId` / `selectedPassType`) lists `canUseMemberCredits`, `canUsePass`, and `creditsData?.availablePasses` as dependencies. Because dep #1 changes every render, this effect re-runs constantly and resets the user's choices back to the default pass. Combined with the draft-writer effect (which re-runs on every state change) and `useUserCredits` refetches, it produces the visible "shakiness".

## Fix

Frontend only — no business logic / RPC changes.

### 1. `src/hooks/useUserCredits.ts`
- Wrap the derived `availablePasses`, `hasClassCredits`, and the returned `data` object in `useMemo`, keyed on `creditsData` and `classCategory`. The array/object identity will then only change when the underlying credits actually change.

### 2. `src/components/booking/BookingModal.tsx`
- Change the "set sensible defaults" effect so it only runs **once per session** (when `session?.id` changes or when the modal opens fresh with no draft). Use a ref like `initializedForSessionRef.current` to guard, or simply key the effect on `session?.id` alone and read the current `creditsData` snapshot inside without listing it as a dep.
- Keep the draft-restore branch intact (it already early-returns).
- Leave the draft-writer effect alone, but the upstream stabilization will stop the cascade.

### Out of scope
- No changes to `useBookClass`, the booking RPC, pass deduction, or waitlist logic.
- No DB migration.

## Verification

- Open a class booking as a member with at least one valid class pass.
- Confirm the Payment Method radio and pass dropdown stay on whatever the user picks (no snap-back).
- Confirm defaults still apply on first open when there's no draft.
- Confirm resuming a draft still restores the saved selection.
