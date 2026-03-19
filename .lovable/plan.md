

## Plan: Kids Care Pass Purchase Flow in Member Portal

### Current State
- Kids Care pass purchase only exists on the public `/kids-care` page
- It opens Stripe Checkout in a **new browser tab** — takes users out of the portal
- The member sidebar has "Kids Care" linking to bookings, but no way to buy a pass from within the portal
- Agreement signing already works in-portal via `/member/waivers`

### What We'll Build

#### 1. New Member Page: `/member/kids-care`
A dedicated Kids Care hub in the member portal that combines:
- **Pass status**: Shows active pass with sessions remaining, or prompts to purchase
- **Purchase flow**: Inline Stripe Embedded Checkout (no redirect, no new tab)
- **Agreement check**: If Kids Care agreement isn't signed, shows the agreement inline with a sign button before allowing purchase
- **Child registration link**: After signing, links to `/member/kids-care-service-form`
- **Book session button**: Links to the booking modal or bookings page
- Mobile-friendly layout using existing card components

#### 2. Inline Stripe Embedded Checkout
Instead of `window.open(data.url, "_blank")`, use Stripe's `EmbeddedCheckoutProvider` + `EmbeddedCheckout` (same pattern as the non-member Recovery page). Steps:
- Call `stripe-payment` with `create_kids_care_checkout` but request an **embedded** client secret (add `mode: "embedded"` to the request body)
- Update the `stripe-payment` edge function to support `ui_mode: "embedded"` for kids care checkout, returning a `clientSecret` instead of a `url`
- Render `EmbeddedCheckout` inline in the portal page
- On completion, show success state and refresh pass data

#### 3. Update Edge Function (`stripe-payment`)
Add embedded mode support to the `create_kids_care_checkout` action:
- When `mode === "embedded"`, create the Checkout Session with `ui_mode: "embedded"` and `return_url` instead of `success_url`/`cancel_url`
- Return `{ clientSecret }` instead of `{ url }`

#### 4. Update Member Sidebar
- Change "Kids Care" link from `/member/kids-care-bookings` to `/member/kids-care` (the new hub)
- Add a sub-link or keep bookings accessible from the hub page

#### 5. Agreement Flow (Inline)
Before showing purchase, check `profile.kids_care_agreement_signed`:
- If not signed, show the agreement document with a "Sign Agreement" button (reuse existing `SimpleAgreementCard`)
- After signing, reveal the purchase section
- After purchase, show "Register Your Children" and "Book a Session" CTAs

### Files Changed

| File | Change |
|------|--------|
| **New**: `src/pages/member/KidsCare.tsx` | Kids Care hub with agreement check, inline Stripe checkout, pass status |
| `supabase/functions/stripe-payment/index.ts` | Add `ui_mode: "embedded"` support to `create_kids_care_checkout` |
| `src/components/member/MemberSidebar.tsx` | Update Kids Care link to `/member/kids-care` |
| `src/App.tsx` (or router) | Add route for `/member/kids-care` |

### Mobile-Friendly
- All components use existing responsive card/layout patterns
- Embedded Checkout is fully responsive by default
- Agreement cards already work on mobile
- Single-column layout for the entire flow

