

# Front Desk Kiosk — Standalone Page

## What you get

A full-screen, spacious page at `/front-desk` (top-level, outside `/admin`). No login required — it's a public route protected only by a simple PIN screen (you set the PIN once, staff enter it to unlock the kiosk for the shift). No admin sidebar, no admin navigation, no sensitive data.

The layout uses large cards with plenty of breathing room across a big screen:

```text
/front-desk
┌──────────────────────────────────────────────────────────────┐
│  Storm Wellness Club  ·  Front Desk                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  CHECK-IN (full width, big search bar)              │    │
│  │  Search members / guests / class / spa              │    │
│  │  [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━] [Search]        │    │
│  │                                                     │    │
│  │  Results list          │  Visitor detail + action   │    │
│  │  (spacious cards)      │  (big check-in button)    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──── Stats ─────┐                                         │
│  │ 12 Total │ 8 In │ 4 Members │ 2 Guests │ ...           │
│  └─────────────────┘                                         │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  TODAY'S ATTENDANCE (full width table)               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌── Club Concierge ──┐ ┌── Member Support ──┐             │
│  │  (large card)       │ │  (large card)       │             │
│  │  Full ticket view   │ │  Full ticket view   │             │
│  │  Inline reply       │ │  Inline reply       │             │
│  └─────────────────────┘ └─────────────────────┘             │
│                                                              │
│  ┌── Kids Care ───────┐ ┌── Class Support ────┐             │
│  │  Today's bookings   │ │  Tickets            │             │
│  │  (large card)       │ │  (large card)       │             │
│  └─────────────────────┘ └─────────────────────┘             │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  TODAY'S CLASSES (class sessions with booking count) │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Each section gets a **full-size card** — no tiny cramped boxes. The support sections each get their own large card with full conversation view and inline reply, not the small collapsible panels from the admin check-in page.

## How access works

- URL: `/front-desk` — completely outside `/admin/*`
- No admin login needed. Opens a PIN entry screen
- You set a kiosk PIN (stored in a simple DB table or env secret)
- Staff type the PIN → page unlocks for the session (stored in sessionStorage)
- Your admin account on your separate browser/tab is completely unaffected
- No links from this page to `/admin` anything. Dead end. Staff can only use what's on this page

## What's on the page (and what's NOT)

**Included:**
- Member check-in (search, select, check in)
- Guest pass check-in (search, mark used)
- Class booking check-in (search, mark attended)
- Spa appointment check-in (search, mark arrived)
- Today's attendance feed with stats
- Club Concierge tickets — view + inline reply
- Member Support tickets — view + inline reply
- Kids Care Support — view + inline reply
- Class Support — view + inline reply
- Today's Kids Care bookings (child, parent, time, status)
- Today's class sessions with booking counts

**Excluded:**
- No admin sidebar/navigation
- No member counts, revenue, applications, billing, reports
- No links to member profiles or admin pages
- No "Back to Admin" or "Exit" links
- No admin account session sharing

## Plan

### 1. Create PIN gate component
- `src/components/kiosk/KioskPinGate.tsx` — full-screen PIN entry
- PIN checked against a `kiosk_settings` table (single row with hashed PIN)
- On success, sets `sessionStorage.kioskUnlocked = true`
- Migration: create `kiosk_settings` table with `pin_hash` column, no RLS (public read for PIN verification via RPC)
- RPC: `verify_kiosk_pin(pin text)` returns boolean — compares hash server-side

### 2. Create Front Desk page
- `src/pages/FrontDesk.tsx` — standalone full-screen page, no Layout/AdminLayout wrapper
- Reuses all check-in logic from `CheckIn.tsx` (search, select, check-in handlers for all 4 types)
- Reuses `useUnifiedCheckInSearch`, `useUnifiedAttendance`, `useMemberScanner`
- Large spacious cards for each section
- Support panel: refactored version of `CheckInSupportPanel` with all links replaced by inline-only actions (no `/admin/emails` links)
- Today's classes: query `class_sessions` for today, show class name + time + booking count
- Today's kids care: query `get_admin_kids_care_bookings` for today
- Strips out: billing arrears detail, member profile links, navigate-to-admin behavior in attendance rows

### 3. Add route
- `src/App.tsx`: add `/front-desk` as a top-level public route (no `ProtectedAdminRoute`)
- The PIN gate handles access control instead of auth

### 4. Add admin sidebar link
- `src/components/admin/AdminSidebar.tsx`: add "Front Desk Mode" with `Monitor` icon under Operations
- Links to `/front-desk` (opens in same tab — staff can bookmark it)

### 5. Add kiosk PIN management to admin settings
- In admin Settings page, add a "Kiosk PIN" section where you can set/change the front desk PIN

## Files to create/change
- **New**: `src/components/kiosk/KioskPinGate.tsx`
- **New**: `src/pages/FrontDesk.tsx`
- **Edit**: `src/App.tsx` — add `/front-desk` route
- **Edit**: `src/components/admin/AdminSidebar.tsx` — add sidebar link
- **Edit**: `src/pages/admin/Settings.tsx` — add kiosk PIN management
- **Migration**: create `kiosk_settings` table + `verify_kiosk_pin` RPC + `set_kiosk_pin` RPC (admin only)

