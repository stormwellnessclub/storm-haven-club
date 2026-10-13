# Make Marketing → Analytics show your real email sends

## What's wrong
The Analytics tab only reads from an old campaign list that nothing writes to anymore. That list has 0 campaigns. Your real sends are recorded in a different place: 1,280 campaign emails, including Body Roller launch, Harvest Moon, the hours changes, the power outage, the sound bath, the Higher Self Society invite and maintenance. So the tab shows nothing.

## What you'll see after the fix
Marketing → Analytics will show one row per email you've sent to a group, newest first:
- Name and date sent
- How many it went to, and how many failed (you can open the failed ones to see who and why)
- For Body Roller emails: clicks, checkouts started, and purchases, using the new tracking
- Totals at the top for the chosen dates (last 7 days, 30 days, 90 days, or all time)

Test sends are left out of the totals. The existing goal results (applications, guest passes and similar after a send) stay where they make sense.

## What it won't show
Opens and clicks for emails other than Body Roller aren't recorded today. Adding that later means connecting delivery reports from the email service, which also brings in bounces and spam complaints. I can do that next if you'd like.

## Technical details
- Rewrite the data loading in `CampaignAnalytics.tsx` to page through `email_audit_log` (with `.range()` loops, no 1,000 cap), excluding `trigger_source = 'admin_test'` and `_test` types. Group by `email_type`: sent/failed counts, first/last sent time, distinct recipients.
- A readable label for each `email_type` (for example `harvest_moon_sep_27_2026` becomes "Harvest Moon — Sep 27, 2026"), from `EMAIL_META` subjects where known and otherwise a humanized key.
- Body Roller rows join `body_roller_presale_clicks` and `body_roller_presale_purchases`.
- A drill-down for each row lists failed recipients with `error_message`.
- Keep the old `email_campaigns` / SMS reads as a fallback section only when they have rows.
- Admin-only access is unchanged (existing RLS on `email_audit_log`).
