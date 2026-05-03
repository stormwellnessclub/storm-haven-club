## Problem

Members report the Support tab "says Sending" and they believe it's broken — but staff are receiving the messages. The UI is confusing them:

1. **Reply messages have no confirmation.** In `src/pages/member/Support.tsx` `handleSendMessage` (line 70) and `src/pages/portal/Support.tsx` `handleReply`, on success the textbox just clears silently. No toast, no "Sent" badge, no acknowledgement.
2. **No "delivered" indicator** on the member's own message bubbles. The bubble renders identically whether it's pending or saved, so users have nothing telling them the server received it.
3. **New conversation flow** does show a toast ("Message sent. Our team will respond…") but the dialog closes immediately and the member lands on a single-message thread with no further reassurance.
4. **No "we received this" auto-reply** in the conversation thread itself, so when a member returns to the page the only thing they see is their own outgoing message.

Messages are in fact saving correctly to `email_conversations` / `email_messages` (admin sees them), so this is purely a member-facing UX/feedback gap.

## Fix

### 1. Add success feedback on every send (member + portal)
- `src/pages/member/Support.tsx` `handleSendMessage`: on success, show a brief toast ("Message sent — our team will reply soon") and clear the textbox.
- `src/pages/portal/Support.tsx` `handleReply`: same — toast on success, clear input.

### 2. Show a delivery state on member message bubbles
- In both Support pages, render a small "Sent ✓" line under each member-authored bubble with the timestamp. While the mutation `isPending`, render the in-flight bubble with reduced opacity and "Sending…" label so the transition from sending → sent is visible.

### 3. Persistent reassurance banner in the thread
- Add a subtle info row at the top of the messages scroll area: "Your messages are delivered to the Storm Wellness Club team. We typically reply within one business day." This addresses the "is anyone seeing this?" anxiety directly.

### 4. Auto-acknowledgement system message on first send
- When `useCreateConversation` succeeds, immediately insert a staff-side system message into the same conversation: "Thanks — we've received your message and a team member will respond shortly." This is purely cosmetic (does not change admin status logic) and gives the member an immediate visible reply in the thread.
- Implemented in `src/hooks/useEmailConversations.ts` `useCreateConversation` `mutationFn` after the initial member message insert: insert a second row with `sender_type: 'staff'`, `sender_email: 'support@stormwellnessclub.com'`, `sender_name: 'Storm Wellness Club'`, and a fixed acknowledgement body. No edge function / no email send.

### 5. Improve the post-create UX
- After `handleCreateConversation` succeeds, keep the user on the newly selected conversation (already done) but extend the toast duration so the confirmation is clearly visible, and also surface the system ack message (#4) inside the thread.

### Files touched
- `src/pages/member/Support.tsx` — toast on reply, sending/sent indicator, reassurance banner.
- `src/pages/portal/Support.tsx` — toast on reply, sending/sent indicator, reassurance banner.
- `src/hooks/useEmailConversations.ts` — insert system ack row in `useCreateConversation`.

### Out of scope
- No schema changes, no edge function changes, no email-sending changes. The underlying message delivery is already working.
