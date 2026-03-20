

## Remove Soft Launch Tab & Filter Deactivated Classes

### Problem
1. The admin "Today's Classes" page (`/admin/classes`) still shows two tabs: "Soft Launch Schedule" and "Full Schedule" — the soft launch ended March 19, 2026, so both tabs are outdated
2. Deactivated class types still appear in class session queries because `useClassSessions.ts` doesn't filter by `class_types.is_active`

### Changes

#### 1. Simplify Admin Classes Page (`src/pages/admin/Classes.tsx`)
- Remove the `Tabs` wrapper, `TabsList`, `TabsTrigger`, `TabsContent` components entirely
- Remove the `SoftLaunchClassManagement` import and component
- Remove the `activeTab` state and `searchParams` tab logic
- Remove the "Full Schedule - Coming Soon" placeholder
- Show today's class sessions directly (the existing query for today's sessions is already there but unused in the rendered output — wire it up to display a simple list/cards of today's sessions with roster and cancel actions)

#### 2. Filter Deactivated Classes in `useClassSessions.ts`
- Add `.eq("class_types.is_active", true)` to both `useClassSessions` and `useUpcomingSessions` queries so deactivated class types no longer appear

#### 3. Filter in Admin Classes Query (`Classes.tsx`)
- Add `class_types!inner` join (instead of just `class_types`) and filter `.eq("class_types.is_active", true)` to the today's sessions query

### Technical Details
- The `!inner` join syntax ensures sessions with inactive class types are excluded from results entirely (rather than returning null for the join)
- The existing roster dialog, check-in mutation, and cancel dialog code in `Classes.tsx` stays — just the tabs wrapper and soft launch content are removed
- Today's sessions will render as cards showing class name, time, instructor, enrollment, and action buttons (View Roster, Cancel)

