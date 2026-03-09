

# Abandoned Applications: Recovery System

## Problem
The application flow only saves to `membership_applications` **after** card setup succeeds. People who start the card setup but abandon it are recorded in `card_setup_attempts` (with name/email in `metadata`) but have **no application record**. These are lost leads you can't see or follow up on.

## What We Have
The `card_setup_attempts` table stores `metadata` with `applicant_email` and `applicant_name` for every "initiated" attempt. We can use this to:
1. Show an "Abandoned" tab in the Applications page
2. Send automated follow-up reminder emails

## Plan

### 1. Add "Abandoned Applications" Tab to Applications Page
**File: `src/pages/admin/Applications.tsx`**

- Add a tab/filter option for "Abandoned" alongside the existing status filters (Pending, Approved, Rejected, Cancelled)
- When "Abandoned" is selected, query `card_setup_attempts` where `status IN ('initiated', 'abandoned')` and `application_id IS NULL` (no linked application = never completed)
- Display: name, email, date initiated, source — all pulled from `card_setup_attempts.metadata`
- Show total count in the tab badge
- Add a "Send Reminder" button per row and a bulk "Send Reminder" action

### 2. Create Follow-Up Reminder Edge Function
**New file: `supabase/functions/send-application-reminder/index.ts`**

- Accepts `email`, `name` as input
- Sends a reminder email via the transactional email system encouraging them to complete their application
- Includes a direct link back to the Apply page
- Records that a reminder was sent (to avoid spamming)

### 3. Database: Track Reminder Sends
**Migration: Add `reminder_sent_at` and `reminder_count` columns to `card_setup_attempts`**

- `reminder_sent_at TIMESTAMPTZ` — when the last reminder was sent
- `reminder_count INTEGER DEFAULT 0` — how many reminders sent
- This prevents sending duplicate reminders and shows follow-up status in the admin UI

### 4. Save Application Earlier in the Flow (Prevent Future Abandonment)
**Files: `src/pages/Apply.tsx`, `supabase/functions/stripe-payment/index.ts`**

- Move the `membership_applications` insert to happen **before** card setup begins, with status `pending_payment`
- On card success, update status to `pending`
- On abandonment, record stays as `pending_payment` — visible in the admin portal
- Link the `application_id` to `card_setup_attempts` immediately

### Files Changed
- **Edit**: `src/pages/admin/Applications.tsx` — add Abandoned tab with data from `card_setup_attempts`
- **New**: `supabase/functions/send-application-reminder/index.ts` — reminder email function
- **Migration**: Add `reminder_sent_at`, `reminder_count` to `card_setup_attempts`
- **Edit**: `src/pages/Apply.tsx` — save application before card setup
- **Edit**: `supabase/functions/stripe-payment/index.ts` — link application_id to setup attempt

