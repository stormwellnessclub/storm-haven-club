
## Comprehensive Payment Tracking Dashboard

### Overview
Build a new dedicated Payment Tracking page at `/admin/payment-tracking` with comprehensive reporting, filtering, and member follow-up capabilities for failed, upcoming, and successful payments.

---

### Part 1: Enhanced Failed Payment Badge & Member Detail

**Current State**: `MemberIssuesBadges.tsx` shows a "Payment Failed" badge but doesn't expose details.

**Enhancements**:
- Add a clickable failed payment badge that opens a popover/sheet showing:
  - Full decline reason and code
  - Failure message from Stripe
  - Attempt count and next retry date
  - Quick link to member detail
  - Email status (was payment_failed email sent?)

**Files to modify**:
- `src/components/admin/MemberIssuesBadges.tsx` - Add click handler to show details dialog

---

### Part 2: New Payment Tracking Page

Create a new comprehensive page at `/admin/payment-tracking` with three main tabs.

**Route**: Add to admin routing in `App.tsx`

**Layout**: Four main tabs:
1. **Failed Payments** - Members with declined/failed payment attempts
2. **Upcoming Payments** - Predicted renewals based on subscription billing cycle
3. **Successful Payments** - Completed transactions
4. **Email Tracking** - Payment-related emails sent

---

### Part 3: Failed Payments Tab

**Data Source**: `payment_attempts` table joined with `members`

**Columns**:
| Column | Source |
|--------|--------|
| Member Name/Email | members join |
| Amount | payment_attempts.amount |
| Status | payment_attempts.status |
| Decline Code | payment_attempts.decline_code |
| Decline Reason | payment_attempts.decline_reason |
| Failure Message | payment_attempts.failure_message |
| Attempt # | payment_attempts.attempt_number |
| Next Retry | payment_attempts.next_retry_at |
| Date | payment_attempts.created_at |
| Email Sent | email_audit_log join (type = 'payment_failed') |
| Actions | View Member, Resend Email |

**Filters**:
- Date range picker (start/end with presets)
- Decline code (dropdown: insufficient_funds, card_declined, expired_card, etc.)
- Status (failed, requires_action, pending)
- Tier filter
- Has been contacted (email sent Y/N)
- Amount range

**Summary Cards**:
- Total Failed Attempts (period)
- Total Failed Amount
- Unique Members Affected
- Avg Attempts per Member
- Most Common Decline Reason

---

### Part 4: Upcoming Payments Tab

**Data Source**: `members` with `stripe_subscription_id` and calculated next billing date

**Logic**: Calculate next billing date based on:
- `membership_start_date` + monthly intervals
- Or fetch from Stripe subscription metadata if stored

**Columns**:
| Column | Source |
|--------|--------|
| Member Name/Email | members |
| Tier | membership_type |
| Amount (Expected) | Calculated from tier pricing |
| Next Billing Date | Calculated |
| Card on File | card_brand/last4 |
| Card Expiry | card_exp_month/year |
| Risk Level | High if card expires before next billing |

**Filters**:
- Date range (show upcoming in next X days)
- Tier
- Card status (expiring soon, expired, valid)
- Founding member

**Summary Cards**:
- Expected Revenue (next 7/30 days)
- Members with Expiring Cards
- High-Risk Renewals

---

### Part 5: Successful Payments Tab

**Data Source**: Combined from `manual_charges` (status=succeeded) and `payment_attempts` (status=succeeded)

**Columns**:
| Column | Source |
|--------|--------|
| Member Name/Email | members join |
| Description | manual_charges.description or invoice type |
| Amount | amount |
| Payment Method | Card brand/last4 |
| Date | created_at/succeeded_at |
| Receipt Sent | email_audit_log (type = 'charge_confirmation') |
| Stripe Link | Payment intent ID |

**Filters**:
- Date range picker
- Payment type (Manual Charge, Subscription, Class Package, Spa, etc.)
- Tier
- Amount range
- Founding member only

**Summary Cards**:
- Total Collected (period)
- Transaction Count
- Average Transaction
- By Category breakdown

---

### Part 6: Email Tracking Tab

**Data Source**: `email_audit_log` filtered to payment-related types

**Email Types to Include**:
- `payment_failed`
- `charge_confirmation`
- `admin_payment_failed_alert`
- `annual_fee_payment_request`
- `add_card_for_dues`

**Columns**:
| Column | Source |
|--------|--------|
| Recipient | recipient_email, recipient_name |
| Type | email_type |
| Subject | subject |
| Status | status |
| Sent At | sent_at |
| Member/Application | member_id or application_id link |
| Preview | Button to view template data |

**Filters**:
- Date range
- Email type
- Status (sent, failed, pending)
- Recipient search

---

### Part 7: Date Range Picker Component

Create a reusable date range picker with:
- Preset buttons: Today, Yesterday, Last 7 days, Last 30 days, This Month, Last Month, This Quarter, Custom
- Custom start/end date inputs
- Quick "Open" date range option

**Component**: `src/components/admin/DateRangePicker.tsx`

---

### Part 8: Failed Payment Detail Sheet

When clicking on a failed payment row, show a sheet with:
- Member info header (name, email, tier, status)
- Payment attempt timeline (all attempts for this member)
- Card details
- Email history (was payment_failed email sent?)
- Quick actions:
  - View Member Profile
  - Send Payment Reminder Email
  - Add Note to Member

---

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/admin/PaymentTracking.tsx` | Main page with tabs |
| `src/components/admin/DateRangePicker.tsx` | Reusable date picker |
| `src/components/admin/FailedPaymentsTab.tsx` | Failed payments table |
| `src/components/admin/UpcomingPaymentsTab.tsx` | Upcoming renewals |
| `src/components/admin/SuccessfulPaymentsTab.tsx` | Successful transactions |
| `src/components/admin/PaymentEmailsTab.tsx` | Email audit tracking |
| `src/components/admin/FailedPaymentDetailSheet.tsx` | Detail view |
| `src/hooks/usePaymentTracking.ts` | Data fetching hook |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add route for /admin/payment-tracking |
| `src/components/admin/AdminSidebar.tsx` | Add navigation item |
| `src/components/admin/MemberIssuesBadges.tsx` | Add click for details |
| `src/lib/reportDefinitions.ts` | Add payment tracking reports if needed |

---

### Database Considerations

No new tables needed. All data exists in:
- `payment_attempts` - Failed/successful payment data with full decline info
- `manual_charges` - Admin-initiated charges
- `email_audit_log` - Email tracking
- `members` - Member data including card info

May need a new RPC for upcoming payments calculation if performance is an issue.

---

### UI/UX Notes

- Use consistent table styling from existing admin pages
- Export to CSV functionality for all tabs
- Real-time badge counts in tab headers (e.g., "Failed (12)")
- Color coding: Red for failed, Amber for at-risk, Green for successful
- Quick filters as pills at top of each tab
- Responsive design for tablet use at front desk
