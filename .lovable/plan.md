## Add Support / Concierge inbox to Front Desk

Front Desk staff will access member support and concierge messages from inside the `/frontdesk` shell, using their own Supabase login (with `front_desk` role). RLS already allows `front_desk` to read/write `email_conversations` and `email_messages`.

### 1. Sidebar entry
- Add a new tab in `src/pages/frontdesk/FrontDeskShell.tsx` TABS array:
  - key: `messages`, label: `Messages`, to: `/frontdesk/messages`, icon: `MessageCircle`
- Show a small red count badge on the tab using `useAdminSupportNotifications` (open + unread).

### 2. Route + page
- New file `src/pages/frontdesk/Messages.tsx` that renders the same admin email inbox UI inside the front desk shell. Reuse the existing admin messages component from `/admin/emails` (extract the inner component if it's currently coupled to the admin layout), wrapped in `BareAdminLayoutProvider` so no admin chrome renders.
- Register the route in the app router next to the other `/frontdesk/*` routes.

### 3. Auth gate
- Front Desk shell today is PIN-only. For this tab only, require a Supabase session with the `front_desk` (or higher) role. If the user is not signed in, show an inline "Sign in to view Messages" panel that calls the existing auth flow and returns to `/frontdesk/messages`. Other Front Desk tabs remain PIN-only.
- No RLS changes needed — `front_desk` already has SELECT on `email_conversations` / `email_messages`, and staff SELECT/manage policies cover replies for admin/manager.
  - Note: current `Staff can manage all messages/conversations` policies only include `super_admin`/`admin`/`manager`. To let Front Desk **reply**, add `front_desk` to the INSERT policy on `email_messages` (staff-side sends) and to the UPDATE policy on `email_conversations` (status changes like open → resolved). Read-only would work without this.

### 4. Top-bar alert (small)
- Reuse `SupportAlertCard` styling into a compact header pill on the FD shell that links to `/frontdesk/messages` when there are open/unread tickets. Sits next to the existing Cafe order banner logic.

### Technical notes
- No new tables. Reuse `useEmailConversations`, `useEmailMessages`, `useAdminSupportNotifications`.
- Category filter: show both `support` and `class_support` (and any concierge category if present) with tabs mirroring the member portal Support page.
- Single migration only if you approve extending staff INSERT/UPDATE policies to `front_desk` so replies work.
