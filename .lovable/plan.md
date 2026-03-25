
Front Desk should NOT be an admin-sidebar mode. That was the wrong model for your use case.

What I’ll build instead
- A standalone top-level page, e.g. `/front-desk`
- No admin sidebar, no back-to-admin, no admin links anywhere
- No per-staff accounts
- A single shared kiosk access flow for training/front desk use
- Your normal admin stays on its own login flow

How it will be accessed
- Open `/front-desk` directly on the front desk computer
- First screen = simple kiosk unlock (PIN/passcode, not email/password)
- Once unlocked, it stays open for the desk
- Admin continues to live under `/admin` with your personal login
- Important: a sidebar link or `/admin/*` route would keep sharing the normal admin session, which is exactly what you do not want

What it will look like
```text
/front-desk
┌──────────────────────────────────────────────────────────┐
│ Storm Wellness | Front Desk                             │
├──────────────────────────────────────────────────────────┤
│ Check-In Hub (same search/select/check-in flow)         │
│ Search members / guest passes / class bookings / spa    │
│ [ search bar ]                                          │
│ [ results list ]      [ selected visitor details ]      │
│                                                          │
│ Recent Check-Ins        Today's Appointments            │
│ Today's Classes         Today's Kids Care               │
│                                                          │
│ Club Concierge | Member Support | Kids Support | Class  │
│ all reply inline, no “go to admin emails” links         │
└──────────────────────────────────────────────────────────┘
```

What changes from the current Check-In page
- Keep:
  - unified search
  - member / guest pass / class / spa check-in actions
  - recent check-ins feed
  - support queues
- Add:
  - today’s appointments panel
  - today’s classes/bookings panel
  - today’s kids care bookings panel
- Remove:
  - admin navigation
  - applications, revenue, reports, billing pages
  - member-profile navigation links
  - any “back to admin” or “view full in admin” links

Key technical correction
- Right now the app’s normal auth is shared across the site (`AuthContext` + protected `/admin/*` routes), so a sidebar link or admin-only route is the wrong architecture
- To avoid trainee accounts and keep front desk separate, the front desk page needs its own limited kiosk access layer and its own limited backend endpoints
- The current support panel also has links out to `/admin/emails`, so that must be changed to fully inline behavior

Implementation plan
1. Create a standalone `/front-desk` page
- New dedicated page outside `/admin/*`
- Full-screen kiosk layout with only front desk tools
- Reuse the check-in UI pattern from `CheckIn.tsx`, but remove sensitive extras and admin links

2. Add kiosk access instead of staff login
- Build a simple shared unlock flow (PIN/passcode) for the front desk route
- No per-trainee accounts
- No reliance on normal admin sidebar access

3. Add limited backend endpoints for kiosk-safe operations
- Fetch unified lookup results
- Process member / guest pass / class / spa check-ins
- Fetch recent attendance
- Fetch today’s appointments, classes, and kids care bookings
- Fetch/reply to support conversations as “Front Desk”
- Limit these endpoints so the kiosk can only do front-desk actions, not browse admin data

4. Update support UI for kiosk use
- Rework `CheckInSupportPanel` so all categories reply inline
- Remove current links that jump to `/admin/emails`
- Keep Club Concierge, Member Support, Kids Support, and Class Support visible

5. Keep admin fully separate
- Leave `/admin` as your personal admin space
- Do not add front desk controls into your normal admin flow
- Front desk becomes its own URL and its own limited experience

Files likely involved
- New front desk page + kiosk unlock components
- `src/pages/admin/CheckIn.tsx` logic extracted/reused
- `src/components/admin/CheckInSupportPanel.tsx` adapted for inline-only kiosk replies
- `src/App.tsx` for the new top-level route
- New limited backend functions / RPC wrappers for kiosk access

Expected result
- One shared front desk page for training
- No need to create many temporary staff accounts
- No path from that page back into admin
- Same operational tools you asked for: check-in, recent check-ins, appointments, kids care, concierge/member/kids/class support, guest pass check-in, and class attendee check-in
- Your admin remains a separate experience, not the thing trainees are using
