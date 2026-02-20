
## Phase 1: Enable Class Pass Booking for Members Who Already Purchased

### The Core Problem

Members who bought class passes are being blocked from booking by the `BookingModal`. After purchasing, the booking modal runs `getRequiredAgreementForPaymentMethod()` and checks whether the member has `class_package_agreement_signed` or `single_class_pass_agreement_signed` set on their profile. If those flags are not present, it shows an "Agreement Required" wall and hides the booking button entirely.

This check is wrong to have at booking time. Agreements are enforced at **purchase time** on `/class-passes` via the `InlineWaiverPrompt`. Once someone has paid, they should be able to use their pass to book without being asked to sign again.

The only agreement that makes sense to check at booking time is the **Liability Waiver** — which is the universal entry requirement.

### What Gets Removed

From `src/components/booking/BookingModal.tsx`:

- The `getRequiredAgreementForPaymentMethod()` function (lines 44-68)
- The `getWaiverUrlParam()` helper (only the non-liability-waiver cases are used from booking)
- The `requiredAgreement` useMemo (lines 121-123)
- The `hasRequiredAgreement` useMemo (lines 125-128)
- The entire "Agreement Required" alert block (lines 289-310)
- `hasRequiredAgreement` from the payment method section visibility condition (line 313)
- `hasRequiredAgreement` from the Book button's show condition (line 387)
- `hasRequiredAgreement` from the Book button's disabled condition (line 390)

### Simplified Booking Gate (after fix)

```
1. Not logged in → "Sign in to book" button
2. Logged in, no payment option → "Purchase a pass or get a membership" alert
3. Logged in, has a payment option, no liability waiver → "Sign Liability Waiver" alert
4. Logged in, has a payment option, liability waiver signed → Show payment options, enable booking
```

### What the `handleGoToWaivers` function becomes

The `param` variable that currently reads from `requiredAgreement` is simplified — since we only ever navigate to the liability waiver from the booking modal now, we can pass the type directly:

```ts
const handleGoToWaivers = () => {
  const returnUrl = encodeURIComponent(window.location.pathname);
  onOpenChange(false);
  navigate(`/member/waivers?return=${returnUrl}&type=liability_waiver`);
};
```

### Files to Modify

| File | Change |
|------|--------|
| `src/components/booking/BookingModal.tsx` | Remove redundant agreement check; simplify to liability waiver only |

### No database, edge function, or other file changes needed for Phase 1.

The expired pass extensions for Carly, Sahar, and the anonymous user are a separate data fix that can be done after this code change is confirmed working — those are one-line SQL updates per pass record.
