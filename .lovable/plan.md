

# Fix: Referral Email Not Sending from Member Portal

## Problem

When a member submits a referral from their `/member/referrals` page, the `submitReferral` mutation in `useReferralData.ts` only inserts a row into the `member_referrals` table — it **never sends an email** to the referred friend. There is no `send-referral-invite` edge function and no call to `send-email` after the insert.

## Solution

After successfully inserting the referral record, invoke the existing `send-email` edge function to send a branded invitation email to the referred friend. This uses the member's referral code to build a personalized invite link.

### Changes

**1. `src/hooks/useReferralData.ts`** — Add email send after insert

In the `submitReferral` mutation, after the successful insert into `member_referrals`, call `supabase.functions.invoke('send-email')` with a new email type `referral_invite` containing:
- The referred friend's email
- The referring member's first name
- Their referral code
- The referral link (`https://stormwellnessclub.com/apply?ref=CODE`)

**2. `supabase/functions/send-email/index.ts`** — Add `referral_invite` email type

Add a new case `'referral_invite'` to the send-email function that renders a branded invitation email with:
- Greeting mentioning who referred them
- Value proposition for Storm Wellness Club
- Prominent CTA button linking to the referral URL
- Storm Wellness Club branding (Smoked Umber / Limestone Haze palette)

Also add `'referral_invite'` to the `EmailRequest.type` union.

### No database changes needed.

