
# Phase 1 Membership Activation System - Complete Implementation Plan

## Executive Summary

This plan implements the pre-paid member onboarding workflow for Storm Wellness Club's February 9th, 2026 opening. It addresses:
1. **Founding Member Exclusive Perks** (including Diamond-specific benefits)
2. **One-Time Tier Change** (members can switch before locking in)
3. **Duplicate Account Prevention** (CRITICAL for launch)
4. **Card Metadata Sync Failure Handling** (CRITICAL)
5. **Pre-Paid Member Onboarding Flow** (Phase 1 email workflow)

---

## Part 1: Founding Member Benefits Structure

### Diamond Founding Member Perks
- Personalized Storm Wellness Club sweater (founding members only - exclusive design)
- Diamond Member personalized gym bag
- VIP amenity kit with premium products
- Diamond member personalized clothing line
- Priority booking for ALL classes and events

### Regular Diamond Member Perks
- Diamond member personalized clothes
- Diamond member gear package  
- VIP amenity kit
- Priority booking for all classes and events

### All Other Founding Members (Silver/Gold/Platinum)
- Personalized Storm Wellness Club sweater (founding members only)
- Personalized gear package
- Priority booking for all classes and events

---

## Part 2: Database Changes

### New Columns for `members` Table

```sql
-- Founding member perks tracking
ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS founding_privileges_granted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS founding_privileges_granted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS founding_perks_delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS founding_sweater_size TEXT,
ADD COLUMN IF NOT EXISTS founding_bag_size TEXT;

-- One-time tier change tracking
ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS tier_change_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tier_change_used_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS original_tier_at_application TEXT;
```

### New Table: `member_perk_deliveries`

```sql
CREATE TABLE IF NOT EXISTS public.member_perk_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  perk_type TEXT NOT NULL, -- 'sweater', 'bag', 'amenity_kit', 'clothing'
  perk_variant TEXT, -- 'diamond', 'founding', 'regular'
  size TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'ordered', 'shipped', 'delivered'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### New Table: `card_sync_failures` (CRITICAL)

```sql
CREATE TABLE IF NOT EXISTS public.card_sync_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id),
  stripe_customer_id TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Duplicate Prevention Constraints

```sql
-- Unique constraint on email (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_email_unique 
ON public.members (LOWER(email));

-- Unique constraint on active applications
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_active_email 
ON public.membership_applications (LOWER(email)) 
WHERE status NOT IN ('rejected', 'cancelled');
```

---

## Part 3: One-Time Tier Change Feature

### Member Portal Flow

**Location**: `src/pages/member/Membership.tsx` (pending_activation state)

**UI Components**:
1. Alert banner: "You have one opportunity to change your membership tier before activation"
2. Tier comparison card showing current vs. available tiers with pricing
3. Confirm dialog with initiation fee difference info
4. Success: "Your tier has been updated. This change is final."

### Business Rules

| Current State | Action | Result |
|---------------|--------|--------|
| `tier_change_used = false` | Member clicks "Change Tier" | Show tier selection UI |
| Member selects new tier | Confirm | Update `membership_type`, set `tier_change_used = true` |
| `tier_change_used = true` | Member views page | Hide tier change option, show "Tier locked" message |

---

## Part 4: Duplicate Account Prevention (CRITICAL)

### Prevention Measures

1. **Auth Flow** (`src/pages/Auth.tsx`): Check for existing applications/members before account creation
2. **Application Submission** (`src/pages/Apply.tsx`): Block duplicate submissions with same email
3. **Stripe Customer**: Check for existing customer by email before creating new one
4. **Database Constraints**: Unique indexes on email fields

---

## Part 5: Card Metadata Sync Failure Handling (CRITICAL)

### Multi-Layer Protection

1. **Frontend Retry**: Exponential backoff (3 attempts) on sync failure
2. **Failure Logging**: Track all failures in `card_sync_failures` table
3. **Admin Dashboard Alert**: Widget showing unresolved sync failures
4. **Pre-Billing Check**: Verify all active members have card data before billing date

---

## Part 6: Phase 1 Email Template

### New Template: `phase_one_setup`

For pre-paid members who need to complete setup:
- Highlights their confirmed tier
- Shows founding member perks (Diamond Founding vs Regular Founding)
- Lists setup steps: account creation, card save, agreement signing
- Optional tier change reminder
- Clear statement: "First charge: February 9th, 2026"

---

## Part 7: Updated Benefits Display

### Changes to `getMembershipTierBenefits()`

```typescript
export function getMembershipTierBenefits(
  tier: string, 
  isFoundingMember: boolean = false
): string[] {
  const baseBenefits = tierBenefits[matchedTier] || tierBenefits["Silver"];
  const isDiamond = matchedTier === "Diamond";
  
  if (isDiamond && isFoundingMember) {
    return [
      ...baseBenefits,
      "---",
      "Diamond Founding Member Exclusives:",
      "Personalized Storm Wellness Club sweater (exclusive founding design)",
      "Diamond Member personalized gym bag",
      "VIP amenity kit with premium products",
      "Diamond member personalized clothing line",
      "Priority booking for ALL classes and events",
    ];
  }
  
  if (isDiamond) {
    return [
      ...baseBenefits,
      "---",
      "Diamond Member Perks:",
      "Diamond member personalized clothes",
      "Diamond member gear package",
      "VIP amenity kit",
      "Priority booking for all classes and events",
    ];
  }
  
  if (isFoundingMember) {
    return [
      ...baseBenefits,
      "---",
      "Founding Member Perks:",
      "Personalized Storm Wellness Club sweater (founding members only)",
      "Personalized gear package",
      "Priority booking for all classes and events",
    ];
  }
  
  return baseBenefits;
}
```

---

## Part 8: Implementation Priority

### CRITICAL (Must Complete Before Launch)

| Task | Risk if Not Done |
|------|------------------|
| Card sync failure retry + alerts | Lost revenue, no visibility |
| Duplicate account prevention | Billing chaos, support overhead |
| Phase 1 email template | Can't onboard pre-paid members |
| Database migrations | Features won't work |

### HIGH (Complete This Week)

| Task | Impact |
|------|--------|
| One-time tier change UI | Member frustration, support tickets |
| Founding member perks display | Member expectations not met |
| Admin "Send Phase 1" action | Manual process required |

---

## Part 9: Files to Create/Modify

### New Files
- `src/components/member/TierChangeCard.tsx` - One-time tier change UI
- `src/components/admin/CardSyncFailuresWidget.tsx` - Dashboard alert widget
- `src/hooks/useCardSyncStatus.ts` - Track sync failures

### Modified Files

| File | Changes |
|------|---------|
| `supabase/migrations/` | Add new columns and tables |
| `supabase/functions/send-email/index.ts` | Add `phase_one_setup` template |
| `supabase/functions/stripe-payment/index.ts` | Add `member_self_tier_change`, enhance sync retry |
| `src/hooks/useUserMembership.ts` | Update `getMembershipTierBenefits()` with founding/diamond perks |
| `src/pages/member/Membership.tsx` | Add tier change card, founding perks display |
| `src/pages/admin/Members.tsx` | Add "Send Phase 1 Email" action |
| `src/pages/admin/Dashboard.tsx` | Add card sync failures widget |
| `src/pages/Auth.tsx` | Add duplicate account prevention checks |
| `src/pages/Apply.tsx` | Add duplicate application check |
| `src/components/member/MemberOnboardingChecklist.tsx` | Add tier change task if available |

---

## Part 10: Testing Checklist

### Pre-Paid Member Flow
- Admin marks initiation fee as paid
- Admin sends Phase 1 email
- Member receives email with correct perks section
- Member creates account with application email
- Member sees tier change option (one-time)
- Member changes tier successfully
- Tier change option disappears after use
- Member adds card (no immediate charge)
- Card metadata syncs to database
- Member signs agreements
- Checklist shows 100% complete

### Duplicate Prevention
- Try to apply with existing application email - blocked
- Try to create account that conflicts - clear messaging
- Stripe customer lookup finds existing customer

### Card Sync Failure
- Simulate sync failure - logged to database
- Retry mechanism works
- Admin dashboard shows alert
- "Retry All" button works

### Founding Member Perks
- Diamond Founding sees exclusive perks list (no concierge service)
- Regular Founding sees founding perks
- Non-founding Diamond sees Diamond perks
- Regular member sees standard benefits only
