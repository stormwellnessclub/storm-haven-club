# Make the PT waitlist clearer for staff (and easier on phones)

## What's going wrong today
- **Semi-Private gets marked full too early.** Right now, one pending request from another client marks the whole hour "full." So when Fatima requested Thursday 6:30, Nadeen got pushed to the waitlist even though Semi-Private fits up to 4 people. That's why you saw a waitlist with open spots left.
- **The calendar tags are hard to read.** "Waitlist (1)" and "+1" sit on top of the session cards and don't tell you who is booked, who requested, or how many spots are left.
- **The admin calendar is hard to use on a phone.** There's already a phone version of the trainer screens (Today, Clients, Next session). But it doesn't show requests or the waitlist, so you still end up on the cramped desktop calendar.

## What changes

### 1. Spots follow each session type's limit
- An hour only counts as full when it reaches its session type's limit: Semi-Private 4, one-on-one 1. Confirmed sessions and pending requests both count toward the limit.
- Clients keep seeing open times until the hour is truly full. Only then does it show **Waitlist**.
- Clients still never see who else is booked.
- Nadeen's Thursday entry and any others like it: if there's still room, staff see a **"Spot open, move to request"** button. Nothing changes for clients automatically.

### 2. One clear "slot card" on the calendar instead of tags
Tap any trainer hour that has activity to open a single panel. It shows:

```text
Thu Nov 19 · 6:30–7:30 PM · Storm · Semi-Private
Spots: 2 of 4 taken  (1 confirmed, 1 requested)
-----------------------------------------------
Confirmed   Fatima A.
Requested   Rayanne K.        [Confirm] [Offer other] [Decline]
Waitlist    1. Nadeen S.      [Move to request] [Contacted] [Remove]
```

- On the calendar, each hour gets one small, plain label instead of stacked tags, for example **"2/4 · 1 waiting."** A gold label means a spot opened up and someone is waiting.
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
- Update `pt_client_slot_is_full` / `pt_client_slot_is_open` to compare the count of scheduled appointments plus pending requests for the same trainer, hour and session type against `pt_session_types.capacity`. A different session type in the same hour still blocks the trainer.
- Add a staff-only `pt_schedule_slot_detail(trainer, start)` RPC that returns confirmed, requested and waitlist rows plus capacity. Use it for both the desktop sheet and the mobile view. Trainers are limited to their own rows.
- Add `pt_waitlist_promote(id)` to turn a waitlist entry into a pending request when there's room.
- In `PTSchedule.tsx`, replace the waitlist tags with a single label per hour and a `SlotDetailSheet`.
- Add `PTMRequests.tsx` at `/admin/pt/m/requests` to the mobile shell nav, plus a Today shortcut.
- Add tests for the capacity rule: Semi-Private with 1–3 taken is open, 4 taken is full, and one-on-one with 1 taken is full.
