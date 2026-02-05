
# Admin Class Management System Redesign

## Problem Summary

The current admin class management interface is fragmented, uses small dialogs instead of full pages, and lacks the depth of functionality seen in professional systems like Mindbody. Key issues:

| Current Page | Issue |
|-------------|-------|
| `/admin/class-types` | Basic table view with dialog-only editing. No drill-down into schedules, no "+" Schedule button per class. |
| `/admin/class-schedules` | Separate page from class types. Uses table view + dialog. No visual calendar view. |
| `/admin/classes` | Only shows TODAY's sessions as cards. Cannot browse future dates or add one-off classes. |

**Mindbody Comparison**: Their system shows expandable categories, inline "Add Class" / "+ Schedule" actions per class type, a full-page scheduling form with day-of-week selectors, date ranges, and capacity/pricing options—all without navigating away.

---

## Proposed Solution: Unified Class Management Page

Create a **new full-page Class Management experience** at `/admin/class-types` (or `/admin/class-management`) that combines:

1. **Expandable Class Type List** (like Mindbody's category sections)
   - Shows all class types grouped by category (Pilates/Cycling, Aerobics, Other)
   - Each class type row shows: Name, # of active schedules, "View Schedules" toggle
   - Inline "+ Schedule" button per class type
   - Click to expand and see all recurring schedules for that class

2. **Full-Page Class Detail View**
   - When clicking a class type name, navigate to `/admin/class-types/:id`
   - Shows: Class info (name, description, capacity, duration, heated status)
   - Lists all recurring schedules for that class
   - "Add Schedule" button opens a full form (not a small dialog)
   - "Add Single Class" for one-off sessions (not recurring)

3. **Enhanced Scheduling Form**
   - Toggle: Recurring Class vs Single Class
   - Date range: Start Date / End Date
   - Day-of-week multi-select buttons (Mo Tu We Th Fr Sa Su)
   - Time: From / To with dropdowns
   - Instructor selection
   - Room selection
   - Capacity & waitlist settings
   - "Add another time" button for multiple time slots

4. **Classes/Sessions Calendar View**
   - Option to view upcoming sessions in a weekly calendar format
   - Filter by class type, instructor, room
   - Click session to view roster, cancel, or edit

---

## Implementation Details

### New Files to Create

| File | Purpose |
|------|---------|
| `src/pages/admin/ClassTypeDetail.tsx` | Full-page detail view for a single class type with schedules |
| `src/components/admin/ClassScheduleForm.tsx` | Reusable full schedule form component |
| `src/components/admin/ClassTypeCard.tsx` | Expandable card component for class types list |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/admin/ClassTypes.tsx` | Complete redesign: expandable accordion list, category grouping, inline actions |
| `src/App.tsx` | Add route for `/admin/class-types/:id` |
| `src/components/admin/AdminSidebar.tsx` | Consolidate "Class Types" and "Schedules" into single "Class Management" link |

### Database

The existing schema is adequate:
- `class_types` - Class definitions (name, category, duration, capacity)
- `class_schedules` - Recurring weekly patterns (day, time, instructor, room)
- `class_sessions` - Generated individual sessions

### New Features

1. **Single/One-Off Class Support**
   - Add ability to create a class_session directly without a recurring schedule
   - Use case: Special workshops, guest instructor events, holiday classes

2. **Schedule Deactivation UI**
   - Currently schedules can be set inactive, but no easy UI
   - Add "Pause" / "Deactivate" toggle per schedule

3. **Bulk Schedule Generation**
   - After adding/editing schedules, prompt to regenerate sessions
   - Show affected date range

---

## UI/UX Design

### Class Types List (New Design)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Class Management                                    [+ Add Class Type] │
├────────────────────────────────────────────────────────────────────────┤
│ ▼ Pilates & Cycling                                     [Add Class]   │
├────────────────────────────────────────────────────────────────────────┤
│   Cycle                              41 schedules       [+ Schedule] ▸ │
│   Pilates Flow – All Levels          13 schedules       [+ Schedule] ▸ │
│   Reformer Sculpt – Adv/Int          16 schedules       [+ Schedule] ▸ │
│   Reformer Sculpt – All Levels        5 schedules       [+ Schedule] ▸ │
│   ...                                                                  │
├────────────────────────────────────────────────────────────────────────┤
│ ▼ Aerobics & Fitness                                    [Add Class]   │
├────────────────────────────────────────────────────────────────────────┤
│   Bootcamp                            1 schedule        [+ Schedule] ▸ │
│   Bootcamp Full Body                  1 schedule        [+ Schedule] ▸ │
│   Mat Pilates                         5 schedules       [+ Schedule] ▸ │
│   ...                                                                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Class Type Detail Page

```
┌────────────────────────────────────────────────────────────────────────┐
│ ← Back to Class Types                                                  │
│                                                                        │
│ ┌──────────────────────────────────────┐                              │
│ │ CYCLE                          [Edit]│                              │
│ │ Category: Pilates & Cycling          │                              │
│ │ Duration: 50 min | Capacity: 10      │                              │
│ │ ☐ Heated                             │                              │
│ └──────────────────────────────────────┘                              │
│                                                                        │
│ Recurring Schedules (41)                    [+ Add Schedule]          │
│ ┌────────────────────────────────────────────────────────────────────┐│
│ │ Day       │ Time        │ Instructor    │ Room     │ Actions       ││
│ ├───────────┼─────────────┼───────────────┼──────────┼───────────────┤│
│ │ Monday    │ 6:00 AM     │ Sarah J.      │ Cycle    │ [Edit] [Off]  ││
│ │ Monday    │ 9:00 AM     │ Mike R.       │ Cycle    │ [Edit] [Off]  ││
│ │ Monday    │ 5:30 PM     │ Lisa T.       │ Cycle    │ [Edit] [Off]  ││
│ │ Tuesday   │ 6:00 AM     │ Sarah J.      │ Cycle    │ [Edit] [Off]  ││
│ │ ...                                                                 ││
│ └────────────────────────────────────────────────────────────────────┘│
│                                                                        │
│ Upcoming Sessions                                    [+ Add One-Off]   │
│ ┌────────────────────────────────────────────────────────────────────┐│
│ │ Today:         2 sessions (6:00 AM, 9:00 AM)                       ││
│ │ This Week:     14 sessions                                         ││
│ │ Next 4 Weeks:  56 sessions                                         ││
│ │ [View Session Calendar]                                            ││
│ └────────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────┘
```

### Schedule Form (Full Page Section)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Add Schedule for: CYCLE                                                │
├────────────────────────────────────────────────────────────────────────┤
│ Where and when                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐
│ │ ○ Recurring class            ○ Single class                        │
│ └─────────────────────────────────────────────────────────────────────┘
│                                                                        │
│ ┌──────────────────────┐  ┌──────────────────────┐                    │
│ │ Start: 02/05/2026    │  │ End: 02/05/2027      │ ← 1 year from now │
│ └──────────────────────┘  └──────────────────────┘                    │
│                                                                        │
│  [Mo] [Tu] [We] [Th] [Fr] [Sa] [Su]                                   │
│              ▲                                                         │
│           Selected                                                     │
│                                                                        │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│ │ From: 7:00AM │  │ To: 7:50AM   │  │ Repeats: 1   │  │ Week(s)     │ │
│ └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│                                                                        │
│ ┌─────────────────────────────────────┐                               │
│ │ Instructor: [Select Instructor ▼]  │                               │
│ └─────────────────────────────────────┘                               │
│                                                                        │
│ ┌─────────────────────────────────────┐                               │
│ │ Room: [Select Room ▼]              │                               │
│ └─────────────────────────────────────┘                               │
│                                                                        │
│ Class size                                                             │
│ ┌──────────────────────┐  ┌──────────────────────────────────────────┐│
│ │ Total capacity: 10   │  │ Waitlist capacity: 2                     ││
│ └──────────────────────┘  └──────────────────────────────────────────┘│
│                                                                        │
│ Online options                                                         │
│ ☑ Allow members to signup for this class online                       │
│                                                                        │
│ ┌────────────────────────────────────────────────── [+ Add another time]
│                                                                        │
│                                        [Cancel]  [Schedule Class]      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Class Type Detail Page
- Create `/admin/class-types/:id` route
- Build `ClassTypeDetail.tsx` with class info display
- Show all schedules for the class type in a table
- Add/Edit schedule functionality with full form

### Phase 2: Redesign Class Types List
- Convert to expandable accordion by category
- Add inline "+ Schedule" buttons
- Show schedule count per class type
- Quick actions menu per class

### Phase 3: Enhanced Scheduling
- Add "Single class" (one-off) creation option
- Date range selector for recurring schedules
- Multi-day selection for recurring
- "Add another time" for multiple slots

### Phase 4: Session Management
- Improve `/admin/classes` to show full calendar view
- Add date navigation (not just today)
- Ability to edit individual sessions
- Bulk session operations

---

## Benefits

1. **Full-Page Experience**: No more cramped dialogs for complex forms
2. **Drill-Down Navigation**: Click into class types to see all details
3. **Mindbody-Like Workflow**: Category grouping, inline actions, visual scheduling
4. **One-Off Classes**: Support for workshops and special events
5. **Better Data Visibility**: See schedule counts, upcoming sessions at a glance

---

## Files Summary

| Action | File | Description |
|--------|------|-------------|
| Create | `src/pages/admin/ClassTypeDetail.tsx` | Full-page class type management |
| Create | `src/components/admin/ClassScheduleForm.tsx` | Comprehensive schedule form |
| Modify | `src/pages/admin/ClassTypes.tsx` | Accordion list with category grouping |
| Modify | `src/App.tsx` | Add ClassTypeDetail route |
| Modify | `src/components/admin/AdminSidebar.tsx` | Simplify navigation (optional) |
