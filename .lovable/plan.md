## What's happening

You didn't get a notification because raising `max_capacity` on a session doesn't currently trigger anything. The `notify-waitlist` edge function only runs when:

1. A member cancels a booking (`useBooking.ts`), or
2. A previously-notified waitlist entry expires (`process-expired-waitlist`).

Editing capacity in the admin UI just updates the row in `class_sessions` — nothing checks whether that new headroom should promote the next person on the waitlist. So your test raised capacity, but no one was ever flipped to `notified`, so no email/SMS/push fired.

## Fix

After a successful capacity update in the admin session editor, if the new capacity is greater than the old one **and** `current_enrollment < max_capacity`, invoke `notify-waitlist` once per new open seat (loop N times where N = new spots available, capped by waitlist length).

### Files to change

1. **`src/components/admin/AdminSessionsCalendar.tsx`** (and any other place capacity is edited — will grep during build to catch all edit paths, likely also `WeeklyCalendarView.tsx` / `ClassRoster.tsx`)
   - After the update mutation succeeds, compare old vs new capacity.
   - If capacity increased and open seats exist, call `supabase.functions.invoke('notify-waitlist', { body: { session_id } })` in a loop for each newly opened seat. `notify-waitlist` is idempotent-ish: it promotes exactly one person per call and no-ops if no seats or no waiters.

2. **No change to `notify-waitlist/index.ts`** — it already does the right thing (checks capacity, picks the next waiter, sends email + SMS + push).

### Verification

1. Set a class capacity below current enrollment count so it's "full," add a test user to the waitlist.
2. Bump capacity up by 1 in admin.
3. Expect: waitlist row flips to `notified`, email fires, push fires (on the published site with push enabled).
4. Check `notify-waitlist` edge function logs — should see "Notifying user X (position Y)".

### Note on your test

If push still doesn't arrive after this fix, the most likely reasons (in order):
- You tested in the **Lovable preview iframe** — push service workers don't register there; only the published site (`stormwellnessclub.com`) works.
- You never accepted the "Enable" toast after joining the waitlist, so there's no row in `push_subscriptions` for your user.
- On iOS Safari, the site must be installed to Home Screen first.

Email should always arrive regardless — if it doesn't after this fix, we'll look at `email_send_log` next.

### Out of scope

- SMS delivery fixes
- Push infrastructure changes
- The 5-minute claim window
