

# Annual Fee Payment Link - Auto-Email Implementation

## Overview
Implement automatic email delivery when admins generate payment links for applicants, using Stripe Payment Links (no expiration) with 3-day urgency messaging.

## Email Content (Final Version)

The email will include:
- Personalized greeting with applicant's name
- 3-day urgency warning in a highlighted box
- Dynamic initiation fee amount based on applicant's tier
- Prominent "Complete Payment" button
- Updated closing: "...to **activate your member account** and welcome you to Storm Wellness Club"

## Technical Implementation

### Files to Modify

| File | Purpose |
|------|---------|
| `supabase/functions/stripe-payment/index.ts` | Replace Checkout Session with Payment Link + trigger email |
| `supabase/functions/send-email/index.ts` | Add `annual_fee_payment_request` email template |
| `supabase/functions/stripe-webhook/index.ts` | Handle Payment Link metadata for webhook processing |
| `src/pages/admin/Applications.tsx` | Update UI to confirm email was sent |

### 1. Update stripe-payment Edge Function

Replace `stripe.checkout.sessions.create()` with `stripe.paymentLinks.create()`:
- Payment Links don't expire (unlike Checkout Sessions' 24-hour limit)
- Include metadata for webhook processing
- After creating link, invoke `send-email` function automatically

### 2. Add Email Template

Add new case in send-email function for `annual_fee_payment_request`:
- Georgia font styling consistent with brand
- 3-day urgency warning box
- Dynamic fee amount from applicant data
- "Complete Payment" CTA button
- Updated closing text about activating member account

### 3. Update Webhook Handler

Modify `stripe-webhook` to retrieve Payment Link metadata:
- When `checkout.session.completed` fires, check for `payment_link` field
- Retrieve Payment Link to access metadata
- Process application update same as before

### 4. Update Admin UI

Enhance the payment link dialog in Applications.tsx:
- Show confirmation that email was sent to applicant
- Still display copyable link for manual sharing if needed
- Update toast message to confirm email delivery

## User Flow

**Admin:**
1. Clicks "Generate Payment Link" on approved application
2. System creates Payment Link + sends email automatically
3. Sees confirmation: "Payment link emailed to applicant@email.com"

**Applicant:**
1. Receives branded email with payment button
2. Has 3 days to complete payment (per club policy)
3. Clicks "Complete Payment" → Stripe Checkout
4. Completes payment → redirected to success page
5. Application automatically marked as paid

## Benefits

- Links never expire technically (Stripe Payment Links)
- 3-day urgency communicated via email content
- No manual copying/emailing by admin
- Consistent branded email experience

