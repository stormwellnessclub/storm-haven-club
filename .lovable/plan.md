

## Fix Kids Care Hours Editing

### Problem

The editor uses an `initialized` state flag to track which date's data has been loaded into the local editing state. After saving, the query cache is invalidated and data refetches, but `initialized` still equals the current `dateStr`. This means the local editing state never re-syncs with the freshly saved data from the database. On subsequent edits or page interactions, the component can get into a stale state where changes don't reflect properly.

Additionally, the save `onSuccess` callback in the hook doesn't reset the editor's initialization state, so the component has no way to know it should re-load from the server.

### Fix

#### File: `src/components/admin/KidsCareHoursEditor.tsx`

1. **Reset `initialized` after successful save** — Pass an `onSuccess` callback to the `saveSlots.mutate()` call that resets `initialized` to `""`, forcing the component to re-sync local state from the freshly fetched server data on the next render.

2. **Same fix for copy operation** — The copy mutation's `onSuccess` should also reset `initialized` so that if the user copies to the currently selected date, the editor re-syncs.

This ensures that after any save or copy, the editor always loads the latest data from the database into the editable inputs.

