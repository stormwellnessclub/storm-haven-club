I found Carly’s stuck record:

- Carly Mouhajer is confirmed for tomorrow’s Pilates class: **Reformer Sculpt – Adv/Int (Heated), May 3 at 11:00 AM**.
- That booking is marked **comp**, so no credit/pass was deducted on that booking.
- She also still has a related waitlist row marked **claimed**. The current admin removal code tries to reactivate that claimed waitlist row after removing the booking, which can keep her tied to the class/waitlist instead of fully removing her.

## Plan

1. **Immediately remove Carly from the class cleanly**
   - Cancel Carly’s confirmed comp booking for the May 3, 11:00 AM Reformer Sculpt class.
   - Clear/expire the related claimed waitlist row so she does not remain stuck on the waitlist or reappear after removal.
   - Because this specific booking was comped, there is no class credit/pass to restore for that booking.

2. **Fix the admin removal logic**
   - Update the roster removal flow so removing someone from the roster does **not automatically put a claimed waitlist entry back to waiting**.
   - For a normal “remove from class” action, the related waitlist row should be closed/expired so the person is fully removed.
   - This prevents the same loop from happening again when someone was promoted from the waitlist.

3. **Make removal safer and clearer**
   - Show the actual error message in the admin toast instead of only “Failed to remove.”
   - Refresh roster/waitlist data after removal so staff can immediately see that the member is gone.

4. **Optional next-step support for payment corrections**
   - If staff need to change someone from “comp” to “credits,” the reliable workflow should be: remove the comp booking completely, then add the person back using credits.
   - I can keep that workflow simple for now, or later add a dedicated “Change payment method” action.

## Technical notes

- The current `ClassRoster.tsx` removal mutation updates the booking to cancelled, then finds a `claimed` waitlist row and sets it back to `waiting`.
- That behavior is the wrong default for staff trying to remove someone completely.
- I’ll change it so roster removal closes the related waitlist entry instead of reactivating it.
- I’ll also perform a one-time database correction for Carly’s exact stuck booking/waitlist pair after approval.