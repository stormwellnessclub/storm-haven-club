

## Split Cancellation Emails by Member Stage

Replace the single `membership_cancelled` email with three distinct email types based on where the person is in the process.

---

### The Three Scenarios

1. **Application Cancelled** -- Applied, accepted, but never paid anything. Stale application being closed out.

2. **Incomplete Membership Cancelled** -- Paid initiation fee but never completed monthly dues setup. Setup was not finished.

3. **Active Membership Cancelled** -- A real, paying member cancelling. Formal, appreciative tone.

---

### Email Content

**Application Cancelled (`application_cancelled`)**
- Subject: "Application Update - Storm Wellness Club"
- Short and simple: their application has been cancelled. Welcome to reapply if interested in the future. Contact admin@stormwellnessclub.com with any questions.

**Incomplete Membership Cancelled (`incomplete_membership_cancelled`)**
- Subject: "Membership Update - Storm Wellness Club"
- Their membership setup was not completed and has been cancelled. If they have any questions they can email admin@stormwellnessclub.com. If they'd like to rejoin in the future they would need to reapply.
- No mention of initiation fee refund policy -- keep it neutral, not aggressive.

**Active Membership Cancelled (`membership_cancelled`)** -- keep existing
- Subject: "Membership Cancellation Confirmation"
- Warm, appreciative. Thanks for being part of the community. Door is open to return.

---

### Where Each Email Triggers

- **Applications page**: When status set to `cancelled`, sends `application_cancelled`.
- **Member Detail page**: "Send Cancellation Notice" button auto-detects which email to send:
  - No initiation fee paid, no subscription --> `application_cancelled`
  - Initiation fee paid but no active subscription --> `incomplete_membership_cancelled`
  - Was a fully active member --> `membership_cancelled`

---

### Technical Details

| File | Changes |
|---|---|
| `supabase/functions/send-email/index.ts` | Add `application_cancelled` and `incomplete_membership_cancelled` case blocks with branded templates. Keep existing `membership_cancelled`. |
| `src/pages/admin/Applications.tsx` | Change cancellation email type from `membership_cancelled` to `application_cancelled`. |
| `src/pages/admin/MemberDetail.tsx` | Update `sendCancellationEmail` to auto-detect email type based on member payment state (initiation fee paid, subscription active). Update toast message to reflect which type was sent. |

