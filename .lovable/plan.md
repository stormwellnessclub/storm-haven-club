

# Referral Portal: Premium Messaging + Points-Only-When-Paid Logic

## Current State

**UI:** The referral page opens with a points hero card and "Share your code with friends. You earn 500 points when they become active members!" — feels transactional and salesy.

**Points Logic:** The trigger `check_referral_on_member_activation` fires when a member's status changes to `active`. However, a member can be set to `active` before their first Stripe invoice is actually paid (e.g., during admin onboarding). The trigger does NOT verify `subscription_status = 'active'` or that a valid `stripe_subscription_id` exists. This means points could be awarded before the referred person is genuinely paying.

## Changes

### 1. Update referral page banner (`src/pages/member/Referrals.tsx`)

Replace the current points hero card and "Your Referral Code" card description with a premium intro banner at the top of the page containing the provided copy:

> *Storm Wellness Club grows thoughtfully through the introductions of its members...*

The referral code card description changes from "Share your code with friends. You earn 500 points when they become active members!" to something like "Extend a private introduction to someone who shares the Storm ethos."

### 2. Fix trigger to require paid status (database migration)

Update `check_referral_on_member_activation()` to add a guard:

```sql
-- Only award if member has an active, paying subscription
IF NEW.subscription_status = 'active' AND NEW.stripe_subscription_id IS NOT NULL THEN
  -- proceed with award
END IF;
```

This ensures points are only awarded when the referred person has both `status = 'active'` AND `subscription_status = 'active'` with a valid Stripe subscription — meaning they are genuinely paying.

For founding members (who may not have `subscription_status = 'active'` in the same way), the trigger will also check `is_founding_member = true` as an alternative qualifier.

### Files to modify
- `src/pages/member/Referrals.tsx` — add premium intro banner, update card descriptions
- Database migration — update `check_referral_on_member_activation()` to require `subscription_status = 'active'` + `stripe_subscription_id IS NOT NULL` (or `is_founding_member = true`)

