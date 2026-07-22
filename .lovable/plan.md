## What's broken

A visitor who lands on `/class-passes` (via nav, footer, `/schedule` → BookingModal, etc.) and clicks a price gets a toast that says "Please sign in to purchase class passes" and nothing happens — the buttons just error out. That's the dead-end you're describing. From `src/pages/ClassPasses.tsx` line 386:

```ts
if (!user) {
  toast.error("Please sign in to purchase class passes");
  return;
}
```

The "Sign In / Create Free Account" links lower on the page take them to `/auth`, which drops them out of the buying flow — they land on a login screen with no memory of what they were trying to buy, and most never come back.

Passes must attach to an account (so credits can be redeemed at booking), so we can't do a true anonymous checkout — but we can make the account step feel like part of checkout instead of a wall.

## Plan

1. **Inline sign-up drawer on `/class-passes`** — when a guest clicks a price:
   - Open a bottom sheet (mobile) / modal (desktop) titled "Create your account to check out" with First name, Last name, Email, Phone, Password.
   - Submit creates a Supabase auth user, seeds a `non_member_profiles` row (same as current non-member onboarding), then automatically resumes `handlePurchase(category, passType)` — no page reload, no re-click.
   - Existing users get a "Already have an account? Sign in" toggle inside the same sheet that logs them in and resumes the purchase the same way.

2. **Persist the pending purchase across auth** — stash `{category, passType}` in `sessionStorage` before opening the sheet so a hard refresh or email-confirmation bounce still resumes checkout on return.

3. **Fix the "just errors out" UX** — replace the `toast.error` early-return with opening the sheet, so no click is ever a dead end.

4. **Same treatment on `BookingModal`** — currently when a non-member tries to book with no passes, it does `navigate("/class-passes")`. Change it to open the same inline purchase drawer in place so they never leave the schedule.

5. **Public entry visibility** — add a prominent "Buy a class pass" button to `/schedule` header so drop-in visitors have an obvious CTA without hunting through the nav.

6. **Waivers stay inline** — the existing inline waiver/agreement signing flow already works for non-members (recent fix); no changes needed there. It will trigger automatically after the new account is created, before Stripe checkout opens.

## Technical notes

- New component: `src/components/class-passes/GuestCheckoutSheet.tsx` — wraps the sign-up form + resume logic; reused by `ClassPasses.tsx` and `BookingModal.tsx`.
- Reuse the existing non-member signup path in `AuthContext` / `useNonMemberProfile` — don't fork auth logic.
- After `signUp`, wait for `useAuth().user` to hydrate (or use the returned session) before calling `handlePurchase`, so the Stripe edge function sees the auth header.
- `sessionStorage` key: `pendingClassPassPurchase = { category, passType, ts }`, cleared on success/cancel return.
- No schema changes. No edge function changes. No changes to member-facing `/portal/book/class` (already handled by `BuyPassesDrawer`).

## Out of scope

- True anonymous/guest checkout with no account (passes need an owner to redeem).
- Changes to member pricing, Stripe products, or the waiver system.
