## Goal
When a member is checked in at the Front Desk and it's their first-ever visit to the club, flag it clearly, mark the check-in record, and prompt the front-desk staff to offer a tour.

## Detection rule
"First club visit" = the member has **zero prior rows** in `public.check_ins` at the moment we insert this check-in. This is a permanent, one-time flag per member and works retroactively for every existing member.

## Changes

### 1. Database migration — mark first visits in the check-in RPC
Update `public.kiosk_check_in_member` to:
- Before inserting, check `SELECT EXISTS(... FROM check_ins WHERE member_id = v_member.id)`.
- If none exists, insert the new row with `notes = 'First club visit'` (instead of `'Kiosk check-in'`).
- Return an extra field `is_first_visit: true|false` in the success JSON so the UI can react.

No schema change is needed — we reuse the existing `notes` column as the durable marker.

### 2. Kiosk check-in hook (`src/hooks/useKioskCheckIn.ts`)
- Add `is_first_visit?: boolean` to `KioskCheckInResult`.

### 3. Front Desk UI (`src/pages/FrontDesk.tsx`)
- When `result.is_first_visit === true` and not `already_in`:
  - Replace the standard success toast with a prominent **first-visit celebration dialog** (large modal): "🎉 First club visit — {name}! Offer a tour?"
  - Two buttons: **"Tour offered ✓"** and **"Skip"**. Clicking either closes the dialog and refreshes the list. "Tour offered" appends a short line to the check-in `notes` (e.g., `First club visit · Tour offered by <staff>`) via a lightweight RPC or direct update; "Skip" leaves the marker as-is.
- Show a small **"1st Visit" gold badge** next to the member's name inside the selected-visitor detail panel whenever `is_first_visit` is true.

### 4. Today's check-in list (`src/hooks/useUnifiedAttendance.ts` + rendering)
- Include `notes` in the `check_ins` select (already fetched).
- In the list row for member check-ins, render a small **"1st Visit"** badge when `notes` starts with `First club visit`.

## Out of scope
- No changes to guest, class, or spa check-in flows.
- No email/SMS to the member; this is a staff-only cue.
- No new table; the `notes` column on `check_ins` is the source of truth.

## Technical notes
- The detection lives in the RPC (single source of truth), so members checked in from any surface using `kiosk_check_in_member` get the flag correctly. Other check-in paths (class/spa) do not affect this because we scope on `check_ins.member_id`, which represents general club entry.
- To append "Tour offered" text: expose a tiny RPC `mark_first_visit_tour_offered(p_check_in_id uuid, p_staff_name text)` that updates the notes column server-side (so we don't need a broad `UPDATE` policy on `check_ins`).
