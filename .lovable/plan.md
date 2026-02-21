

## Add Tabbed Layout to Admin Classes Page

### Overview
Add two tabs to the `/admin/classes` page:
1. **Soft Launch Schedule** (default) -- renders the existing `TempClassSchedule` component so admins can see the active timetable
2. **Full Schedule** -- contains the current "today's sessions" view with roster, attendance, and cancellation controls (this is the permanent database-driven schedule)

### Changes

**File: `src/pages/admin/Classes.tsx`**

- Import `Tabs, TabsList, TabsTrigger, TabsContent` from `@/components/ui/tabs`
- Import `TempClassSchedule` from `@/components/booking/TempClassSchedule`
- Wrap the page header and content area in a `Tabs` component with `defaultValue="soft-launch"`
- Move all existing session cards, roster dialog, and cancel dialog into a `TabsContent value="full-schedule"` block
- Add a `TabsContent value="soft-launch"` block that renders `<TempClassSchedule />` (without the booking action, since this is admin view)
- Keep all existing dialogs (roster, cancel) outside the tabs so they remain accessible from the full schedule tab

### What Admins Will See

| Tab | Content |
|-----|---------|
| **Soft Launch Schedule** (default) | The same weekly pilates timetable members see (Feb 20 - Mar 18) |
| **Full Schedule** | Today's database-driven sessions with roster view, check-in, and cancel controls |

No backend changes needed.
