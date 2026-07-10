## Problem

`/frontdesk/members` and `/frontdesk/guest-passes` currently just render the full `AdminMembers` / `AdminGuestPasses` pages inside the front-desk shell. That exposes cohort counts (total members, cancelled, past due), billing filters, revenue tallies, and discount/bulk-sale controls that front desk should not see. They should only be able to look someone up and open the profile / mark passes used.

## Plan

### 1. New slim `/frontdesk/members` page (`src/pages/frontdesk/Members.tsx`)

Rewrite it as a lookup-only view — stop reusing `AdminMembers`:
- Header: "Member Lookup" + single search input (name / email / member ID / phone).
- No stat cards, no status/tier/card/subscription/waiver/founding filters, no cohort counts.
- Show results only after the user types (≥ 2 chars). Empty state: "Search for a member by name, email, or member ID."
- Each result row: photo, name, member ID, tier badge, and — only when relevant — a compact red "Cannot check in" chip if billing-blocked (past due / frozen / cancelled). No dollar amounts.
- Clicking a row opens the existing `MemberDetailSheet` (same drawer admin uses, so charge / add note / adjust credits / view profile all still work — those actions are already gated by role internally).
- Query pattern: on-demand `supabase.from('members').select(...).or(ilike name/email/member_id).limit(25)` instead of loading every member.

### 2. New slim `/frontdesk/guest-passes` page (`src/pages/frontdesk/GuestPassesPage.tsx`)

Rewrite as an operational-only view:
- Two sections: **Today's Passes** (list, with "Mark used" button) and **Sell a Guest Pass** (single-quantity form, fixed $25 price, guest name + email + phone + date).
- No revenue totals, no upcoming/expired/exhausted stat cards, no quantity picker, no discount toggle, no admin bulk sale.
- Reuse the existing `guest-passes` sell endpoint but hard-code `quantity: 1` and no discount.
- Keep the "Mark used" action on today's active passes.

### 3. Keep admin pages untouched

`/admin/members` and `/admin/guest-passes` stay exactly as they are for admin / super_admin. Only the `/frontdesk/*` wrappers change.

### 4. Sidebar labels

In `FrontDeskShell`, rename "Members" → "Member Lookup" and "Guest Passes" → "Guest Passes" (already fine) so the intent reads clearly.

## Technical Notes

- `MemberDetailSheet` is already the shared drawer — it's the same one `AdminMembers` opens, so no functionality is lost, just the surrounding cohort view.
- Search uses PostgREST `.or()` with `ilike` patterns; RLS on `members` already permits `front_desk` to read (via `has_any_role`) so no policy change is needed.
- Guest pass sell flow reuses the existing `create-guest-pass-checkout` (or equivalent) edge function currently used by `AdminGuestPasses` — just called with fixed args from the slim form.
- No DB migration, no RLS change, no admin regressions.
