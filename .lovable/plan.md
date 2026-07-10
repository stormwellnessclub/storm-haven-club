# Expandable Staff Notes

**Problem:** In Admin → Staff Hub → Notes, note cards clamp content to 4 lines and aren't clickable, so longer notes can't be read.

## Change

Edit `src/components/staff-hub/NotesBoard.tsx`:

1. Add a `selectedNote` state (StaffNote | null).
2. Make each note `Card` clickable (cursor-pointer, hover ring) that sets `selectedNote`. Stop propagation on the Pin/Delete buttons so those still work independently.
3. Add a Dialog at the bottom that renders when `selectedNote` is set, showing:
   - Title (with pin icon if pinned)
   - Visibility badge
   - Author name + created date
   - Full `content` with `whitespace-pre-wrap` (no line-clamp), scrollable if very long
   - Pin/Unpin + Delete actions for owner/super_admin
4. Keep the card preview as-is (line-clamp-4) so the grid stays compact; the dialog reveals the full note.

No schema, RLS, or business-logic changes — presentation only.
