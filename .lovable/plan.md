

# Member Activation Email System Implementation

## ✅ IMPLEMENTATION COMPLETE

## Overview
Create a new email workflow that allows admins to send activation setup emails to members with `pending_activation` status. The email will instruct members to:
1. **Create an account** using the same email they applied with
2. **Add a payment card** for their membership billing
3. **Sign the membership agreement**

---

## Implementation Status

| Component | Status |
|-----------|--------|
| DB column `activation_email_sent_at` | ✅ Complete |
| Email template `member_activation_setup` | ✅ Complete |
| Individual email action in Members.tsx | ✅ Complete |
| Bulk email action in Members.tsx | ✅ Complete |
| Status filter in Members.tsx | ✅ Complete |
| Email Sent column in Members table | ✅ Complete |
| Activation status card in MemberDetail.tsx | ✅ Complete |
| Send activation email button in MemberDetail.tsx | ✅ Complete |

---

## Current State Analysis

### Database Status (20 pending_activation members):
- **7 have cards on file** (card_last4 not null)
- **10 have initiation fees paid** (annual_fee_paid_at not null)
- **13 have NO Stripe customer ID** yet (need to create account first)

### Existing Related Email Templates:
- `add_card_for_dues` - Sent after initiation fee is paid (not ideal for pre-launch)
- `application_approved_pre_launch` - Basic approval notice

### Key Fields to Track:
- `members.card_last4` - Has card on file
- `members.stripe_customer_id` - Has Stripe customer
- `profiles.membership_agreement_signed` - Has signed agreement

---

## Implementation Plan

### Step 1: Add New Email Template
**File:** `supabase/functions/send-email/index.ts`

Add `member_activation_setup` email type with:
- Clear February 9th deadline messaging
- Instruction to create account with the SAME EMAIL they applied with (highlighted prominently)
- Visual checklist: Card + Agreement requirements
- Two action buttons: "Add Payment Method" and "Sign Agreement"
- Dynamic status showing what's already completed

### Step 2: Add Email Tracking Column
**Database Migration:**
```sql
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS activation_email_sent_at timestamptz;
```

### Step 3: Add Individual Email Action to Member Detail Page
**File:** `src/pages/admin/MemberDetail.tsx`

Add a prominent "Send Activation Email" button in the header section that:
- Shows current setup status (card on file? agreement signed?)
- Sends the activation email with one click
- Updates `activation_email_sent_at` timestamp
- Shows toast confirmation

### Step 4: Add Bulk Email UI to Members Page
**File:** `src/pages/admin/Members.tsx`

Add:
- Filter for "Pending Activation" members
- Individual dropdown action: "Send Activation Email"
- Bulk action button: "Send Activation Emails to All Pending"
- Progress indicator during batch send
- Visual indicator showing who has been emailed

---

## Email Template Content

**Subject:** Action Required: Complete Your Membership Setup - Storm Wellness Club

**Content includes:**
1. Personalized greeting
2. Clear deadline: "We open February 9th"
3. **Prominent email reminder** (highlighted blue box):
   - "Create your account using: [their_email]"
   - "This is the same email you applied with"
4. What they need to do (checklist):
   - [ ] Create/sign in to member account
   - [ ] Add payment method for membership dues
   - [ ] Sign membership agreement
5. Two action buttons:
   - Primary: "Complete Your Setup" → `/auth`
   - Secondary: "Sign Agreement" → `/member/waivers` (after login)
6. Deadline warning with visual urgency

---

## UI Changes

### Members Page (Admin)
```
┌─────────────────────────────────────────────────────────────┐
│  Members (20)                  [Send Activation Emails ▼]   │
├─────────────────────────────────────────────────────────────┤
│  [Filter: Pending Activation ▼]  [Billing Type ▼]          │
├─────────────────────────────────────────────────────────────┤
│  Name              Status              Email Sent   Actions │
│  Jane Doe          Pending Activation  ✓ Sent       [···]   │
│  John Smith        Pending Activation  —            [···]   │
└─────────────────────────────────────────────────────────────┘
```

### Member Detail Page (Admin)
```
┌─────────────────────────────────────────────────────────────┐
│  ← Back   Jane Doe                                          │
│           Pending Activation                                │
├─────────────────────────────────────────────────────────────┤
│  Activation Status                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✓ Stripe Customer Created                           │   │
│  │ ✓ Card on File (Visa •••• 4242)                     │   │
│  │ ✗ Membership Agreement Not Signed                   │   │
│  │                                                      │   │
│  │ [Send Activation Email]  Last sent: Feb 3, 2026    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

1. **`supabase/functions/send-email/index.ts`**
   - Add `member_activation_setup` email type to the union
   - Add email template with checklist and Feb 9th deadline

2. **Database Migration**
   - Add `activation_email_sent_at` column to members table

3. **`src/pages/admin/Members.tsx`**
   - Add "Send Activation Email" to dropdown menu
   - Add bulk send button for pending_activation members
   - Add visual indicator for email sent status
   - Fetch `activation_email_sent_at` in the query

4. **`src/pages/admin/MemberDetail.tsx`**
   - Add activation status card showing setup progress
   - Add "Send Activation Email" button with send date
   - Join with profiles to check agreement status

---

## Key Email Copy

**Email reminder text (will be prominently displayed):**

> **📧 Important: Create your account with this email address**
> 
> **[member@email.com]**
> 
> This is the same email you used when applying. Using a different email will prevent your membership from being linked automatically.

---

## Expected Flow

1. Admin goes to `/admin/members`
2. Filters by "Pending Activation" 
3. Clicks "Send Activation Emails" button
4. Confirmation dialog shows count: "Send to 13 pending members?"
5. Emails sent with progress toast
6. Table updates to show "Email Sent" badges

### Member receives email:
1. Opens email with clear Feb 9th deadline
2. Sees their email address highlighted (to use for account)
3. Clicks "Complete Your Setup" → goes to `/auth`
4. Creates account with their application email
5. System auto-links their member record
6. Navigates to Payment Methods → adds card
7. Navigates to Waivers → signs membership agreement
8. Ready for admin activation on Feb 9th

