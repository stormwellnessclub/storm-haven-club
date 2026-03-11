

# Staff Communication Hub: Tasks, Notes, and Messaging

## What We're Building

A unified **Staff Hub** inside the admin portal with three modules:

1. **Task Board** — Shared to-do lists with assignment, priority, due dates, and completion tracking
2. **Notes Board** — Shared notes/announcements with visibility controls (all staff, specific roles, or specific people)
3. **Staff Chat** — Real-time messaging between staff members (1:1 and channels), fully monitored by super admins

All three support **push-style notifications** via in-app real-time alerts (sound + badge + toast) using the existing notification infrastructure.

---

## Database Schema (4 new tables)

### `staff_tasks`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| title | text | Task name |
| description | text | Optional details |
| priority | enum(low, medium, high, urgent) | |
| status | enum(todo, in_progress, done) | |
| created_by | uuid → auth.users | Who created it |
| assigned_to | uuid → auth.users | Nullable — who it's for |
| due_date | date | Nullable |
| visible_to_roles | app_role[] | Which roles can see this task (empty = all staff) |
| completed_at | timestamptz | |
| created_at / updated_at | timestamptz | |

### `staff_notes`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| title | text | |
| content | text | Rich text / markdown |
| created_by | uuid → auth.users | |
| visibility | enum(all_staff, specific_roles, specific_users) | |
| visible_to_roles | app_role[] | When visibility = specific_roles |
| visible_to_users | uuid[] | When visibility = specific_users |
| is_pinned | boolean | Super admin can pin |
| created_at / updated_at | timestamptz | |

### `staff_channels`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | e.g. "Front Desk", "General" |
| channel_type | enum(general, department, direct) | |
| visible_to_roles | app_role[] | Empty = all staff |
| member_ids | uuid[] | For direct messages |
| created_by | uuid | |
| created_at | timestamptz | |

### `staff_messages`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| channel_id | uuid → staff_channels | |
| sender_id | uuid → auth.users | |
| message_body | text | |
| is_read_by | uuid[] | Track who's read it |
| created_at | timestamptz | |

All tables get **realtime** enabled. RLS policies ensure:
- Staff can only see tasks/notes/messages matching their roles or directed to them
- Super admins can see everything (monitoring)
- Only creators or admins can edit/delete

---

## UI Structure

### New page: `/admin/staff-hub`
Accessible to all staff roles. Three tabs:

**Tasks Tab**
- Kanban-style columns (To Do → In Progress → Done) or simple list view
- Create task with title, description, priority, assignee, due date, role visibility
- Filter by: assigned to me, created by me, all visible
- Drag or button to change status

**Notes Tab**
- Card grid of notes/announcements
- Pinned notes appear at top
- Create note with visibility selector (all staff / specific roles / specific people)
- Super admin sees all; other staff see only what's visible to them

**Chat Tab**
- Left sidebar: list of channels + direct messages
- Auto-created department channels (Front Desk, Classes, Cafe, etc.)
- Direct message any staff member
- Real-time message stream using Supabase realtime
- Super admin can view all channels (monitoring badge visible so staff know)
- Unread count badges

### Notifications
- Reuse the existing `playNotificationChime()` audio system from `CheckInSupportPanel`
- Real-time subscription on `staff_messages` and `staff_tasks` for INSERT events
- Toast notifications for new messages and task assignments
- Badge count on the "Staff Hub" sidebar link showing unread messages + assigned tasks

---

## Files to Create/Modify

| File | Action |
|------|--------|
| Database migration | Create 4 tables + RLS + realtime |
| `src/pages/admin/StaffHub.tsx` | New page with 3 tabs |
| `src/components/staff-hub/TaskBoard.tsx` | Task list/kanban component |
| `src/components/staff-hub/NotesBoard.tsx` | Notes grid component |
| `src/components/staff-hub/StaffChat.tsx` | Chat interface component |
| `src/components/staff-hub/CreateTaskDialog.tsx` | Task creation form |
| `src/components/staff-hub/CreateNoteDialog.tsx` | Note creation form |
| `src/components/staff-hub/ChatMessageInput.tsx` | Message composer |
| `src/lib/permissions.ts` | Add `/admin/staff-hub` route for all staff |
| `src/components/admin/AdminSidebar.tsx` | Add Staff Hub link under Operations |
| `App.tsx` | Add route |

---

## Key Design Decisions

- **Monitoring transparency**: Chat shows a small "Monitored" indicator so staff are aware super admins can read all channels
- **Department channels auto-created**: On first load, seed default channels (General, Front Desk, Classes, Cafe, Spa, Childcare) if they don't exist
- **No external push notifications** (no Firebase/APNs setup needed) — uses in-app real-time toasts + sound, which works while the app is open. Browser push notifications can be added later if needed.

