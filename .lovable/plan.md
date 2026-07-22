# Fix: Front desk can't see/hear cafe orders or concierge requests

## Root cause (verified)

The front desk shell uses a device PIN — no authenticated user. Every relevant hook queries tables whose RLS policies gate access on `has_any_role(auth.uid(), ...)`, which returns false with no auth session:

- `cafe_orders` — only visible to staff roles via `auth.uid()`; anon returns 0 rows → **red cafe banner never appears, chime never fires, `/frontdesk/cafe` POS queue is empty**.
- `email_conversations` / `email_messages` — same → **blue concierge/support banner never appears, chime never fires**.
- `useAdminCafeOrders` is also `enabled: !!user`, so even with correct RLS it would bail on the front desk.

This matches the existing kiosk pattern already used for check-ins (`kiosk_search_visitors`, `kiosk_todays_attendance`, etc.): the front desk is trusted by the shared PIN, so `SECURITY DEFINER` RPCs granted to `anon` are the right unlock.

## Fix

### 1. Database — four new `SECURITY DEFINER` RPCs (single migration)

All `SET search_path = public`, granted to `anon` + `authenticated`.

- `kiosk_cafe_notification_counts()` → `{ pending_count int, preparing_count int, total_active_count int }`. Feeds banner + chime count.
- `kiosk_cafe_active_orders()` → JSON array of active cafe orders (pending + preparing + ready), each with items, totals, note, member/non-member display name + phone. Feeds `/frontdesk/cafe` queue.
- `kiosk_update_cafe_order_status(order_id uuid, new_status text)` → updates status + `completed_at`, guarded to statuses `pending|preparing|ready|completed|cancelled`. Feeds Mark Preparing / Mark Ready / Complete buttons.
- `kiosk_support_notification_counts()` → `{ open_count int, unread_count int }`. Feeds blue banner + support chime.

### 2. Frontend — route the shell hooks through the kiosk RPCs when there's no auth user

- `src/hooks/useAdminCafeNotifications.ts` — if no `auth.uid()`, call `kiosk_cafe_notification_counts` instead of the direct table select. Keeps admin behavior unchanged.
- `src/hooks/useAdminSupportNotifications.ts` — same pattern with `kiosk_support_notification_counts`.
- `src/hooks/useAdminCafeOrders.ts` — remove the `!!user` gate; when there's no user, call `kiosk_cafe_active_orders` for reads and `kiosk_update_cafe_order_status` for status writes. Admin path (signed-in) keeps the existing direct-table read/update.

No changes to banners, chimes, or the front-desk cafe page component — they'll start receiving data automatically once the hooks return rows. Realtime chime channel already listens to `cafe_orders` INSERT (public realtime is fine to observe row-count changes); if realtime doesn't fire without auth, the 30s polling fallback already in `AdminCafeChime` will still trigger the chime because the count will now change.

## Verification

1. Sign out (or open front desk in a fresh tab), enter kiosk PIN, land on `/frontdesk`.
2. Have a member place a cafe order → red banner appears within 30s, chime plays.
3. Open `/frontdesk/cafe` → order visible with name + items + Mark Preparing / Complete buttons that actually update status.
4. Have a member send a concierge/support message → blue banner appears, support chime plays.
5. Signed-in admin `/admin/cafe/pos` continues to work exactly as before (unchanged code path).
