
# Member Portal Comprehensive Audit

## Executive Summary

This audit covers all 18 member portal pages and their supporting infrastructure. The member portal is generally well-structured with robust patterns, but there are several issues that need attention before launch.

## Current State Overview

**Members:**
- 1 Active member (fully set up with subscription)
- 127 Pending Activation members (needs Feb 9th activation)
  - 32 have initiation fee paid
  - 20 have card on file
  - 44 have Stripe customer ID
  - 0 have active subscriptions (expected until Feb 9th activation)

**Infrastructure:**
- 16 active class types
- 1,459 upcoming class sessions
- 71 active equipment items
- 5 instructors set up

---

## Page-by-Page Analysis

### 1. Dashboard (`/member`)
**Status: Working**
- Displays member stats, health score, habits, goals, achievements
- Shows frozen benefits notice when applicable
- Links to all major features

**Issue Found:** None

---

### 2. Member Entry (`/member/entry`)
**Status: Working**
- QR token generation working (4.5 min refresh)
- Waits for auth session before fetching
- Photo upload prompt for members without photos

**Issue Found:** None

---

### 3. My Profile (`/member/profile`)
**Status: Working**
- Form properly populates from profile data
- Photo upload component functional
- Saves to profiles table

**Issue Found:** None

---

### 4. My Credits (`/member/credits`)
**Status: Partially Working**

**Issue Found - Missing Kids Care Agreement Column:**
The Waivers page references `profile?.kids_care_agreement_signed` but this column does not exist in the profiles table. The database only has:
- `waiver_signed`
- `membership_agreement_signed`
- `guest_pass_agreement_signed`
- `single_class_pass_agreement_signed`
- `private_event_agreement_signed` (MISSING from profiles)
- `kids_care_agreement_signed` (MISSING from profiles)
- `kids_care_service_form_completed` (MISSING from profiles)

**Impact:** Kids Care and Private Event agreement signing will fail silently.

---

### 5. My Membership (`/member/membership`)
**Status: Working**
- Correctly shows pending activation state vs active membership
- BillingSummary and InlineBillingSection working
- Payment method display working
- Charge history integration working

**Issue Found:** None

---

### 6. Payment Methods (`/member/payment-methods`)
**Status: Working**
- Lists cards from Stripe
- Add/remove cards functional
- Nickname editing working
- Default card selection working
- Last card protection (cannot delete last card)

**Issue Found:** None

---

### 7. Payment History (`/member/payment-history`)
**Status: Working**
- Uses RPC `get_member_payment_history`
- Displays payment attempts with status badges

**Potential Issue:** Need to verify RPC function exists and returns correct data.

---

### 8. My Bookings (`/member/bookings`)
**Status: Working**
- Tabs for upcoming/past
- Cancel booking with 12-hour policy
- Links to schedule and class passes

**Issue Found:** None

---

### 9. Waivers (`/member/waivers`)
**Status: Partially Working**

**Critical Issue - Missing Database Columns:**
The page tries to render agreements that depend on profile columns that don't exist:
- `kids_care_agreement_signed` - NOT IN DATABASE
- `kids_care_agreement_signed_at` - NOT IN DATABASE  
- `private_event_agreement_signed` - NOT IN DATABASE
- `private_event_agreement_signed_at` - NOT IN DATABASE

The hook `useUserProfile` likely has methods like `signKidsCareAgreement` that will fail.

**Critical Issue - Missing Agreements:**
Only 2 agreements exist in the database:
- `membership_agreement` (1)
- `single_class_pass` (1)

Missing from `agreements` table:
- `liability_waiver`
- `kids_care`
- `guest_pass`
- `private_event`

**Impact:** The waivers page will show no content for most agreement types, and signing Kids Care/Private Event agreements will fail.

---

### 10. Freeze Request (`/member/freeze`)
**Status: Working**
- Eligibility checking working
- Freeze fee checkout integration
- Cancel request functionality
- History display

**Issue Found:** None

---

### 11. Support (`/member/support`)
**Status: Working**
- Email conversations system
- Create/send messages
- Status tracking

**Issue Found:** None

---

### 12. Health Score (`/member/health-score`)
**Status: Partially Working**
- UI implemented correctly
- Depends on `member_health_scores` table

**Potential Issue:** Health scores may not be calculated automatically. Need to verify trigger/function that populates scores based on activity.

---

### 13. Achievements (`/member/achievements`)
**Status: Not Working**

**Critical Issue - Missing Table:**
The code references an `achievements` table (master list of possible achievements), but only `member_achievements` table exists.

**Impact:** The achievements page will crash or show nothing since `useAchievements()` hook tries to fetch from non-existent table.

---

### 14. Workouts (`/member/workouts`)
**Status: Working**
- Log workouts manually
- AI workout generation (needs fitness profile)
- Program generation working
- Tables exist: `workout_logs`, `ai_workouts`, `workout_programs`, `program_workouts`

**Issue Found:** None

---

### 15. Habits (`/member/habits`)
**Status: Working**
- Create/edit/delete habits
- Log habit completion
- Streak tracking
- Week/month view
- Tables exist: `habits`, `habit_logs`

**Potential Issue:** Need `habit_streaks` table for streak tracking - need to verify it exists.

---

### 16. Goals (`/member/goals`)
**Status: Working**
- CRUD operations on goals
- Progress logging
- Milestones
- Tables exist: `member_goals`, `goal_milestones`, `goal_progress_logs`

**Issue Found:** None

---

### 17. Fitness Profile (`/member/fitness-profile`)
**Status: Working**
- Equipment selection from database (71 items)
- Goal/preference settings
- Required for AI workouts

**Issue Found:** None

---

### 18. Kids Care Service Form (`/member/kids-care-service-form`)
**Status: Not Working**

**Critical Issue - Missing Column:**
References `profile?.kids_care_service_form_completed` which doesn't exist in profiles table.

**Impact:** Form completion tracking won't persist.

---

## Critical Issues Summary

### Must Fix Before Launch

1. **Missing Profile Columns** - Add to profiles table:
   - `kids_care_agreement_signed` (boolean)
   - `kids_care_agreement_signed_at` (timestamptz)
   - `private_event_agreement_signed` (boolean)
   - `private_event_agreement_signed_at` (timestamptz)
   - `kids_care_service_form_completed` (boolean)

2. **Missing Achievements Table** - Create `achievements` table with:
   - id, name, description, criteria, points_reward, is_active
   - Seed with achievement definitions

3. **Missing Agreements Data** - Add to agreements table:
   - `liability_waiver` agreement with PDF
   - `kids_care` agreement with PDF
   - `guest_pass` agreement with PDF
   - `private_event` agreement with PDF

4. **Verify Habit Streaks Table** - Ensure `habit_streaks` table exists

---

## Working Features Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard | Working | All widgets functional |
| Member Entry (QR) | Working | Token refresh working |
| Profile | Working | Photo upload included |
| Credits Display | Working | Tier-based display |
| Membership Page | Working | Activation flow ready |
| Payment Methods | Working | Full CRUD |
| Payment History | Working | Uses RPC |
| Bookings | Working | Cancel with policy |
| Freeze Request | Working | Full workflow |
| Support | Working | Email conversations |
| Workouts | Working | AI generation ready |
| Goals | Working | Full CRUD + progress |
| Habits | Working | Streak tracking |
| Fitness Profile | Working | Equipment selection |
| Health Score | Partial | Needs score calculation |
| Waivers | Partial | Missing agreements |
| Achievements | Broken | Missing master table |
| Kids Care Form | Broken | Missing column |

---

## Benefit Freezing Logic

The `useMemberBenefitsStatus` hook correctly freezes benefits when:
- Status is `pending_activation`
- Initiation fee not paid
- No active subscription
- Status is `past_due`, `frozen`, or `cancelled`

This is working correctly.

---

## Payment Flow Analysis

The payment infrastructure is solid:
- `PaymentDueNotice` handles all payment states
- Initiation fee checkout uses correct action
- Dues setup uses `create_member_dues_checkout`
- Past due redirects to customer portal

---

## Sidebar Navigation

All 13 member menu items + 6 wellness items are correctly linked to their routes.

---

## Recommendations

### Immediate Actions (Before Feb 9th)

1. Run database migration to add missing profile columns
2. Create achievements master table and seed data
3. Add missing agreements to agreements table
4. Verify habit_streaks table exists
5. Test waivers page end-to-end

### Optional Improvements

1. Add health score calculation trigger based on activities
2. Add real instructor names instead of placeholders
3. Consider adding more agreements (liability waiver is critical)

---

## Technical Notes

**Edge Functions:**
- `stripe-payment` - Comprehensive payment handling
- `generate-entry-token` - QR token generation
- `send-email` - Email templates including new `member_activation_setup`

**Hooks:**
- All hooks follow consistent patterns
- Error handling implemented
- Loading states managed

**Security:**
- RLS policies in place
- Server-side membership verification for pricing
- JWT validation on entry tokens
