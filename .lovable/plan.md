

## Upgrade Admin Roster: Full Payment Control When Adding to Class

### The Problem

The current "Add to Class" panel has three gaps:

1. **No non-member pass holder support** -- A non-member who bought a class pass can't be found or added because the "Existing Member" tab only searches the `members` table (active members only). Non-members with passes in `class_passes` or `non_member_profiles` are invisible.

2. **No payment method choice** -- The charge toggle is a binary on/off with auto-pricing ($25/$30). Staff can't pick whether to use:
   - An existing class pass (deduct a credit)
   - An existing member credit
   - A single drop-in (member or non-member rate)
   - Sell a new package (single or 10-pack) on the spot

3. **No pricing control** -- Staff can't choose member vs. non-member pricing or select a different product (e.g. 10-pack instead of single drop-in).

---

### What Will Change

**1. Unified person search (replaces "Existing Member" tab)**

The "Existing Member" tab will search across three sources:
- `members` table (gym members)
- `profiles` table (any account holder)
- `non_member_profiles` table (non-member pass holders)

Results will show a badge indicating "Member", "Pass Holder", or "Account" so staff know who they're picking. When a person is selected, the system checks their available passes/credits and displays them.

**2. "How to pay" step after selecting a person (or for walk-ins)**

After identifying who to add, a payment method selector appears with these options:

| Option | When Available | What Happens |
|--------|---------------|--------------|
| **Use existing class pass** | Person has active `class_passes` with remaining credits | Shows each pass with remaining count; selecting one deducts 1 credit (uses `create_atomic_class_booking` RPC or equivalent logic) |
| **Use member credits** | Person is a member with `member_credits` of type `class` | Deducts 1 member credit |
| **Charge single drop-in** | Always | Staff picks member ($25) or non-member ($30) rate; charges card or flags for desk collection |
| **Sell a package now** | Always | Opens the existing `SellClassPackage` dialog pre-filled with this person, then adds them to class after purchase |
| **Comp / No charge** | Always | Adds to class with `payment_method: 'comp'` -- no charge, no credit deduction |

**3. Walk-in tab gets the same payment options**

After entering name/email for a walk-in, the same payment selector appears. If the email matches an existing account, their passes are loaded automatically.

**4. Existing member tab -- also shows pass/credit info inline**

When searching members, results show available pass counts so staff can make informed decisions before adding.

---

### Technical Details

**File: `src/components/admin/ClassRosterDialog.tsx`**

Major changes:
- Add a unified search that queries `members`, `profiles`, and `non_member_profiles`
- After person selection (or walk-in email match), fetch their `class_passes` (active, classes_remaining > 0) and `member_credits` (class type, credits_remaining > 0)
- Add a "Payment Method" radio group with the options above
- When "Use existing pass" is selected, show a dropdown of their active passes with remaining counts
- When "Charge drop-in" is selected, show a member/non-member price toggle
- When "Sell package" is selected, open `SellClassPackage` dialog pre-populated
- When "Comp" is selected, just add with no charge
- For pass/credit deduction, replicate the atomic logic from `create_atomic_class_booking` or call it directly
- Update the walk-in tab to also show the payment selector once name is entered

**No new database changes required** -- all needed columns (`walk_in_name`, nullable `user_id`) and tables (`class_passes`, `member_credits`, `non_member_profiles`) already exist.

**Queries to add:**
```
-- Fetch active passes for a user
SELECT id, pass_type, category, classes_remaining, expires_at
FROM class_passes
WHERE user_id = ? AND status = 'active' AND classes_remaining > 0 AND expires_at > now()

-- Fetch member credits for a member
SELECT id, credit_type, credits_remaining, expires_at
FROM member_credits
WHERE member_id = ? AND credit_type = 'class' AND credits_remaining > 0 AND expires_at > now()
```

**Payment flow per option:**

- **Pass**: Deduct via `UPDATE class_passes SET classes_remaining = classes_remaining - 1` + insert booking with `payment_method: 'pass'` and `pass_id`
- **Credits**: Deduct via `UPDATE member_credits SET credits_remaining = credits_remaining - 1` + insert booking with `payment_method: 'credits'` and `member_credit_id`
- **Drop-in charge**: Use existing `stripe-payment` edge function `charge_saved_card` action, or flag for desk collection
- **Sell package**: Open `SellClassPackage`, on close re-fetch passes and auto-select the new one
- **Comp**: Insert booking with `payment_method: 'comp'`, no charge

