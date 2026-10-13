# Fix: non-member Body Roller email stopped partway

## What happened
The non-member launch email went to **251 people**, sent between 7:39 and 7:42 AM Detroit time on Oct 13. Then it stopped, and no failures were logged. The sender sends one email at a time, about one per second, all inside a single request. That request gets cut off after a few minutes, so everyone after roughly the 251st person never got the email. The screen still showed the full list size, so it looked like a full send.

Nobody got the email twice, because people who already got it are skipped on every send. That means we can safely finish the rest.

## Fix
1. **Send in batches that keep going on their own.** Each run sends a batch of a few hundred, then sets a one-time timer for the next batch. This repeats until the list is done, so closing the screen or a cut-off no longer stops the send.
2. **Show progress.** The send screen shows "X of Y sent, Z remaining" and whether the send is still running, finished or stopped with errors.
3. **Fix the "already sent" check so it reads every past send.** Right now it reads at most 1,000 of them, which could cause duplicate emails once more than 1,000 people have been emailed.
4. The same fix covers the member emails, the follow-up emails and scheduled sends.

## Finishing the current send
After the fix, I'll show you the exact number of non-members who haven't received the launch email yet. Before your full list of 3,000+ goes through the usual filters, I'll recount it: current members, blocked people, unsubscribes and duplicate addresses are removed, so the real number will be lower. Nothing gets sent until you say go. When you do, only the people who were missed will get the email.

## Technical details
- `send-body-roller-presale-email`: switch to the Resend batch API (up to 100 emails per call), with a cap of about 120 seconds of sending per run. Store send progress in a new `body_roller_send_jobs` row (kind, total, sent, failed, status, cursor). Arm the next run with the existing one-time pg_cron timer pattern (`x-internal-token`), and remove the timer when the job finishes.
- Page through the `email_audit_log` "already sent" check in steps of 1,000, the same way the recipient lists are read.
- Add a progress panel to the admin send screen that refreshes every few seconds.
