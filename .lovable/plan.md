

# Re-engagement System: In-App Nudges (Phase 1)

Starting with in-app personalized nudge notifications on the member dashboard, since this is the foundation. Email, push, and SMS will follow as subsequent phases.

## How It Works

When a member logs into their dashboard, the system checks:
1. **Last check-in date** — from `check_ins` table, most recent `checked_in_at`
2. **Most-booked class type** — from `class_bookings` (confirmed/completed), grouped by `class_type_id`, ranked by count
3. **Next available session** — for that class type, from `class_sessions` where `session_date >= today` and has open spots

If the member hasn't checked in for 14+ days and there's an upcoming session of their favorite class with availability, show a nudge card on the dashboard.

## UI Component: `EngagementNudge.tsx`

A dismissible card placed on the dashboard after the "Welcome back" header and before "Up Next." Styled subtly — not alarming, more like a gentle suggestion.

```text
┌──────────────────────────────────────────────┐
│  ✨  We'd love to see you back              │
│                                              │
│  Your favorite class — Reformer Pilates —    │
│  has a spot open Thursday at 9:00 AM.        │
│                                              │
│  [Book Now]                          [×]     │
└──────────────────────────────────────────────┘
```

- Dismiss stores `nudge_dismissed` in `sessionStorage` (resets each session — non-intrusive)
- "Book Now" links to `/member/schedule`
- If no favorite class or no open sessions, the nudge doesn't show

## New Hook: `useEngagementNudge.ts`

Queries:
1. `check_ins` — latest check-in for the current member (via `useUserMembership` member ID)
2. `class_bookings` — all confirmed/completed bookings for this user, grouped client-side by class type to find the most-booked
3. `class_sessions` — next available session for that class type with `current_enrollment < max_capacity` and `session_date >= today`

Returns: `{ shouldShow, className, sessionDate, sessionTime, isLoading }`

## Files to Create
- `src/hooks/useEngagementNudge.ts` — data hook
- `src/components/member/EngagementNudge.tsx` — UI card

## Files to Modify
- `src/pages/member/Dashboard.tsx` — insert `<EngagementNudge />` after the welcome header section

## No database changes needed
All data comes from existing tables (`check_ins`, `class_bookings`, `class_sessions`, `class_types`).

