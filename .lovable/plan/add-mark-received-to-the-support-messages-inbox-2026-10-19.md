# Add "Mark received" to the Support Messages inbox

## Problem
The Received button that stops the reminder bell only exists on the Check-In / Front Desk support panels. The Support Messages inbox (Admin → Support Messages and Front Desk → Messages, same screen) only has "Mark Resolved", so staff working there can't silence the bell without resolving.

## Changes
1. In the conversation header next to "Mark Resolved", add a **Received** button (shows "Undo received" once marked).
2. In the conversation list, show a small "Received" badge on acknowledged requests, with who marked it and when in the open conversation.
3. Marking received silences the bell for every staff device immediately; a new member message re-arms it (existing behavior).
4. Resolve stays a separate final step.

## Technical details
- `src/pages/admin/EmailManagement.tsx`: select `acknowledged_at, acknowledged_by_name` on conversations; add a mutation calling the existing `kiosk_acknowledge_conversation` RPC (same args as `CheckInSupportPanel`), then invalidate `admin-email-conversations` and `admin-support-notifications` queries; render button + badge.
- No database changes.
