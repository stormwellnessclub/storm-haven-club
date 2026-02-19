

# Fix Wellness Credit Booking (Same RLS Issue as Guest Passes)

## Root Cause

The `SpaBookingModal.tsx` tries to deduct wellness credits by directly updating the `member_credits` table:
```
supabase.from("member_credits").update({ credits_remaining: ... }).eq("id", credit.id)
```
This **silently fails** because `member_credits` has no UPDATE policy for regular members -- only staff roles can modify that table. This is the exact same bug that was just fixed for guest pass credits.

Additionally, the spa appointment record is created **without** the `credit_id` and `credit_type` fields, so even if the credit were deducted, there would be no audit trail linking the appointment to the specific credit used.

## Solution

### 1. Create an Atomic Database Function

Create `book_wellness_appointment` as a `SECURITY DEFINER` function that:
- Validates the member has remaining wellness credits of the correct type
- Locks and deducts the credit (bypassing RLS)
- Creates the `spa_appointments` record with `credit_id` and `credit_type` populated
- Returns the appointment ID or an error
- All within a single transaction (no partial state)

### 2. Update the Frontend

Refactor `SpaBookingModal.tsx` to call the new RPC when `paymentMethod === "credit"` instead of:
- Manually updating `member_credits` (which fails silently)
- Then separately inserting into `spa_appointments` (without credit tracking)

The card and member_account payment paths remain unchanged.

## Technical Details

### New Database Function: `book_wellness_appointment`

Parameters:
- `p_service_id` (integer)
- `p_service_name` (text)
- `p_service_category` (text)
- `p_service_price` (numeric)
- `p_appointment_date` (date)
- `p_appointment_time` (time)
- `p_duration_minutes` (integer)
- `p_cleanup_minutes` (integer)
- `p_credit_type` (text) -- 'red_light' or 'dry_cryo'
- `p_member_notes` (text, optional)

Logic:
1. Look up the calling user's member record
2. Find their active credit of the matching type with `credits_remaining > 0` (locked with `FOR UPDATE`)
3. Decrement `credits_remaining`
4. Run the existing conflict check
5. Insert into `spa_appointments` with `credit_id`, `credit_type`, `payment_method = 'credit'`, `amount_paid = 0`
6. Return the appointment ID and remaining credits

### Modified File: `src/components/booking/SpaBookingModal.tsx`

- Replace the credit deduction block (lines 183-202) and separate booking call with a single `supabase.rpc('book_wellness_appointment', {...})` call
- On success, refetch credits and close the modal
- Keep the existing card/member_account payment paths unchanged

### Modified File: `src/hooks/useSpaBooking.ts`

- No changes needed to the hook itself; the RPC handles everything for credit bookings
- The `bookAppointment.mutateAsync()` call will be skipped for credit payments since the RPC creates the appointment directly
