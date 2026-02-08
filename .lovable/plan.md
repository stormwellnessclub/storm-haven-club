

## Plan: Fix Final Notice Email Bug

### The Problem

I found the bug! In the email function, the `annual_fee_final_notice` email case is **missing a `break;` statement**. This is why you're getting the wrong email.

Here's what's happening:
1. You trigger the "Final Notice" email
2. The code builds the Final Notice email content correctly
3. But then it **falls through** to the next case (`freeze_completed`) because there's no `break;`
4. The freeze_completed case overwrites the subject and HTML with "Membership Reactivated" content
5. That wrong email gets sent instead

### The Fix

1. **Add the missing `break;` statement** after the `annual_fee_final_notice` case (line 1029)
2. **Update the subject line** to simply say "Final Notice" if you prefer that

### Current Subject Line
```
⚠️ FINAL NOTICE: Complete Your Payment Today - Storm Wellness Club
```

### Suggested Subject Line Options
- **Option A:** `Final Notice - Storm Wellness Club`
- **Option B:** `⚠️ Final Notice: Complete Your Payment Today`
- **Option C:** `FINAL NOTICE - Payment Required Today`

### Technical Details

**File to modify:** `supabase/functions/send-email/index.ts`

**Change:** Add `break;` after line 1029 (after the closing template literal and before `case 'freeze_completed':`)

```typescript
// Line ~1029 - currently missing break!
          </div>
        `;
        break;  // ← ADD THIS LINE

      case 'freeze_completed':
```

### After the Fix

Once deployed, when you send a Final Notice email:
- Subject will be: "Final Notice - Storm Wellness Club" (or your preferred wording)
- Body will show the red warning banner with "FINAL NOTICE - ACTION REQUIRED TODAY"
- The PAY NOW button will be prominent in red
- The grace period option will be included

