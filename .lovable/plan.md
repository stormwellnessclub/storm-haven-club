

## Plan: Fix Credit Renewal System and Restore Your Credits

### Problem Summary
Your Diamond membership credits expired on January 27th. New credits should have been created on January 28th (your billing anniversary) but weren't, likely because:
1. Your `stripe_subscription_id` was NULL until we fixed it
2. The `process-monthly-credits` function may not have scheduled trigger

---

### Part 1: Immediate Fix - Create Your January 28th Cycle Credits

**Direct database insert** to create your new credit cycle:

```sql
-- Create new credits for Jan 28 - Feb 27 cycle (Diamond tier)
INSERT INTO member_credits (user_id, member_id, credit_type, credits_total, credits_remaining, cycle_start, cycle_end, expires_at)
VALUES 
  ('6d30811c-7e66-4ea9-b135-f5c340bf78fc', '8c9ffb27-85ae-4732-a904-3334b50c4e33', 'class', 10, 10, '2026-01-28', '2026-02-27', '2026-02-27 23:59:59+00'),
  ('6d30811c-7e66-4ea9-b135-f5c340bf78fc', '8c9ffb27-85ae-4732-a904-3334b50c4e33', 'red_light', 10, 10, '2026-01-28', '2026-02-27', '2026-02-27 23:59:59+00'),
  ('6d30811c-7e66-4ea9-b135-f5c340bf78fc', '8c9ffb27-85ae-4732-a904-3334b50c4e33', 'dry_cryo', 6, 6, '2026-01-28', '2026-02-27', '2026-02-27 23:59:59+00');
```

This gives you:
- 10 Class Credits
- 10 Red Light Therapy sessions
- 6 Dry Cryo sessions

Valid through February 27th.

---

### Part 2: Add Credit Renewal to Webhook (Better Reliability)

**File:** `supabase/functions/stripe-webhook/index.ts`

Currently, when a monthly dues invoice succeeds, the webhook only:
- Logs the payment attempt
- Updates status if `past_due` → `active`

**Add credit creation** to the `invoice.payment_succeeded` handler so credits are renewed when payment is confirmed:

**Insert after line 929** (inside the `else` block for membership subscription invoices):

```typescript
// Create new monthly credits for successful subscription renewal
try {
  // Get member tier to determine credit amounts
  const { data: memberInfo } = await supabase
    .from('members')
    .select('membership_type, user_id, membership_start_date')
    .eq('id', memberData.id)
    .single();

  if (memberInfo) {
    const tierName = getTierName(memberInfo.membership_type);
    const tierCredits = TIER_CREDITS[tierName] || TIER_CREDITS.silver;

    // Calculate cycle dates based on invoice period
    const cycleStart = new Date(invoice.period_start * 1000);
    const cycleEnd = new Date(invoice.period_end * 1000);
    cycleEnd.setDate(cycleEnd.getDate() - 1); // End day before next billing
    const expiresAt = new Date(cycleEnd);
    expiresAt.setHours(23, 59, 59, 999);

    const cycleStartStr = cycleStart.toISOString().split('T')[0];
    const cycleEndStr = cycleEnd.toISOString().split('T')[0];

    // Check if credits already exist for this cycle
    const { data: existingCredits } = await supabase
      .from('member_credits')
      .select('credit_type')
      .eq('user_id', memberInfo.user_id)
      .eq('cycle_start', cycleStartStr);

    const existingTypes = new Set(existingCredits?.map((c: any) => c.credit_type) || []);

    const creditsToCreate: any[] = [];
    const creditTypes = ['class', 'red_light', 'dry_cryo'] as const;

    for (const creditType of creditTypes) {
      const amount = tierCredits[creditType];
      if (amount > 0 && !existingTypes.has(creditType)) {
        creditsToCreate.push({
          user_id: memberInfo.user_id,
          member_id: memberData.id,
          credit_type: creditType,
          credits_total: amount,
          credits_remaining: amount,
          cycle_start: cycleStartStr,
          cycle_end: cycleEndStr,
          expires_at: expiresAt.toISOString(),
        });
      }
    }

    if (creditsToCreate.length > 0) {
      const { error: creditError } = await supabase
        .from('member_credits')
        .insert(creditsToCreate);

      if (creditError) {
        logError(creditError, "CREDIT_RENEWAL");
      } else {
        logStep("Monthly credits renewed", { 
          memberId: memberData.id, 
          credits: creditsToCreate.length,
          tier: tierName
        });
      }
    }
  }
} catch (creditRenewalError) {
  logError(creditRenewalError, "CREDIT_RENEWAL");
  // Don't fail the webhook for credit creation issues
}
```

---

### Part 3: Add Helper Function at Top of Webhook

**Add near line 30** (with other helper functions):

```typescript
function getTierName(membershipType: string): string {
  const normalized = membershipType.toLowerCase().trim();
  if (normalized.includes("diamond")) return "diamond";
  if (normalized.includes("platinum")) return "platinum";
  if (normalized.includes("gold")) return "gold";
  return "silver";
}
```

---

### Summary

| Task | What It Does |
|------|--------------|
| Database insert | Immediately restores your Diamond credits for current cycle |
| Webhook enhancement | Ensures credits auto-renew when monthly payment succeeds |
| Helper function | Adds tier detection to webhook for credit amounts |

### After Implementation

- Your credits will show immediately in the portal
- Future monthly payments will automatically create new credits
- No dependency on cron job reliability - credits tied to actual payment events

