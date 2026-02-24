

## Enlarge the Class Roster Dialog

### Problem
The `ClassRosterDialog` is rendered as a `Dialog` with `max-w-2xl max-h-[90vh]`. The dialog header, description, "Add to Class" button, and tab controls consume most of the vertical space, leaving room for only ~2 roster rows. Scrolling inside a capped-height dialog is unreliable, especially on tablets.

### Solution
Convert the roster from a `Dialog` to a full-screen `Sheet` (slide-in panel) so the entire roster is visible without truncation.

### Changes

**File: `src/components/admin/ClassRosterDialog.tsx`**

1. Replace the `Dialog`/`DialogContent` wrapper with `Sheet`/`SheetContent` from `@/components/ui/sheet`, opening from the right side at full width on mobile and ~60% on desktop.
2. Replace `DialogHeader`/`DialogTitle`/`DialogDescription` with `SheetHeader`/`SheetTitle`/`SheetDescription`.
3. Place the roster table inside a `ScrollArea` so the list scrolls independently while the header and add-panel stay pinned.
4. Use a flex-column layout: fixed header at top, scrollable roster area fills remaining height.

### Technical Details

- Import `Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription` instead of Dialog equivalents
- SheetContent class: `sm:max-w-2xl w-full` (full width on mobile, capped on desktop)
- Roster area: wrap in `ScrollArea` with `flex-1 overflow-hidden` so it fills all remaining vertical space
- No logic changes -- only layout/container changes

