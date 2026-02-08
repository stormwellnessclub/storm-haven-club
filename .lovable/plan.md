

## Plan: Final Notice Email - Refined Copy

### Overview
Update the `annual_fee_final_notice` email template with luxury tone, clear action requirement upfront, and grace period option via email response.

---

### Proposed Email Copy

**Subject:** Action Required by Sunday - Storm Wellness Club

---

**Email Body:**

```
[Storm Wellness Club Logo]

YOUR MEMBERSHIP AWAITS
Action Required

Dear [First Name],

We are thrilled to have you as part of our founding member community and cannot wait to welcome you to Storm Wellness Club.

To confirm your place for our soft launch, we kindly ask that you complete your initiation fee payment by Sunday, February 8th at 5:00 PM.

As we personalize each member's experience, we need to finalize our confirmed membership count to ensure we can deliver the exceptional service you deserve from day one. Unfortunately, we are unable to hold spots indefinitely for members who have not completed their enrollment.

If you need additional time, we are able to offer a seven-day grace period to complete your payment. Simply reply to this email to request an extension.

                    [ Complete Payment ]

We truly hope to see you at the club soon.

Warmly,
The Storm Wellness Club Team
```

---

### Key Changes from Previous Version

| Element | Previous Draft | This Version |
|---------|---------------|--------------|
| Header | Just "YOUR MEMBERSHIP AWAITS" | "YOUR MEMBERSHIP AWAITS" + "Action Required" subtitle |
| Grace period | "If this timing does not work..." | "If you need additional time, we are able to offer a seven-day grace period... Simply reply to this email to request an extension." |
| Contact method | Links to admin email | "Reply to this email" (simpler) |

---

### Technical Changes

**File:** `supabase/functions/send-email/index.ts`

Update the `annual_fee_final_notice` case with:
- Subject: `Action Required by Sunday - Storm Wellness Club`
- Gold header with "YOUR MEMBERSHIP AWAITS" and "Action Required" subtitle
- Updated body copy with the refined text
- Gold "Complete Payment" button
- Warm sign-off

