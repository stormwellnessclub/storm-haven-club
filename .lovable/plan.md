
## Add "Resend Confirmation Email" Button to Guest Detail Sheet

### What This Does

Adds a button in the admin Guest Detail Sheet that lets staff manually resend the purchase confirmation email to any guest who has an email on file. This covers guests who didn't receive the original automated email.

### Where It Goes

The button will appear in the existing **Guest Detail Sheet** (`src/components/admin/GuestDetailSheet.tsx`), right above the existing "Feedback Email" section. It will be available for any guest pass that has an email address, regardless of status.

### How It Works

1. Staff opens a guest pass record from the Guest Passes admin page
2. A new "Confirmation Email" section shows either:
   - A "Resend Confirmation Email" button (if the guest has an email on file)
   - "No email on file" message (if no email exists)
3. Clicking the button calls the existing `send-email` backend function with type `guest_pass_purchase_confirmation`
4. The email includes the guest's name, visit date, and amount paid -- all data already available on the guest record
5. A success toast confirms the send

### Technical Details

**File:** `src/components/admin/GuestDetailSheet.tsx`

- Add a new state variable `sendingConfirmation` (boolean)
- Add a new section between the "Visit Details" and "Feedback Email" sections
- The button calls `supabase.functions.invoke('send-email')` with:
  - `type: 'guest_pass_purchase_confirmation'`
  - `to: guest.guest_email`
  - `data: { name: guest.guest_name, visitDate, amountPaid: guest.price_paid.toFixed(2) }`
- No backend changes needed -- the email template and function already exist
- No database changes needed -- this is a manual resend action

### Single File Change

Only `src/components/admin/GuestDetailSheet.tsx` needs to be modified.
