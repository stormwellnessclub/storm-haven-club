

# Fix: Hide Non-Active Sessions from Admin Day View

## Problem
The admin **Classes → Day View** is showing all 20 sessions for today, but only **1 is actually active** (`is_hidden = false`). The other 19 are marked `is_hidden = true` (meaning their schedules were deactivated and the reconciliation process hid them). The current "Show inactive" toggle only filters by class type `is_active`, not by session `is_hidden`.

The Week Calendar view already handles this correctly with separate `showCancelled` and `showHidden` filters — the Day View just never got the same treatment.

## Plan

### Step 1: Filter hidden sessions by default in Day View query
In `src/pages/admin/Classes.tsx`, update the Day View query (line ~116-128) to add `.eq('is_hidden', false)` by default, matching what the public schedule does. Also add `.eq('is_cancelled', false)` to hide cancelled sessions by default.

### Step 2: Update the "Show inactive" toggle to also reveal hidden/cancelled sessions
Rename or expand the existing `showInactive` toggle to act as a "Show all" toggle that:
- Removes the `is_hidden = false` filter from the query
- Removes the `is_cancelled = false` filter from the query
- Keeps the existing `is_active` client-side filter removal

This way, by default admins see only the classes that are actually running. When they toggle "Show inactive," they see everything (hidden, cancelled, inactive class types) for auditing purposes.

### Step 3: Visual indicators for hidden/cancelled sessions
When "Show inactive" is on, add subtle visual cues (like the calendar view already does):
- Hidden sessions get reduced opacity and an eye-off icon
- Cancelled sessions get strikethrough styling

## Result
Today's admin Day View will show **1 class** by default instead of 20, dramatically reducing clutter. The toggle remains available for when staff need to audit or review past/deactivated sessions.

