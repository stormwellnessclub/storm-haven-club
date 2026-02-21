

## Fix: Clear Payment Disclosures to Stop Chargebacks

### What's Changing

Five specific text/UI updates across two files to make financial obligations unmistakable before anyone submits an application.

---

### 1. Replace the misleading "NOT charged" notice

**File:** `PaymentSectionEnhanced.tsx` (lines 417-426)

The current blue box says "Your card will NOT be charged today." This is replaced with a bold amber/red warning:

> **IMPORTANT: Your card WILL be charged upon approval.**
> By saving your payment method, you authorize Storm Wellness Club to charge the non-refundable initiation fee (Women: $300 / Men: $175) when your membership is approved. Do not apply if you are not ready to commit.

---

### 2. Rewrite the "Authorize Billing" checkbox (Step 2)

**File:** `PaymentSectionEnhanced.tsx` (lines 529-531)

Current: "I authorize Storm Wellness Club to charge my saved payment method upon membership activation."

New: "I authorize Storm Wellness Club to charge the **non-refundable** initiation fee (Women: $300 / Men: $175) and recurring membership dues to this card. I understand the initiation fee is charged upon approval and is **non-refundable**."

---

### 3. Rewrite the "Acknowledge Terms" checkbox (Step 3)

**File:** `PaymentSectionEnhanced.tsx` (lines 557-558)

Current: "I acknowledge that the initiation fee will be charged upon activation and I agree to the billing terms."

New: "I understand this is a minimum **1-year membership commitment**. I agree not to file a chargeback or payment dispute for the initiation fee or any authorized membership charges."

---

### 4. Add founding member pricing breakdown

**File:** `Apply.tsx` (lines 1310-1346)

When someone selects "Yes" for founding member, a pricing table appears below showing the exact annual cost per tier:

| Tier | Women | Men |
|------|-------|-----|
| Diamond | $6,000/year | Women only |
| Platinum | $4,200/year | $2,100/year |
| Gold | $3,000/year | $1,860/year |
| Silver | $2,400/year | $1,440/year |

With a note: "This full annual amount is due upon activation, in addition to the non-refundable initiation fee ($300 women / $175 men)."

---

### 5. Rewrite agreement checkboxes + add "STOP" warning

**File:** `Apply.tsx` (lines 1385-1438)

- Add a prominent red-bordered **"STOP -- Read Before Applying"** card at the top of the Agreements section summarizing: initiation fee is non-refundable, 1-year commitment, founding members pay full year upfront
- **One-Year Commitment checkbox** (line 1411): Change from generic "I agree to terms" to: "I understand this is a minimum 1-year commitment. The initiation fee (Women: $300 / Men: $175) is non-refundable and will be charged upon approval. I will not dispute these authorized charges."
- **Authorization checkbox** (line 1435): Change from generic "I agree to terms" to: "I authorize the non-refundable initiation fee to be charged upon approval. I understand founding members pay full annual dues upfront. I accept that all described charges are final and non-refundable."

---

### Files Modified

| File | What Changes |
|------|-------------|
| `src/components/PaymentSectionEnhanced.tsx` | Replace blue notice with red warning; rewrite Step 2 and Step 3 checkbox text |
| `src/pages/Apply.tsx` | Add founding member pricing table; add STOP warning card; rewrite agreement checkboxes |

No database changes. No new files. Uses existing pricing constants from `membershipPricing.ts`.

