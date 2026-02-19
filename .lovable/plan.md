
## Fix Non-Member Class Pass Purchase Flow

### Root Causes Identified

Three bugs are blocking non-member purchases:

**Bug 1: Pass-specific agreement checks incorrectly applied to non-members**
`needsSingleClassAgreement` and `needsClassPackageAgreement` check `profile?.single_class_pass_agreement_signed`. For non-members, `profile` is always `null`, so these checks always resolve to `true`, incorrectly triggering the inline waiver prompt even though non-members don't need those agreements (only the liability waiver).

**Bug 2: `InlineWaiverPrompt` silently returns nothing**
When `single_class_pass` or `class_package` is triggered for a non-member, the `signerMap` has no entry for those types for non-members — `signer` is `undefined`, and the component returns `null` with zero feedback. The purchase button stops loading and nothing happens.

**Bug 3: Non-member profile cache not invalidated after waiver signing**
The `InlineWaiverPrompt`'s `onSigned` callback only invalidates `["user-profile", user?.id]` (the member profile cache). When a non-member signs the liability waiver through `nonMemberHook.signWaiver`, `hasLiabilityWaiver` reads from `nonMemberProfile` which is cached under `["non-member-profile", user?.id]`. That cache is never refreshed, so `hasLiabilityWaiver` stays `false` after signing and the purchase stays blocked.

---

### Fix Plan

#### File: `src/pages/ClassPasses.tsx`

**Fix 1 — Skip pass-specific agreements for non-members**

Change the logic for `needsSingleClassAgreement` and `needsClassPackageAgreement` to only apply when the user has a member profile:

```ts
// Before (broken):
const needsSingleClassAgreement = hasSingleClassAgreementConfigured && !profile?.single_class_pass_agreement_signed;
const needsClassPackageAgreement = hasClassPackageAgreementConfigured && !profile?.class_package_agreement_signed;

// After (fixed):
const needsSingleClassAgreement = !!profile && hasSingleClassAgreementConfigured && !profile.single_class_pass_agreement_signed;
const needsClassPackageAgreement = !!profile && hasClassPackageAgreementConfigured && !profile.class_package_agreement_signed;
```

Non-members only ever need the liability waiver. Pass-specific agreements (`single_class_pass`, `class_package`) are only for members who have a full `profiles` record.

**Fix 2 — Invalidate non-member profile cache after waiver signing**

In the `InlineWaiverPrompt` `handleSign` callback, also invalidate the non-member profile cache so `hasLiabilityWaiver` re-evaluates:

```ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
  queryClient.invalidateQueries({ queryKey: ["non-member-profile", user?.id] }); // ADD THIS
  toast.success(`${title} signed successfully!`);
  onSigned();
},
```

---

### Expected Behavior After Fix

**Non-member purchase flow:**
1. User visits `/class-passes` — sees prices, no blocking
2. User clicks "Purchase" (single or 10-pack)
3. If liability waiver not signed → `InlineWaiverPrompt` appears with the PDF, checkbox, and sign button
4. After signing → non-member profile cache refreshes → `hasLiabilityWaiver` becomes `true`
5. User clicks "Purchase" again → pass-specific agreement checks are skipped (non-member has no `profile`)
6. Stripe Checkout opens in the same tab

**Member purchase flow (unchanged):**
1. Same as before — liability waiver + member pass agreements still enforced

### Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/pages/ClassPasses.tsx` | ~372–373 | Add `!!profile &&` guard to pass-specific agreement checks |
| `src/pages/ClassPasses.tsx` | ~83 | Add `non-member-profile` cache invalidation in `handleSign` |

### No database changes needed — the schema is correct.
