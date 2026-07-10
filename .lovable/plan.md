# Front Desk Portal — Login Fix + Missing Tools

Two problems to solve:

1. **Desktop can't log in as `frontdesk@stormwellnessclub.com`** (iPad works).
2. **The `/frontdesk` shell is too thin** — no spa, no member lookup with credit/note actions, no non-member search, no guest passes, no visible cafe order alert.

---

## 1. Desktop login fix

The auth logs show the front-desk email hitting `invalid_credentials` on that machine while other accounts log in fine from the same IP. That's the browser sending the wrong password — almost always saved-password autofill from before we set it.

**Action:** Reset the front desk password to a fresh value you choose, then on the desktop:

- Delete any saved password for `stormwellnessclub.com` in the browser's password manager
- Type the new password by hand (no paste, no autofill)
- If it still fails, do a hard reload (Cmd/Ctrl+Shift+R) to clear any stale bundle

Tell me the new password (or say "generate one") and I'll set it on the account.

---

## 2. New Front Desk portal layout

Move from a top-tab-only layout to a **left sidebar with more tabs**, keeping the shell strictly isolated from `/admin` (no admin links, no financial data).

### New sidebar tabs

| Tab | Purpose |
|---|---|
| Reception | (existing) Kiosk check-in |
| Members | Look up any member → view credits, deduct class credit, add note, quick POS charge |
| Non-Members | Look up non-member accounts → same actions (charge, note) |
| Guest Passes | See today's guest passes, mark used, sell a new one |
| Spa | Today/upcoming spa appointments; "Book Appointment" button to create one |
| Schedule | (existing) Class schedule |
| POS | (existing) Cart-style charge |
| My Shift | (existing) Timesheet |

### Cafe order alert banner

Add a **persistent red banner at the very top** of the shell (above the header) that shows unfulfilled cafe orders in real time — e.g. "🔔 2 new cafe orders — tap to view". Clicking opens a slide-over listing pending orders with a "Mark ready" button. This runs alongside the existing `AdminCafeChime` sound so both audio and visual cues are present.

### What each new tab shows

**Members tab**
- Search by name / email / phone
- Result card: photo, tier, credits (class/PT/spa), subscription status, on-file card
- Actions: **Deduct class credit** (reason dropdown), **Add note**, **Charge** (opens POS with member pre-selected), **View class bookings**

**Non-Members tab**
- Same search UI, scoped to `non_member_profiles`
- Same actions (deduct credit, note, charge)

**Guest Passes tab**
- List of guest passes with status filter (pending / used today / expired)
- Row action: **Mark used**, **Resend link**, **Sell new guest pass** button

**Spa tab**
- Today + upcoming spa appointments (therapist, service, time, member/guest)
- **Book Appointment** button → uses the existing spa booking flow, scoped to non-financial actions

### Access boundaries (unchanged)

Front desk role stays blocked from: revenue dashboards, subscription editing, refunds, staff financials, application review, marketing tools. Every new action here uses existing RPCs (`deduct_class_credit`, `add_member_note`, `manual_charge`, `sell_guest_pass`, `book_spa_appointment`) so RLS enforcement is unchanged.

---

## Technical notes

- New pages under `src/pages/frontdesk/`: `Members.tsx`, `NonMembers.tsx`, `GuestPasses.tsx`, `Spa.tsx`.
- New route registrations in `src/App.tsx` for `/frontdesk/members`, `/frontdesk/non-members`, `/frontdesk/guest-passes`, `/frontdesk/spa`.
- Refactor `FrontDeskShell.tsx` from top-only nav to a two-pane layout: fixed left sidebar (collapsible on tablet) + main content. Header keeps clock, shift badge, End Shift, Lock.
- New `CafeOrderBanner.tsx` mounted inside the shell that subscribes to `cafe_orders` where status is `paid` / `in_progress` and shows a dismissible banner (dismissal is per-order, not global) with count + slide-over list.
- Reuse existing admin components where they contain no admin-only data:
  - `MemberSearch` → wrap for front desk (hide financial fields)
  - `SpaAppointmentsList` / `BookSpaDialog` → same
  - `GuestPassList` → same
- No new tables, no schema changes. All actions call existing RPCs.

Confirm the plan (and the password reset) and I'll implement.
