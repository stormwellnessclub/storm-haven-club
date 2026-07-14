## Goal

Front Desk should be able to view/adjust member credits and book credit-based services on a member's behalf from the member profile sheet, but must NOT see the "Delete Member Permanently" action (admin/super-admin only).

## Changes

### 1. Hide destructive admin actions from Front Desk
`src/components/admin/MemberDetailSheet.tsx`
- Add prop `viewerMode?: "admin" | "frontdesk"` (default `"admin"`).
- Wrap "Delete Member Permanently" button so it only renders when `viewerMode === "admin"` AND `isSuperAdmin()` (current gate). In front-desk mode it is never shown even if the underlying auth account happens to be super_admin.
- Also hide the destructive "Suspend Membership" button in front-desk mode (front desk should escalate cancellations/suspensions to admin). Non-destructive edits (profile, notes, tags, cafe credit, contract view) remain available.

`src/pages/frontdesk/Members.tsx` and `src/pages/frontdesk/ClassRoster` usage
- Pass `viewerMode="frontdesk"` to `<MemberDetailSheet />`.

### 2. New "Credits" tab in MemberDetailSheet
Add a `credits` tab (visible in both admin and front-desk mode) next to Cafe Credit.

Contents:
- List all active rows from `member_credits` for the member (class, red_light, cryo), showing `credits_remaining / credits_total`, cycle window, expires_at.
- Row actions:
  - **Adjust** (add or remove N) — writes to `credit_adjustments` and updates `member_credits.credits_remaining` (reuse logic from `src/pages/admin/MemberCredits.tsx`). Requires a reason string. Records `adjusted_by = auth.uid()` when present, otherwise a `frontdesk:<staff_pin_owner>` marker pulled from the front-desk session (falls back to `"frontdesk"`).
  - **Book on behalf** — opens a small sub-dialog with three options gated by which credit type has `credits_remaining > 0`:
    1. Red Light — pick date/time from available slots, call existing atomic booking RPC used by `/portal/recovery` (deducts red_light credit + creates booking).
    2. Cryotherapy — same flow, cryo credit.
    3. Class credit — inline picker of upcoming `class_sessions` with `spots_remaining > 0` (next 14 days), calls the same `book_class_with_credit` path used by member portal.
  - All three RPCs already enforce membership/freeze rules server-side, so no new business logic is added — the sheet just wires the calls with the member's `user_id`.

### 3. Front-desk-friendly UX details
- Adjust dialog defaults to `remove 1` when the button was clicked from a row with `credits_remaining > 0` (common "member just used a session" case).
- Show a green success toast "Removed 1 red_light credit for {member}" and refetch the credits query + `admin-members` list.
- Booking dialog closes on success and toasts "Booked {service} for {member} on {date time}".
- The Credits tab uses the same query hooks as `/admin/member-credits`, so admin and front desk see identical state.

### 4. No schema/RLS changes
- `member_credits` already grants `SELECT/UPDATE` to authenticated with row-level access via member ownership + staff role policies.
- `credit_adjustments` already allows staff inserts.
- Booking RPCs already accept a target `p_member_id` / `p_user_id` when invoked by staff roles.

If any RLS check fails at runtime we handle it in the follow-up turn — don't touch policies preemptively.

### Technical notes
- Reuse `EditCreditDialog` and adjustment mutation code from `src/pages/admin/MemberCredits.tsx`; extract the shared bits into a lightweight `MemberCreditsPanel` component (`src/components/admin/MemberCreditsPanel.tsx`) used by both the admin page and the sheet tab to avoid duplication.
- New `BookOnBehalfDialog` component under `src/components/admin/credits/` housing the three service pickers; it imports the same booking helpers the member portal uses (Recovery page + class booking hook) so behavior stays consistent.
- No changes to Front Desk auth or PIN flow.

## Files touched

- `src/components/admin/MemberDetailSheet.tsx` (viewerMode prop, hide Delete/Suspend, add Credits tab)
- `src/components/admin/MemberCreditsPanel.tsx` (new, extracted)
- `src/components/admin/credits/BookOnBehalfDialog.tsx` (new)
- `src/pages/admin/MemberCredits.tsx` (refactor to use the extracted panel — no behavior change)
- `src/pages/frontdesk/Members.tsx` (pass `viewerMode="frontdesk"`)
- Any other caller of `MemberDetailSheet` in `/frontdesk/*` routes (e.g. class roster) — pass the same prop.
