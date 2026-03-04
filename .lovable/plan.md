

# Referral System Improvements: Name Tracking + Admin Notifications

## Current State

The referral tracking **does work** — there's a database trigger (`trg_check_referral_on_activation`) that fires when a member's status changes to `active`. It matches the new member's email against `member_referrals.referred_email` and auto-awards 500 points to the referrer. So the plumbing is there, but it's email-only matching and lacks visibility.

## Problems to Fix

1. **No name captured** — `member_referrals` only stores `referred_email`, making it hard to identify who was referred
2. **No admin notification** — staff don't know when a member submits a referral
3. **Fragile matching** — if the referred person signs up with a different email, the link is lost (we'll add referral code tracking to the application form as a secondary match)

## Changes

### 1. Database Migration — Add name columns + referral_code tracking

Add columns to `member_referrals`:
- `referred_first_name text`
- `referred_last_name text`

Also add a `referred_by_code` column to `members` table so when someone applies via a referral link (`?ref=CODE`), the code is stored on their member record. The activation trigger can then match by **either** email **or** referral code — solving the "different email" problem.

### 2. Update Member Referral Form (`Referrals.tsx`)

Replace the single email input with a 3-field form:
- First Name (required)
- Last Name (required)  
- Email (required)

Update `submitReferral` mutation to pass all three fields.

### 3. Update `useReferralData.ts`

Change `submitReferral` to accept `{ firstName, lastName, email }` instead of just a string. Insert all three fields into `member_referrals`.

### 4. Admin Notification on Referral Submit

After inserting the referral and sending the invite email, also send a notification email to admin (via `send-email` edge function with a new `referral_notification` type) so staff knows a member just referred someone.

### 5. Update Activation Trigger

Modify `check_referral_on_member_activation` to match by **either**:
- `LOWER(referred_email) = LOWER(NEW.email)` (existing)
- OR `referral_codes.code = NEW.referred_by_code` (new fallback)

### 6. Update Referral History Display

Show referred person's name in the referral history list (instead of just email).

### Files

| File | Action |
|------|--------|
| Database migration | Add `referred_first_name`, `referred_last_name` to `member_referrals`; add `referred_by_code` to `members`; update activation trigger |
| `src/hooks/useReferralData.ts` | Accept name fields in `submitReferral`, add admin notification call |
| `src/pages/member/Referrals.tsx` | Replace email-only input with first name + last name + email form |
| `supabase/functions/send-email/index.ts` | Add `referral_notification` type for admin alerts |

