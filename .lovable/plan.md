## How cafe orders work today

**The flow when someone places a cafe order:**
1. Customer (or staff using POS) places order → row inserted in `cafe_orders` with `status = 'pending'`.
2. Order appears on **Admin → Cafe POS → Order Queue** tab.
3. Staff click status buttons to advance the order:
   - `pending` → **Start Preparing** → `preparing`
   - `preparing` → **Mark Ready** → `ready`
   - `ready` → **Complete** → `completed`
   - Or **Cancel** at any stage → `cancelled`
4. We just added: a coffee-icon badge in the admin header, an amber alert card on the admin dashboard, and a chime on every new order — visible/audible from any admin page.

**Do customers see status updates?**
Right now: **no**. There's a `useMyCafeOrders` hook that exists but isn't wired into any customer page. So when you mark an order "Preparing" or "Ready," the customer has no idea — they just wait. This is a gap worth closing.

## Why the chime is unreliable (the honest answer)

The chime depends on two things that are individually fragile:

1. **Browser autoplay policy** — Chrome/Safari block `Audio.play()` until the user has interacted with the page. If a staff member opens the admin tab and hasn't clicked anything yet, the very first chime silently fails. After they click once, it works for that session.
2. **Supabase Realtime websocket drift** — the realtime channel can silently disconnect (laptop sleep, network blip, tab backgrounded for a long time, dev-server reload). The subscription "looks" subscribed but stops receiving events. We never detect this and reconnect.

Past "fixes" addressed symptoms (audio format, mute toggle, channel naming) but not these two root causes. That's why it keeps regressing.

## Plan

### 1. Customer-facing order status

Add a **"My Cafe Orders"** card on the member portal dashboard (`/portal` and `/member`) showing the customer's recent active orders with a live status badge (Pending → Preparing → Ready → Completed) and an estimated ready time. Subscribe to realtime updates so when staff click "Mark Ready," the customer's screen updates within ~1 second.

Optional: send a push notification (we already have `send-push-notification`) when their order hits `ready`, so they don't have to keep the tab open.

### 2. Make the chime actually reliable

Three reinforcing fixes:

**a. Heartbeat + auto-reconnect for realtime**
Wrap the cafe and support realtime channels in a small helper that:
- Tracks `SUBSCRIBED` / `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED` states
- Auto-resubscribes on disconnect with exponential backoff
- Pings every 30s; if no event/heartbeat for 90s, force a reconnect
- Logs state transitions to console so we can verify it's healthy

**b. Polling fallback as a safety net**
Even with realtime working, every 30s the existing `useAdminCafeNotifications` query refetches. Add a small piece of state that compares the new active-order count to the previous count — if it went up and we *didn't* chime via realtime, chime now. This guarantees you hear the alert within 30s even if the websocket is silently dead.

**c. Unlock audio on first admin interaction**
On any first click/keypress in the admin layout, play a silent audio buffer to "unlock" the autoplay policy for the session. This eliminates the "first chime of the session is silent" problem.

**d. Visual fallback that can't fail**
The amber dashboard card and header badge are already in place — these don't depend on audio or realtime working perfectly. Make sure the badge pulses/animates when count > 0 so it's hard to miss even with sound off.

### 3. Verify it's actually working

Add a tiny **"Notification health"** indicator in the admin header (small green/red dot next to the bell) showing whether the realtime channel is currently `SUBSCRIBED`. If it ever goes red, you'll know immediately instead of finding out by missing an order.

## Technical details

- New file: `src/hooks/useReliableRealtime.ts` — wraps `supabase.channel` with reconnect/heartbeat logic, returns connection state.
- Refactor `AdminSupportChime.tsx` and `AdminCafeChime.tsx` to use `useReliableRealtime` and add the count-delta polling fallback.
- New file: `src/components/admin/AudioUnlocker.tsx` — one-time pointerdown/keydown listener on `AdminLayout` that plays a silent buffer.
- New section in `src/pages/portal/Dashboard.tsx` and `src/pages/member/...` (whichever the member uses) → `MyCafeOrdersCard` component using `useMyCafeOrders` + a realtime subscription filtered to `user_id=eq.{currentUser.id}`.
- Optional: edge function call from `useUpdateCafeOrderStatus` `onSuccess` when status becomes `ready` to fire a push notification to that customer.
- No DB migrations required — `cafe_orders` is already on the `supabase_realtime` publication with `REPLICA IDENTITY FULL`.

After approval I'll implement and verify the realtime channel state goes `SUBSCRIBED` and the polling fallback triggers correctly.