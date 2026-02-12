
## Restore "Send Activation Email" Button for Reactivated Members

### Problem
The "Send Activation Email" button on the Member Detail page is only visible when a member's status is `pending_activation`. After reactivating a member (changing their status to `active`), the entire Activation Setup Status card disappears -- and with it, the button to send the activation email.

### Solution
Add a standalone "Send Activation Email" button in the member detail header/action area that is available regardless of status. This way, after reactivating a member, you can still send (or re-send) the activation setup email.

### What changes

**File: `src/pages/admin/MemberDetail.tsx`**
- Add a "Send Activation Email" option to the member action buttons area (near the top of the detail page, alongside other action buttons like cancellation email)
- The button will be available for members with status `active` or `pending_activation`
- Uses the same `sendActivationEmail` handler already in the code (lines 888-922) -- no logic changes needed
- Shows "Last sent" timestamp if `activation_email_sent_at` exists
- This does NOT remove the existing activation card for `pending_activation` members -- that stays as-is with its checklist. This just adds a second access point that persists after reactivation.
