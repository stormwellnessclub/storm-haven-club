# Fix: concierge amenity/credit requests show "failed to send" even though they arrive

## What's happening

When a member requests Steam Room, Ice Bed, or Red Light Therapy from Support > Club Concierge, the app does two things in a row:

1. Creates the support conversation with the member's request — this succeeds, which is why the front desk receives it.
2. Immediately posts an automatic "we'll have it ready" confirmation reply **as staff**.

Step 2 goes through the staff-only reply function on the backend, which requires a staff role. A member is not staff, so it is rejected. That rejection is caught by the same error handler that wraps the whole request, so the member sees "Failed to send request. Please try again." — even though their request was already delivered.

Members then send it again, creating duplicate conversations.

## The fix

- Stop sending the auto-confirmation through the staff-only path from the member's browser. The confirmation is a courtesy message, not the request itself.
- Post it instead as a system/staff message via a small server-side function that the member is allowed to call, scoped to conversations they own and to concierge requests only.
- Make the confirmation step non-blocking regardless: if it fails, the member still sees the success toast, because their request did go through.
- Keep the error toast only for the case where the request itself fails to create.

## Technical notes

- `src/components/member/ClubConciergeTab.tsx` `handleServiceRequest`: move the `sendMessage.mutateAsync({ senderType: 'staff' })` call out of the shared try block; wrap it in its own try/catch that only logs.
- New `SECURITY DEFINER` function `public.post_concierge_auto_reply(p_conversation_id uuid, p_message text)`: verifies `auth.uid()` owns the conversation and that its category is `concierge`, then inserts an `email_messages` row with `sender_type = 'staff'`, `sender_name = 'Storm Wellness Club'`, and bumps `last_message_at`. Revoke from `PUBLIC`/`anon`, grant to `authenticated`.
- Call that function from the concierge tab instead of `useSendMessage` with `senderType: 'staff'`. No change to the front desk / admin reply path (`kiosk_send_staff_reply` stays staff-only).
- Also audit the "Other request" path in the same file — it does not hit the staff path, so it should be unaffected, but confirm during the fix.
