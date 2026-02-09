

## Three Features: Founding Status Toggle, Same-Day Guest Pass Sales, and Guest Pass Date Editing

### 1. Founding Member Toggle in Tier Change Dialog

**Problem**: The TierChangeDialog only lets admins change the tier (Silver/Gold/Platinum/Diamond) but has no option to toggle founding member status. The `is_founding_member` and `billing_type` fields in the members table are never updated by this dialog.

**Fix**: Add a "Founding Member" toggle (Switch) to `TierChangeDialog` that:
- Shows the current founding status
- When toggled, updates `is_founding_member` and `billing_type` (annual vs monthly) in the database
- Updates the price preview to reflect founding (annual) vs regular (monthly) pricing
- Warns the admin about billing implications (switching to/from annual prepaid)

**Files to modify**:
- `src/components/admin/TierChangeDialog.tsx` -- Add a Switch component for founding status, update the mutation to also write `is_founding_member` and `billing_type`, and adjust price display dynamically based on the selected founding status

---

### 2. Allow Same-Day Guest Pass Purchases on the Website

**Problem**: The public guest pass page (`/guest-pass`) restricts the visit date picker so `minDate = new Date()` (today) but compares using `date < minDate` which excludes today because `new Date()` includes the current time. Guests cannot select today as their visit date.

**Fix**: Set `minDate` to the start of today so that today is selectable:
```
const minDate = startOfDay(new Date());
```
Also extend `maxDate` slightly if needed (currently 7 days out, which is fine).

**Files to modify**:
- `src/pages/GuestPass.tsx` -- Import `startOfDay` from date-fns and use it for `minDate` so today is a valid selection

---

### 3. Admin Can Edit Guest Pass Activation Date (valid_date)

**Problem**: The `GuestDetailSheet` displays the `valid_date` but provides no way to edit it. Admins need to change the visit date after purchase (e.g., guest reschedules).

**Fix**: Add an "Edit Date" button next to the valid_date display in `GuestDetailSheet` that opens an inline date picker. On save, update the `valid_date` column in the `guest_passes` table.

**Files to modify**:
- `src/components/admin/GuestDetailSheet.tsx` -- Add an editable date picker for `valid_date` with a save button that updates the database directly

---

### Summary of Changes

| File | Change |
|------|--------|
| `src/components/admin/TierChangeDialog.tsx` | Add founding member Switch toggle, update mutation to set `is_founding_member` and `billing_type`, adjust price preview dynamically |
| `src/pages/GuestPass.tsx` | Use `startOfDay(new Date())` for minDate so today is selectable |
| `src/components/admin/GuestDetailSheet.tsx` | Add inline date editor for `valid_date` with save to database |

### Technical Details

**TierChangeDialog changes**:
- Add `isFoundingMember` state initialized from props (need new prop or derive from `billingType`)
- Add a Switch component between tier selection and price preview
- When founding status changes, recalculate prices using annual vs monthly rates
- Database mutation updates: `membership_type`, `is_founding_member`, `billing_type`
- For active subscriptions with Stripe, warn that billing interval change requires subscription cancellation and recreation (cannot change interval on existing Stripe subscription)

**GuestDetailSheet changes**:
- Add `editingDate` state and a Calendar popover
- On date select, call `supabase.from('guest_passes').update({ valid_date }).eq('id', guest.id)`
- Show success toast and refresh data

