
# Problem Analysis

Looking at your screenshot (Mindbody's Autopay Detail report) vs. our current implementation, I found several key differences:

1. **No phone number column** - Mindbody shows phone, ours doesn't
2. **Card info missing expiry** - Mindbody shows "Visa xxxx1587 Exp 05/28", ours shows "Visa •••• 1587"
3. **No default date range** - Tab opens with no dates, so it's hard to see data
4. **Only shows ONE upcoming date per member** - Should show ALL billing dates within range
5. **Sorted descending** - Should be ascending (chronological like Mindbody)
6. **Historical data**: `payment_attempts` table is empty (0 records), so historical charges don't appear

## Current Data Status
- **68 active members** with Stripe subscriptions
- **0 historical payment attempts** in database (charges exist in Stripe but not synced locally)

---

# Plan: Mindbody-Style Autopay Report

## 1. Update `useAutopaySchedule.ts`

**Add phone to interface and queries:**
```typescript
export interface AutopayEntry {
  phone: string | null;  // NEW
  // ... existing fields
}
```

**Fix card info to include expiry:**
```typescript
function formatCardInfo(brand, last4, expMonth, expYear) {
  // "Visa xxxx1587 Exp 05/28"
  return `${brand} xxxx${last4} Exp ${expMonth}/${expYear % 100}`;
}
```

**Show ALL upcoming billing dates within range (not just next one):**
- Loop through each month until end of date range
- Generate one entry per billing date per member
- Unique IDs like `upcoming-{memberId}-dues-{date}`

**Sort ascending (chronological):**
```typescript
entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
```

## 2. Update `AutopayScheduleTab.tsx`

**Default date range**: Current month → 3 months ahead

**Add Phone column to table:**
| Date | Client | Phone | Payment Type | Billing Info | Amount | Status |

**Card info format**: "Amex xxxx4000 Exp 02/30"

**Cleaner layout**: Match Mindbody's denser, report-style table

---

## Files Changed
- `src/hooks/useAutopaySchedule.ts` - Add phone, fix card format, multi-month entries, sort ascending
- `src/components/admin/AutopayScheduleTab.tsx` - Add phone column, default date range, cleaner layout
