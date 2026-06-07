## Manual Past-Due Notice on Billing Arrears

Add a "Send Past-Due Notice" button per member on the Billing Arrears page. Admin clicks → formal collection email is sent to that member only. Logs every send so we can see when each member was last contacted.

### What gets built

1. **New transactional email template** — `past-due-notice.tsx` in `supabase/functions/_shared/transactional-email-templates/`
   - Uses the approved copy (formal demand, itemized balance, 7-day window, late fee / revocation / collections / forfeiture consequences)
   - Reply-to: `admin@stormwellnessclub.com`
   - Variables: `firstName`, `lastName`, `memberEmail`, `tier`, `totalOwed`, `monthsLate`, `oldestDueDate`, `cardBrand`, `last4`, `lastAttemptDate`, `unpaidInvoices[]`, `portalUrl`
   - Registered in `registry.ts`

2. **New edge function** — `send-past-due-notice`
   - Admin-only (verify role: super_admin / admin / manager)
   - Input: `memberId`
   - Server-side: loads member, queries Stripe for `past_due` / `unpaid` open invoices on the dues sub, builds itemized list, calls `send-transactional-email` with `templateName: 'past-due-notice'` and idempotency key `past-due-notice-{memberId}-{YYYY-MM-DD}` (one send per member per day max)
   - Writes a row to `outreach_log` (existing table per memory: Dues Arrears & Outreach) with type `past_due_notice`

3. **UI button on Billing Arrears page**
   - New "Send Notice" button in the Actions column, shown only when member has outstanding balance > $0
   - Confirmation dialog showing: member name, email, amount that will be in the notice
   - On success: toast + refetch so the "Last contacted" column updates
   - Show last-sent timestamp inline so admin doesn't re-spam

### Out of scope (deliberately)
- No cron / no auto-send
- No actual late-fee assessment (email warns about it; you'd assess manually via Manual Charge Cart)
- No collections-agency integration

### Confirmations needed before build
- Email copy is locked in as previously approved
- Template uses existing Lovable Emails infrastructure (already configured for this project)
