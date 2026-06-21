Fix the achievement/milestone celebration flow so old backlog does not replay, but newly earned items still celebrate exactly once.

Plan:
1. Keep the database as the source of truth with `celebrated_at` for one-time display state.
2. Remove the overly broad frontend suppression that can permanently hide valid future celebrations.
   - For achievements, stop using `user + achievement_type` as a localStorage blocker.
   - Only use the row `id` as a short-term duplicate guard during the same browser session.
3. Change the query logic to only return genuinely new uncelebrated rows, not stale backlog.
   - Add a small grace rule: show uncelebrated achievements/milestones that were earned recently or inserted while the portal is active.
   - Continue marking old backlog as already celebrated so it does not appear every login.
4. Fix class milestones so the backend does not silently consume a milestone before the UI gets a reliable chance to display it.
   - `get_pending_class_milestone()` should read the pending milestone.
   - `mark_class_milestones_seen()` should mark it after the host has mounted the overlay.
5. Add a focused migration to repair current state:
   - Keep already-consumed old backlog hidden.
   - Ensure future newly inserted achievement/milestone rows have `celebrated_at = null` until shown.
6. Verify with a read-only database check and a portal runtime check:
   - No popup on plain portal open when nothing new exists.
   - A newly created achievement/milestone appears once.
   - Reopening or changing tabs does not replay it.