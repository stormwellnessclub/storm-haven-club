

# Spa Admin Management System

## Goal
Build a comprehensive admin panel to manage spa services, therapists, rooms, and availability calendars — without opening bookings to clients yet. All services remain "Coming Soon" on the public page until you manually activate them.

## Database Tables (6 new tables)

**`spa_services`** — Master service catalog (replaces hardcoded list)
- id, name, description, category, duration_minutes, cleanup_minutes, price, member_price, is_active (default false), display_order, popular, requires_intake_form, created_at, updated_at

**`spa_therapists`** — Staff profiles
- id, full_name, email, phone, bio, specialties (text[]), photo_url, is_active, created_at, updated_at

**`spa_rooms`** — Treatment rooms
- id, name, description, room_type (e.g. "treatment", "recovery", "wet"), is_active, created_at

**`spa_therapist_services`** — Which therapists can perform which services
- id, therapist_id (FK), service_id (FK)

**`spa_service_availability`** — Per-service or per-therapist calendar slots
- id, service_id (FK), therapist_id (FK, nullable), room_id (FK, nullable), day_of_week (0-6), start_time, end_time, max_bookings, is_active

**`spa_service_addons`** — Optional extras
- id, name, description, price, duration_minutes, is_active, applicable_categories (text[]), created_at

Seed the ~44 existing hardcoded services into `spa_services` with `is_active = false`.

## Admin UI — New page: `/admin/spa-management`

Tabbed interface with 4 tabs:

**Services Tab**
- Table of all services with active/inactive toggles
- Click to edit details (price, duration, description, etc.)
- No availability editing here — that's in the Calendar tab

**Therapists Tab**
- Add/edit therapists: name, bio, specialties, photo, active toggle
- Assign therapists to services via checkboxes
- Per-therapist view of assigned services

**Rooms Tab**
- Add/edit rooms: name, type, description, active toggle
- Simple list management

**Availability / Calendar Tab**
- Select a service → configure which days/times it's available
- Assign therapist + room per availability slot
- Grid or list view showing: Service → Day → Time range → Therapist → Room
- Ability to create multiple slots per service (e.g. "Deep Tissue: Mon-Fri 9am-5pm with Sarah in Room A, Sat 10am-2pm with Mike in Room B")

## Sidebar & Routing
- Add "Spa Management" under Wellness & Spa in AdminSidebar
- Add route + permissions for super_admin, admin, manager, spa_staff

## Public Spa Page — No changes yet
- Keep all services as "Coming Soon" — no bookings opened
- Future step: when you activate a service and it has availability configured, it becomes bookable

## Files
- **New migration**: 6 tables + seed data + RLS policies
- **New**: `src/pages/admin/SpaManagement.tsx` (tabbed admin page)
- **New**: `src/hooks/useSpaManagement.ts` (CRUD hooks for all spa admin tables)
- **Edit**: `src/components/admin/AdminSidebar.tsx` (add link)
- **Edit**: `src/lib/permissions.ts` (add route)
- **Edit**: `src/App.tsx` (add route)

