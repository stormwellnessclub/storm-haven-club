

## Enhance Admin Class Roster: Add Walk-In / New Person with Charge Option

### The Problem
The current "Add Member" button in the class roster dialog only searches existing active members. There's no way for staff to:
- Add a walk-in or non-member to a class
- Add someone brand new (not in the system at all)
- Charge a drop-in fee at the time of adding

### What Will Change

**1. Replace "Add Member" with a two-option panel**

Instead of a single member search, the "Add" section will have two clear paths:

- **Add Existing Member** -- works like today, searches the `members` table
- **Add Walk-In / New Person** -- a quick form for name + email (optional), with the option to charge a drop-in fee

**2. Walk-In form fields**

A compact inline form with:
- First Name (required)
- Last Name (required)
- Email (optional)
- Phone (optional)
- Charge drop-in fee toggle (with price display, e.g. $30)

**3. Walk-in booking logic**

When adding a walk-in:
- If an email is provided, check `non_member_profiles` and `profiles` tables to see if they already exist. If found, link the booking to their `user_id`.
- If no match or no email, create the booking with a `payment_method` of `walk_in` and store the walk-in's name in the booking notes or a metadata field.
- The roster display will show walk-in names even without a linked member record.

**4. Drop-in charge option**

When the "Charge drop-in fee" toggle is on:
- Use the existing `stripe-payment` edge function's `charge_saved_card` action if the person has a card on file
- Or generate a Stripe Checkout link for the drop-in amount ($30 single class) that staff can share or process on the spot
- Record the charge in `manual_charges` for audit trail

**5. Roster display update**

The roster table will show walk-in entries alongside member bookings, displaying the walk-in name from the booking metadata when no member record is linked.

### Technical Details

| File | Change |
|------|--------|
| `src/components/admin/SoftLaunchClassManagement.tsx` | Expand the "Add Member" section into a tabbed panel with "Member" and "Walk-In" options. Add walk-in form with name/email/phone fields and charge toggle. Update the roster display to show walk-in names from booking metadata. Update the booking insert to support `walk_in` payment method with metadata. |
| `src/components/admin/SoftLaunchClassManagement.tsx` | Update the bookings query to also pull walk-in data (bookings without a `member_id` but with walk-in metadata). |
| Database migration | Add a `walk_in_name` column (nullable text) to `class_bookings` to store the name for unlinked walk-ins. This avoids overloading existing fields and keeps the schema clean. |

### Walk-In Booking Flow

```text
Staff clicks "Add Walk-In"
        |
  Enters name + optional email
        |
  [Toggle] Charge drop-in fee?
   /              \
 Yes               No
  |                 |
Check for card    Insert booking
on file           (payment_method: 'walk_in',
  |                walk_in_name: 'Jane Doe')
Has card? ------> Charge via Stripe
No card? -------> Generate payment link
                   or mark as "pay at desk"
```

### Pricing Reference
- Single drop-in (non-member): $30
- Single drop-in (member): $25
