

# Member Referral Rewards System

## Overview

A referral program where members earn points when people they refer sign up as paying members. Points accumulate and can be redeemed for club services (spa, classes, cafe, etc.).

---

## How It Works (Member Experience)

### 1. Sharing a Referral
- Each member gets a **unique referral code** (e.g., `STM-REF-JOHN42`) visible on a new **"Refer a Friend"** page in the member portal
- They can **copy** their code or **share a link** (e.g., `storm-haven-club.lovable.app/join?ref=STM-REF-JOHN42`)
- The referral link takes prospects to a landing page or the membership application form with the code pre-filled

### 2. Earning Points
- When a referred person **signs up and becomes an active paying member**, the referring member earns **500 referral points**
- Points are awarded automatically when the new member's status changes to `active` (meaning they've paid)
- Members can also earn **bonus milestone rewards**:
  - 3 successful referrals = **200 bonus points**
  - 5 successful referrals = **500 bonus points**
  - 10 successful referrals = **1,000 bonus points** + "Ambassador" badge

### 3. Redeeming Points
Members can exchange points for services from their portal:

| Reward | Points Cost |
|--------|------------|
| 1 Red Light Therapy Session | 300 pts |
| 1 Dry Cryo Session | 400 pts |
| 1 Class Credit | 250 pts |
| 1 Guest Pass | 200 pts |
| Cafe Credit ($10) | 500 pts |
| Spa Service Discount (20%) | 750 pts |

### 4. Member Portal Page ("Refer a Friend")
- Your referral code + copy/share buttons
- Points balance
- Referral history (who you referred, status, points earned)
- Rewards catalog with redeem buttons
- Milestone progress tracker

---

## Technical Plan

### Database Changes (3 new tables + 1 column update)

**Table: `referral_codes`**
- `id` (uuid, PK)
- `member_id` (uuid, FK to members)
- `code` (text, unique) -- e.g., "STM-REF-JOHN42"
- `created_at` (timestamptz)

**Table: `member_referrals`**
- `id` (uuid, PK)
- `referring_member_id` (uuid, FK to members)
- `referred_email` (text) -- email of the person referred
- `referred_member_id` (uuid, nullable, FK to members) -- linked when they sign up
- `status` (text) -- 'pending', 'signed_up', 'active', 'expired'
- `points_awarded` (integer, default 0)
- `points_awarded_at` (timestamptz, nullable)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Table: `referral_point_transactions`**
- `id` (uuid, PK)
- `member_id` (uuid, FK to members)
- `points` (integer) -- positive = earned, negative = redeemed
- `transaction_type` (text) -- 'referral_signup', 'milestone_bonus', 'redemption'
- `description` (text)
- `reference_id` (uuid, nullable) -- links to referral or redemption
- `created_at` (timestamptz)

**Column update on `members` table:**
- Add `referral_points_balance` (integer, default 0) -- cached balance for quick display

### RLS Policies
- Members can view their own referral codes, referrals, and point transactions
- Staff roles can view/manage all records
- Points balance updates via database function only (not direct client writes)

### Database Functions
1. **`generate_referral_code(member_id)`** -- creates a unique code for a member
2. **`award_referral_points(referring_member_id, referred_member_id)`** -- awards points when a referral converts, checks for milestone bonuses
3. **`redeem_referral_points(member_id, reward_type, points_cost)`** -- validates balance, deducts points, provisions the reward (creates credit/pass)

### Database Trigger
- On `members` table: when `status` changes to `active`, check if this member's email matches any pending referral and auto-award points

### Frontend Components
1. **New page: `/member/referrals`** -- "Refer a Friend" page with code, history, points, and rewards catalog
2. **Sidebar update** -- Add "Refer a Friend" item with a `Users` icon in the member menu
3. **Referral code capture** -- Update the membership application / signup flow to accept a referral code field
4. **Admin visibility** -- Add referral stats to the admin member detail view

### Edge Function (optional, phase 2)
- Send notification email to referring member when their referral signs up and they earn points

