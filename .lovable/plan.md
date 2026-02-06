

# Card Attempt Audit Logging System

## Overview

This plan adds comprehensive audit logging for all card addition attempts, capturing:
- **Source attribution**: Whether the attempt was `self_service` (applicant/member), `admin_portal`, or `checkout_link`
- **Success/failure tracking**: Record if the card save succeeded or was declined
- **Decline reasons**: Capture Stripe's decline codes for failed attempts
- **Full timeline**: Track when someone started AND when they completed/failed

---

## What You'll Get

After implementation, you'll be able to answer:
- "Who clicked the payment link but failed to complete?"
- "Which cards were declined vs abandoned?"
- "Did the admin add this card or did the member add it themselves?"
- "What was the specific decline reason?"

---

## Implementation

### 1. New Database Table: `card_setup_attempts`

A dedicated audit table to track every card addition attempt:

```text
┌─────────────────────────────────────────────────────────────────┐
│                    card_setup_attempts                          │
├─────────────────────────────────────────────────────────────────┤
│ id                  UUID (primary key)                          │
│ member_id           UUID (nullable, FK → members)               │
│ application_id      UUID (nullable, FK → membership_applications)│
│ stripe_customer_id  TEXT                                        │
│ stripe_setup_intent TEXT (nullable - SI id for correlation)    │
│ source              TEXT: 'self_service' | 'admin_portal' |     │
│                           'checkout_link' | 'member_portal'     │
│ initiated_by        UUID (nullable - admin user who started it) │
│ status              TEXT: 'initiated' | 'succeeded' | 'failed'  │
│                           | 'abandoned'                         │
│ decline_code        TEXT (nullable - Stripe decline_code)       │
│ decline_message     TEXT (nullable - friendly error)            │
│ card_brand          TEXT (nullable - on success)                │
│ card_last4          TEXT (nullable - on success)                │
│ created_at          TIMESTAMPTZ (when attempt started)          │
│ completed_at        TIMESTAMPTZ (nullable - when succeeded/failed)│
│ metadata            JSONB (extra context)                       │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Edge Function Updates

Modify `stripe-payment` to log attempts at each stage:

**On `create_setup_intent` / `create_admin_setup_intent` / `create_application_setup`:**
- Insert a new `card_setup_attempts` record with `status = 'initiated'`
- Record the `source` based on which action was called
- Store the `setup_intent.id` for correlation

**On card save success (sync_member_card_metadata action):**
- Find the matching attempt by `stripe_setup_intent` or `stripe_customer_id`
- Update to `status = 'succeeded'`, set `completed_at`, card details

**On Stripe webhook `setup_intent.succeeded`:**
- Update matching attempt record to `succeeded` (backup for webhook-only flows)

**On Stripe webhook `setup_intent.setup_failed`:**
- Update matching attempt to `status = 'failed'`
- Capture `decline_code` and `decline_message` from the event

### 3. Frontend Integration

**Apply.tsx (PaymentSectionEnhanced):**
- Already uses `create_application_setup` → will be logged automatically

**AddCardModal.tsx (Member Portal):**
- Uses `create_setup_intent` → will be logged automatically
- On error, call a new action to log the failure with decline reason

**AdminAddCardForm.tsx:**
- Uses `create_admin_setup_intent` → will log with `source = 'admin_portal'`
- Pass the admin's user_id as `initiated_by`
- On error, log the decline with reason

### 4. New Admin Report: Payment Follow-Up Report

A new report in the Reports section showing:
- All `initiated` but not `succeeded` attempts
- Grouped by time period (today, this week, this month)
- Shows source, member/applicant name, decline reason
- Filterable by status (declined vs abandoned)

---

## Technical Details

### Database Migration

```sql
-- Create card setup attempts audit table
CREATE TABLE public.card_setup_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  application_id UUID REFERENCES public.membership_applications(id) ON DELETE SET NULL,
  stripe_customer_id TEXT NOT NULL,
  stripe_setup_intent TEXT,
  source TEXT NOT NULL CHECK (source IN ('self_service', 'admin_portal', 'checkout_link', 'member_portal')),
  initiated_by UUID,
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'succeeded', 'failed', 'abandoned')),
  decline_code TEXT,
  decline_message TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for quick lookups
CREATE INDEX idx_card_setup_attempts_customer ON public.card_setup_attempts(stripe_customer_id);
CREATE INDEX idx_card_setup_attempts_setup_intent ON public.card_setup_attempts(stripe_setup_intent);
CREATE INDEX idx_card_setup_attempts_status ON public.card_setup_attempts(status);
CREATE INDEX idx_card_setup_attempts_created ON public.card_setup_attempts(created_at DESC);

-- RLS policy for admins only
ALTER TABLE public.card_setup_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view card setup attempts"
  ON public.card_setup_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

CREATE POLICY "System can insert card setup attempts"
  ON public.card_setup_attempts
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update card setup attempts"
  ON public.card_setup_attempts
  FOR UPDATE
  USING (true);
```

### Edge Function Changes

1. **`create_application_setup`**: Log with `source = 'self_service'`
2. **`create_setup_intent`**: Log with `source = 'member_portal'`
3. **`create_admin_setup_intent`**: Log with `source = 'admin_portal'`, include `initiated_by`
4. **New action `log_card_setup_failure`**: Called from frontend on decline
5. **`sync_member_card_metadata`**: Update attempt to `succeeded`

### Frontend Changes

1. **PaymentSectionEnhanced.tsx**: On error, call `log_card_setup_failure`
2. **AddCardModal.tsx**: On error, call `log_card_setup_failure`
3. **AdminAddCardForm.tsx**: On error, call `log_card_setup_failure` with admin context
4. **New report component**: `PaymentFollowUpReport.tsx`

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/stripe-payment/index.ts` | Modify - add logging to setup intent actions |
| `supabase/functions/stripe-webhook/index.ts` | Modify - handle `setup_intent.setup_failed` |
| `src/components/PaymentSectionEnhanced.tsx` | Modify - log failures |
| `src/components/member/AddCardModal.tsx` | Modify - log failures |
| `src/components/admin/AdminAddCardForm.tsx` | Modify - log failures |
| `src/components/admin/reports/reports/PaymentFollowUpReport.tsx` | Create - new report |
| `src/lib/reportDefinitions.ts` | Modify - add new report |
| Database migration | Create table + indexes + RLS |

---

## Sample Query for "Who Tried But Failed"

After implementation, you can run:
```sql
SELECT 
  csa.created_at,
  csa.source,
  csa.status,
  csa.decline_code,
  csa.decline_message,
  COALESCE(m.first_name, ma.first_name) as first_name,
  COALESCE(m.last_name, ma.last_name) as last_name,
  COALESCE(m.email, ma.email) as email
FROM card_setup_attempts csa
LEFT JOIN members m ON csa.member_id = m.id
LEFT JOIN membership_applications ma ON csa.application_id = ma.id
WHERE csa.status IN ('failed', 'initiated')
ORDER BY csa.created_at DESC;
```

