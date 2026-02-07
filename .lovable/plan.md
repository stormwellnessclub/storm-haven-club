

# Root Cause and Complete Fix

## The Problem

I traced through the entire flow. Here's exactly what's happening:

### Issue 1: Auth Page Ignores Redirect Parameter

When you click "Create Account" on `/guest-pass`, `AccountRequiredSection` correctly builds the URL:
```
/auth?redirect=/guest-pass
```

But `Auth.tsx` **completely ignores this parameter** and hardcodes `/member` in three places:
- **Line 78**: When user is already logged in → `navigate("/member")`
- **Line 168**: After signup success → `navigate("/member")`
- **Line 190**: After signin success → `navigate("/member")`

So after login, users are forced to `/member` which is wrapped in `ProtectedMemberRoute`, triggering the "Checking membership status..." screen.

### Issue 2: PDF Database Values

I checked the database. The agreements table contains:

| agreement_type | pdf_url |
|----------------|---------|
| guest_pass | `guest-pass-agreement-general.pdf` |
| guest_pass | `guest-pass-agreement.pdf` |
| liability_waiver | `/assets/agreements/liability-waiver.pdf` |
| single_class_pass | `/agreements/single-class-pass-agreement.pdf` |

The `AgreementPDFViewer` component extracts filenames and maps them via `pdfMap`. This SHOULD work, but the paths with `/assets/` or `/agreements/` prefixes are inconsistent with the expected simple filenames.

### Issue 3: ClassPasses Success URL

In `ClassPasses.tsx` line 305, the success URL is hardcoded:
```typescript
successUrl: `${origin}/member/credits?purchase=success`
```

This sends **non-members** to `/member/credits` after checkout, triggering "Checking membership status..." again.

---

## The Fix (3 Files)

### File 1: `src/pages/Auth.tsx`

**Add redirect parsing and use it for all navigations:**

1. Import `useLocation` and `useSearchParams` (or parse `window.location.search`)
2. Create a helper to get the safe redirect target:
```typescript
const getRedirectTarget = () => {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");
  
  // Validate: must start with / but not //
  if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
    return redirect;
  }
  return "/member"; // default
};
```
3. Replace these three navigations:
   - Line 78: `navigate("/member")` → `navigate(getRedirectTarget())`
   - Line 168: `navigate("/member")` → `navigate(getRedirectTarget())`
   - Line 190: `navigate("/member")` → `navigate(getRedirectTarget())`

### File 2: `src/pages/ClassPasses.tsx`

**Make success URL conditional based on membership:**

Change line 305:
```typescript
// Before
successUrl: `${origin}/member/credits?purchase=success`,

// After  
successUrl: isMember 
  ? `${origin}/member/credits?purchase=success`
  : `${origin}/class-passes?purchase=success`,
```

### File 3: Database Update (optional cleanup)

Update the `pdf_url` values to use simple filenames (matching the `pdfMap` keys):

```sql
UPDATE public.agreements 
SET pdf_url = 'liability-waiver.pdf'
WHERE agreement_type = 'liability_waiver';

UPDATE public.agreements 
SET pdf_url = 'single-class-pass-agreement.pdf'
WHERE agreement_type = 'single_class_pass';
```

This ensures consistent filename matching in the PDF viewer.

---

## What This Fixes

After these changes:

1. **Guest Pass flow**: 
   - User on `/guest-pass` → clicks "Create Account" → `/auth?redirect=/guest-pass`
   - Signs in → Auth reads redirect → navigates to `/guest-pass`
   - `InlineWaiverGate` shows PDFs → user signs → form appears
   - **No "Checking membership status..." anywhere**

2. **Class Pass flow**:
   - Same pattern for `/class-passes`
   - After Stripe checkout, non-members return to `/class-passes?purchase=success`
   - **No member portal redirect**

3. **PDF display**:
   - Database values normalized to match `pdfMap` keys
   - PDFs load reliably via bundled imports

---

## Technical Summary

| File | Line(s) | Current | Change To |
|------|---------|---------|-----------|
| `Auth.tsx` | 78 | `navigate("/member")` | `navigate(getRedirectTarget())` |
| `Auth.tsx` | 168 | `navigate("/member")` | `navigate(getRedirectTarget())` |
| `Auth.tsx` | 190 | `navigate("/member")` | `navigate(getRedirectTarget())` |
| `ClassPasses.tsx` | 305 | Hardcoded `/member/credits` | Conditional based on `isMember` |
| Database | agreements | Various paths | Simple filenames |

