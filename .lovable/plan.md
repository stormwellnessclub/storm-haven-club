# Frozen Member Scanner Behavior

## Goal
When a frozen member is scanned, the scanner should clearly display **"Membership Frozen"** (not allow auto-entry), but front desk staff should be able to **manually check them in** for a class or spa appointment they already have today — without needing a generic "override" reason.

## Current Behavior
- Scanner currently shows red **"Access Denied — Membership Frozen"**.
- Generic "Override Access (Staff Only)" button is available, but it just records a free-text reason and grants entry — it doesn't surface their actual class/spa bookings, so staff have no easy way to verify what they're checking in for.

## Proposed Changes

### 1. `process_member_scan` RPC (database migration)
- Keep returning `access_granted: false` and `denial_reason: 'membership_frozen'` so the scanner still loudly displays the frozen status.
- Add new fields to the response when the member is frozen:
  - `todays_class_bookings`: array of today's class session bookings (id, class name, start time, status)
  - `todays_spa_bookings`: array of today's spa appointments (id, service name, start time, therapist)
  - `valid_class_passes`: count of remaining class passes (so staff know if a drop-in pass is available)
- This lets the scanner UI show staff exactly what the frozen member is here for.

### 2. `src/pages/admin/Scanner.tsx`
When `denial_reason === 'membership_frozen'`:
- Keep the **amber/yellow "Membership Frozen"** banner (member name + photo still shown).
- Replace the generic "Override Access" button with a contextual **"Manual Check-In"** section that lists:
  - Today's class bookings → each with a **"Check In to Class"** button (calls existing `kiosk_check_in_class` RPC by `booking_id`).
  - Today's spa appointments → each with a **"Check In to Spa"** button (calls `kiosk_check_in_spa` RPC).
  - If they have remaining class passes but no booking today → show **"Use Class Pass for Drop-In"** (records check-in + notes pass usage).
  - If none of the above → show **"No paid bookings today — collect payment before entry"** with a small ghost "Override (Staff)" link as last resort.
- The amber "Membership Frozen" badge stays visible the entire time so staff are never confused about the member's billing state.

### 3. ScanResult type (`src/hooks/useMemberScanner.ts`)
Add the new optional fields to the `ScanResult` interface:
```ts
todays_class_bookings?: Array<{ id: string; class_name: string; start_time: string; status: string }>;
todays_spa_bookings?: Array<{ id: string; service_name: string; start_time: string; therapist?: string }>;
valid_class_passes?: number;
```

### 4. No changes to portal/dashboard access
Frozen members continue to log in normally and use the portal (already working — `ProtectedMemberRoute` allows frozen).

## Files to Edit
- `supabase/migrations/<timestamp>_scanner_frozen_bookings.sql` — update `process_member_scan` to include today's bookings + pass count for frozen members
- `src/hooks/useMemberScanner.ts` — extend `ScanResult` type
- `src/pages/admin/Scanner.tsx` — replace generic override with contextual "Manual Check-In" panel for frozen scans

## Out of Scope
- Dashboard tile graying (already functional for frozen)
- Kiosk (`/front-desk`) — separate flow, not part of this request

## Acceptance
- Scan a frozen member → scanner shows amber "Membership Frozen" with member name/photo.
- If they have a class today → staff sees a "Check In to Class: [Name @ Time]" button and one tap checks them in.
- If they have a spa appointment today → same for spa.
- No auto-entry; staff always confirm what the frozen member is here for.