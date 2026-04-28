# Make Payment Method Required at Application Time

Today the payment step on `/apply` is optional behind a checkbox. You want it **required** to submit, **collected inline without leaving the page**, and **linked to the applicant's profile** so it's ready the moment you approve them.

## What changes (`src/pages/Apply.tsx`)

### 1. Payment section becomes required and always-visible
- Rename heading from **"Payment Method (Optional)"** to **"Payment Method"** with a small red "Required" pill (matching Step 8 Acknowledgments style).
- Replace the subhead with:
  > A valid payment method is required to submit your application. Your card is saved securely — no charges are made until your membership is approved and activated.
- **Remove** the "I'd like to add a payment method now…" opt-in checkbox (lines 1241–1257).
- **Remove** the "You can always add a payment method later…" italic note (lines 1350–1354).
- The Stripe `PaymentElement` form (already inline via `StripeProvider` + `ApplicantPaymentFormInner`) becomes the default UI for this step. **No popup, no redirect, no new tab** — the user stays on `/apply` the entire time. This is already how `confirmSetup({ redirect: "if_required" })` is wired today; we're simply removing the gate around it.
- Auto-trigger the SetupIntent creation as soon as the user has filled in their email (so the card form is ready when they scroll to it), with a graceful "Enter your email above to continue" placeholder if email is empty.

### 2. Block submission without a saved card
In `handleSubmit` (currently lines 701–718), add a guard right after the acknowledgments check:
```ts
if (!cardSetupComplete || !cardCustomerId) {
  toast.error("Please add a payment method before submitting your application.");
  sectionRefs.current["payment"]?.scrollIntoView({ behavior: "smooth", block: "start" });
  return;
}
```
Also disable the **Submit Application** button when `!cardSetupComplete`, with hover text "Add a payment method to continue."

### 3. Link the saved card to the applicant's future profile
The card is already saved to a Stripe **Customer** (created by the `create_application_setup` action) and the `customerId` + payment method id are written to the `membership_applications` row at submit (lines 791–796). To guarantee it follows them into the member record on approval, we need to verify the approval path.

**Verification step during implementation:** open `src/pages/admin/Applications.tsx` (and the `approve_application` RPC / handler) and confirm that on approval it copies `stripe_customer_id` + `stripe_payment_method_id` from `membership_applications` onto the new `members` / `profiles` row and sets it as the customer's default payment method in Stripe. If that wiring is missing, add it in the same change so:
- The card-on-file is automatically the default for the dual subscriptions (monthly dues + annual fee).
- No "add a payment method" step is needed in the member portal post-approval.

### 4. Progress rail
`getStepCompletion(...)` already accepts `cardSetupComplete` — confirm the "Payment" step in the left-side checklist only marks complete when the card is saved (no-op if already correct).

## What does NOT change
- Stripe SetupIntent flow (`stripe-payment` edge function, `create_application_setup` action) — unchanged.
- `stripeRemountKey` stability pattern — unchanged.
- `ApplicationUnderReview.tsx` (post-submit screen) keeps its "add/replace card" affordance as a safety net for legacy applications.
- Database schema — no migration needed; `stripe_customer_id`, `stripe_payment_method_id`, `card_brand`, `card_last4`, `card_exp_month`, `card_exp_year` already exist on `membership_applications`.

## Result
Every new applicant must enter a valid card inline on `/apply` before **Submit Application** works. The card is stored on a Stripe Customer tied to their email and carried directly onto their member profile at approval — so when you approve them, dues and the annual fee can be charged immediately with zero extra steps for the member.
