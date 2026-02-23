
## Fix: Unread Support Badge Counting Resolved Conversations

### Problem
The notification badge counts **all** unread member messages, including those in conversations already marked as "resolved" or "closed". This causes a phantom "1 unread" badge even after staff has handled the conversation.

### Fix
Update the unread count query in `useAdminSupportNotifications.ts` to only count unread messages from conversations that are still **open** or **in_progress**.

### Technical Details

**File:** `src/hooks/useAdminSupportNotifications.ts`

- Change the unread messages query to first fetch IDs of active conversations (status = open or in\_progress), then only count unread messages belonging to those conversations.
- Uses a two-step approach: get active conversation IDs, then filter unread messages by those IDs with an `.in('conversation_id', activeIds)` clause.
- If there are no active conversations, the unread count is automatically 0 (skip the query).

This is a single-file, ~10-line change. No database or backend modifications needed.
