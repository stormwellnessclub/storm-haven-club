

## Fix: Booking Confirmation and Visibility

### The Problem
When someone books a class from the temp schedule (/schedule page), they only see a brief toast message "Class booked successfully!" that disappears after a few seconds. There is:
- No confirmation email sent
- No detailed confirmation with class name, date, and time
- No clear direction to view the booking in their portal

The bookings **are** being saved to the database (Sahar's booking is there), and they **should** appear in the member portal's "My Bookings" page. But with just a fleeting toast, users have no confidence the booking went through.

### The Fix

**1. Better confirmation toast with details (useTempClassBooking.ts)**
- Change the `onSuccess` callback to accept the class details (name, date, time) and show a richer toast: "Booking Confirmed -- Signature Flow on Feb 20 at 8:00 PM"
- Include a "View My Bookings" link in the toast that navigates to `/member/bookings` (for members) or `/portal/bookings` (for non-members)

**2. Send confirmation email (useTempClassBooking.ts)**
- After a successful booking, call the `send-email` edge function with `type: "booking_confirmation"` -- the same pattern the full `useBookClass` hook already uses
- Include class name, date, time, and location in the email data

**3. Invalidate portal booking queries (useTempClassBooking.ts)**
- Add `portal-bookings` to the list of invalidated query keys so non-member portal bookings also refresh immediately

### Technical Details

**File: `src/hooks/useTempClassBooking.ts`**

| Change | Detail |
|--------|--------|
| Pass class details to onSuccess | Change `bookMutation.mutate` call signature to pass `className`, `date`, `time` through to the success handler |
| Rich toast | Replace generic toast with: `toast.success("Booking Confirmed", { description: "Signature Flow - Thu, Feb 20 at 8:00 PM", action: { label: "View Bookings", onClick: () => navigate("/member/bookings") } })` |
| Send confirmation email | After successful RPC call, invoke `supabase.functions.invoke("send-email", { body: { type: "booking_confirmation", to: userEmail, data: { class_name, date, time, location } } })` |
| Invalidate portal queries | Add `queryClient.invalidateQueries({ queryKey: ["portal-bookings"] })` to onSuccess |

No other files need changes. The member portal bookings page already correctly queries and displays bookings from `class_bookings`.

