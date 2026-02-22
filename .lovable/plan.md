

## Admin Class Management: Cancellation with Refund + Waitlist Management

### What's Being Added

**1. Fix admin cancellation to refund credits/passes**

Currently, the "Remove" button in the Class Roster dialog just marks the booking as cancelled without restoring the member's credit or pass. This needs to match the member-facing cancellation logic that refunds the consumed credit/pass.

**2. Add Waitlist tab to the Roster dialog**

Add a second tab inside the Class Roster dialog showing everyone on the waitlist for that session. From here, admins can:
- See who's waiting (in position order)
- Manually promote someone into the class (books them + removes from waitlist)
- Remove someone from the waitlist entirely
- See notification status (waiting, notified, claimed, expired)

### Technical Details

| File | Change |
|------|--------|
| `src/components/admin/ClassRosterDialog.tsx` | **Refund on remove**: Update `removeMutation` to check `payment_method`, `pass_id`, and `member_credit_id` on the booking, then restore the credit/pass (same logic as `useCancelBooking`). Also notify the waitlist after removal. |
| `src/components/admin/ClassRosterDialog.tsx` | **Waitlist tab**: Add a "Waitlist" tab next to the roster. Query `class_waitlist` for the session. Show position, name, status badge, and action buttons (Promote / Remove). Promoting a person calls the add-to-class flow using their original payment context. |

No database changes needed -- the `class_waitlist` table and all required columns already exist.

