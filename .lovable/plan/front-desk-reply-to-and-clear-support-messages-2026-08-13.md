# Front Desk: Reply To and Clear Support Messages

## What's wrong

Confirmed from the live database policies on the support tables:

- Front desk staff can **read** conversations and messages, but the only "manage" policies cover `admin`, `manager`, and `super_admin`.
- So for a front desk account:
  - Sending a reply (insert into messages) is rejected.
  - Marking messages as read (the "clear the unread badge" step) silently updates zero rows.
  - Setting a conversation to in_progress/closed silently updates zero rows.

Resolve already works because it goes through a guarded server function. Everything else still writes to the tables directly.

The outbound email side is fine — the email sender already accepts the front desk role.

## The fix

Give the same guarded-server-function treatment to the three remaining actions, then route the inbox UI through them:

1. **Reply** — a server function that inserts the staff message, stamps the conversation as in_progress with a new last-message time, and returns the new message. It verifies the caller is signed-in staff (front desk included) before writing.
2. **Mark read** — a server function that flags a conversation's member messages as read.
3. **Set status** — a server function for in_progress / closed / reopen, matching the existing resolve function.

Then update the inbox screens so every staff write goes through these functions instead of direct table writes, and surface a real error toast if a write affects no rows (no more "sent"/"resolved" messages that don't actually happen).

## Where it applies

- Admin Support / Concierge inbox (also what front desk sees at /frontdesk/messages)
- Front desk kiosk support panel
- Admin check-in support panel

Admins and managers keep working exactly as today; front desk gains reply, mark-read, and clear.

## Technical notes

- New migration adding `public.kiosk_send_staff_reply(p_conversation_id uuid, p_message text)`, `public.kiosk_mark_conversation_read(p_conversation_id uuid)`, and `public.kiosk_set_conversation_status(p_conversation_id uuid, p_status text)` — all SECURITY DEFINER, `PERFORM public.assert_kiosk_staff();`, `set search_path = public`, `REVOKE ALL ... FROM PUBLIC, anon`, `GRANT EXECUTE TO authenticated, service_role`. Sender email/name derived server-side from `auth.uid()`.
- `src/pages/admin/EmailManagement.tsx`: replace the direct `email_messages` insert, the `is_read` update effect, and the `email_conversations` status updates with the new RPCs; keep the existing `send-email` invoke for the outbound copy.
- `src/hooks/useEmailConversations.ts`: `useSendMessage` (staff path), `useUpdateConversationStatus`, `useMarkMessagesAsRead` call the RPCs; member-sent messages keep the current direct insert.
- `src/pages/FrontDesk.tsx` (`KioskSupportPanel`) and `src/components/admin/CheckInSupportPanel.tsx`: switch their message insert and read-marking to the RPCs.
- Verify after deploy with a front desk role account: reply persists, unread badge clears, status changes stick.
