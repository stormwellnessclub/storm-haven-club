

## Fix Guest Pass Purchase Flow: Waiver Clarity + Success Confirmation Page

Two issues to fix:

### Problem 1: Women Unable to Complete Purchase
There are **two active** guest pass agreements in the database ("Guest Pass - Membership Agreement" and "Guest Pass Agreement"). The `InlineWaiverGate` checks if `guest_pass_agreement_signed` is true on the profile. If users are confused about which agreement to sign, or the signing flow only sets the flag for one of them, they may remain blocked. We'll add clearer inline guidance so logged-in users who haven't signed see a direct "Sign Agreement" button with better instructions (not the generic 3-step alert that tells them to "create an account" when they're already logged in).

### Problem 2: No Success Confirmation After Purchase
Currently, after Stripe checkout completes and redirects to `/guest-pass?purchase=success`, the page just shows a brief toast notification and immediately re-renders the purchase form. There's no confirmation page, no "thank you", no address, no next steps.

---

### Changes

**1. Success Confirmation View** (in `src/pages/GuestPass.tsx`)

When `?purchase=success` is detected, instead of showing a toast and the form, render a dedicated confirmation view:

- "Thank You" heading with a checkmark icon
- "We look forward to welcoming you" message
- Storm Wellness Club address and hours
- "What to expect on your visit" quick guide (bring ID, arrive early, etc.)
- A "View My Passes" button (links to member portal or back to home)
- A "Purchase Another Pass" link to reset back to the form

**2. Improve Waiver Gate UX for Logged-In Users** (in `src/components/WaiverRequiredAlert.tsx`)

The current alert says "Create an account or sign in" as step 1, which is confusing for users who are already signed in. Update the component to:

- Accept an optional `isLoggedIn` prop
- When logged in, skip the "create an account" step and show a direct link to `/member/waivers`
- Change button text to "Go to Waivers" instead of "Sign In & Go to Waivers"

**3. Pass auth state through InlineWaiverGate** (in `src/components/InlineWaiverGate.tsx`)

- The gate already has access to user profile, so pass `isLoggedIn={!!profile}` to `WaiverRequiredAlert`

---

### Technical Details

| File | Changes |
|------|---------|
| `src/pages/GuestPass.tsx` | Add `purchaseSuccess` state from URL params. When true, render a confirmation view with address, next steps, and navigation options instead of the form. |
| `src/components/WaiverRequiredAlert.tsx` | Add `isLoggedIn` prop. Conditionally adjust the instruction steps and button text. |
| `src/components/InlineWaiverGate.tsx` | Pass `isLoggedIn` to `WaiverRequiredAlert`. |

