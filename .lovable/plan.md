
# Card Attempt Audit Logging System — ✅ IMPLEMENTED

## Overview

This system provides comprehensive audit logging for all card addition attempts, capturing:
- **Source attribution**: Whether the attempt was `self_service` (applicant/member), `admin_portal`, or `member_portal`
- **Success/failure tracking**: Record if the card save succeeded or was declined
- **Decline reasons**: Capture Stripe's decline codes for failed attempts
- **Full timeline**: Track when someone started AND when they completed/failed

---

## What You Can Now Answer

- "Who clicked the payment link but failed to complete?"
- "Which cards were declined vs abandoned?"
- "Did the admin add this card or did the member add it themselves?"
- "What was the specific decline reason?"

---

## Implementation Summary

### Database Table: `card_setup_attempts`
- **id**: UUID primary key
- **member_id**: FK to members (nullable)
- **application_id**: FK to membership_applications (nullable)
- **stripe_customer_id**: Stripe customer ID
- **stripe_setup_intent**: Setup intent ID for correlation
- **source**: 'self_service' | 'admin_portal' | 'member_portal' | 'checkout_link'
- **initiated_by**: Admin user ID (for admin-initiated)
- **status**: 'initiated' | 'succeeded' | 'failed' | 'abandoned'
- **decline_code**: Stripe decline code
- **decline_message**: Human-readable decline message
- **card_brand**: Card brand on success
- **card_last4**: Last 4 digits on success
- **created_at**: When attempt started
- **completed_at**: When succeeded/failed
- **metadata**: Extra context (JSONB)

### Edge Function Updates

**stripe-payment:**
- `create_application_setup`: Logs with `source = 'self_service'`
- `create_setup_intent`: Logs with `source = 'member_portal'`
- `create_admin_setup_intent`: Logs with `source = 'admin_portal'`, includes `initiated_by`
- `sync_member_card_metadata`: Updates attempt to `succeeded`
- **NEW** `log_card_setup_failure`: Called from frontend on decline

**stripe-webhook:**
- `setup_intent.succeeded`: Updates attempt to `succeeded`
- **NEW** `setup_intent.setup_failed`: Updates attempt to `failed` with decline details

### Frontend Integration
- **PaymentSectionEnhanced.tsx**: Logs failures on confirm error
- **AddCardModal.tsx**: Logs failures on confirm error
- **AdminAddCardForm.tsx**: Logs failures on confirm error

### New Admin Report
- **Payment Follow-Up Report** (`/admin/reports` → Financial → Payment Follow-Up)
- Shows all card setup attempts with status, source, decline reasons
- Summary cards for total, succeeded, failed, in-progress, abandoned
- Follow-up section highlighting who needs attention

---

## Sample Query

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
