# Make the PT waitlist clearer for staff (and easier on phones)

## What's going wrong today
- **The waitlist rule stays the same.** The first request holds the hour. Anyone after that goes on the waitlist until you approve or decline the first request. The calendar just doesn't make that clear.
- **The calendar tags are hard to read.** "Waitlist (1)" and "+1" sit on top of the session cards and don't tell you who is booked, who requested, or how many spots are left.
- **The admin calendar is hard to use on a phone.** There's already a phone version of the trainer screens (Today, Clients, Next session). But it doesn't show requests or the waitlist, so you still end up on the cramped desktop calendar.

## What changes

### 1. Keep "first request holds the hour"
- Nothing changes in how hours fill up.
- If you decline the first request, or a client cancels it, the slot card highlights who is **next in line** and shows a **Move to request** button. Staff still decide who gets the hour.

### 2. One clear "slot card" on the calendar instead of tags
Tap any trainer hour that has activity to open a single panel. It shows:

```text
Thu Nov 19 · 6:30–7:30 PM · Storm · Semi-Private
Status: Held by request (first in line)
-----------------------------------------------
Requested   Fatima A.        [Confirm] [Offer other] [Decline]
Waitlist    1. Nadeen S.      [Move to request] [Contacted] [Remove]
```

- On the calendar, each hour gets one small, plain label instead of stacked tags, for example **"Requested · 1 waiting"** or **"Booked · 2 waiting."** A gold label means a spot opened up and someone is waiting.
- The vague "+1" labels go away.

### 3. Requests and the waitlist in the phone trainer app
- Add a **Requests** tab to the phone trainer screens (the same ones trainers will use with their own logins). It has three sections: Requests to answer, Waitlist, and Open spots with people waiting. Each uses the same slot card and buttons as above, sized for a phone.
- On the phone, the Today screen gets a "3 requests · 1 waitlist" shortcut at the top.
- Trainers only see their own hours. You see everyone.
- On a phone, opening the admin PT section offers a link to the phone trainer app.

## Not changing
- No automatic texts to people on the waitlist. Staff still reach out.
- The client request flow, trainer colors and the 24-hour rules stay the same.

## Technical details
- Add a staff-only `pt_schedule_slot_detail(trainer, start)` RPC that returns confirmed, requested and waitlist rows in the order people joined. Use it for both the desktop sheet and the mobile view. Trainers are limited to their own rows.
- Add `pt_waitlist_promote(id)` to turn a waitlist entry into a pending request after the holding request is declined or cancelled.
- In `PTSchedule.tsx`, replace the waitlist tags with a single label per hour and a `SlotDetailSheet`.
- Add `PTMRequests.tsx` at `/admin/pt/m/requests` to the mobile shell nav, plus a Today shortcut.
- Add tests for the per-hour label (requested/booked/opened plus waiting count) and for the next-in-line order.
