# Fix the misleading duplicate-class alerts

## Confirmed cause

- The four rows in the screenshot compare August schedule rules with their September replacements:
  - Sunday 11:00 AM Reformer
  - Tuesday 7:00 PM Reformer
  - Wednesday 11:00 AM Mat Pilates
  - Wednesday 12:00 PM Reformer
- The live records show the earlier rules end on August 31 and the replacements begin in September, so none of these four pairs share an active date. They are not scheduling conflicts.
- The screenshot is showing the older pair-based alert UI. The current source already has date-window-aware analysis and a clearer grouped panel, but the running public page is not reflecting that behavior.
- Separately, the database contains stale generated class sessions from expired or deactivated rules. These are a session-reconciliation issue, not evidence that the four active schedule rules overlap.

## Implementation

1. **Make conflict detection date-specific**
   - Keep expired schedule rules visible in the schedule table for history, but exclude them from current conflict warnings.
   - Compare rules only when their effective date windows intersect and their recurring weekday can actually occur within that intersection.
   - Treat a one-off class as conflicting only on its exact date.
   - Use the same date-aware check both in the page alert and when saving/editing a schedule.

2. **Make the alert explain the actual collision**
   - Show the applicable date or date range on every conflict.
   - Group exact duplicate slots instead of showing confusing pair combinations.
   - Distinguish room overlap from instructor overlap and avoid counting the same pair twice as separate critical issues.
   - Keep safe edit/deactivate controls and show booking counts before deactivation.

3. **Reconcile stale generated sessions safely**
   - Identify future sessions generated outside their schedule rule’s effective window or from deactivated rules.
   - Hide/cancel only invalid future sessions with no bookings.
   - Preserve booked, cancelled, completed, and historical session records; never delete attendance or cancellation history.
   - Correct the generation/reconciliation path so expired and deactivated rules cannot recreate those sessions.

4. **Verify end to end**
   - Confirm the four screenshot rows no longer appear as conflicts.
   - Confirm a legitimate same-date room or instructor collision still blocks/warns correctly.
   - Confirm a Friday one-off class saves when the room is free on that exact Friday.
   - Check the admin page in the live preview and verify the schedule list and generated sessions remain intact.

## Technical scope

- Frontend conflict analysis and alert rendering.
- Schedule create/edit validation.
- Existing class-session generation/reconciliation logic and a narrowly scoped data cleanup for invalid future sessions only.
- No redesign and no unrelated class, booking, or security changes.
