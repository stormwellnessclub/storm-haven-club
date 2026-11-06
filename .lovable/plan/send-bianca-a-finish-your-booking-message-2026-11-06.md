# Send Bianca a "finish your booking" message

## Why it hasn't gone out yet
I can't send emails as you from here. The club's email system only sends for signed-in staff, and the only account I can use for you doesn't have staff access. So the fix is a button you press yourself, which sends the message from your staff login.

## What I'll build
On the spa page that lists incomplete online checkouts, each unfinished checkout gets a **"Send finish-booking link"** button. One tap:

- **Email:** sends a message with the treatment, date and time she picked, plus a button that opens the spa booking page set to that treatment.
- **Text:** sends only if the person agreed to texts. Bianca did not agree to texts, so she gets the email only. The button will say so ("Email sent · no text consent") so staff know to call her if needed.
- Records who sent it and when, so it can't be sent to the same person twice by accident within 10 minutes.

## Then for Bianca
After this is built, you open her incomplete checkout (Mud Therapy Wrap, Fri Nov 20, 10:45 AM) and tap the button. Her time isn't held anymore, so if someone else books it first, the link still lets her pick another time.

Note: her email (randophharlowe11@gmail.com) may be mistyped. If it bounces, call her at (734) 245-7714.

## Technical details
- New `staff_reply`-style transactional email type `spa_checkout_resume` in `send-email` (staff JWT required, existing 10-minute duplicate guard).
- Link: `/spa?service=<service_id>&date=<date>` handled by existing spa booking modal deep-link (add if missing).
- SMS through `send-sms` only when `sms_opt_in` / consent exists; never bypass consent.
- Store `notified_at` on `spa_guest_checkouts` (column already exists).
