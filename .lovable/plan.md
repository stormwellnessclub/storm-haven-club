## Issue
Summer Haidous's Kids Care subscription successfully renewed on Stripe (charge `py_3TZI2zLyZrsSqLhs0Ku2DmZk`, $77.55 against `cus_TtNJbHvxfYdbJT`), but no new `class_passes` row was provisioned. Her last active pass (`f6a0f59c-…`) expired 2026-05-19, so the booking gate sees "no active pass" and tells her to buy one.

## Fix (data-only, one INSERT)

Create a new active kids_care pass for Summer covering the new billing cycle, mirroring the prior pass row:

- `user_id`: `f865462f-ba02-4d00-86ea-5475add08cd9`
- `member_id`: `3c7f0bfc-d7ca-46bf-a62a-0903444e3012`
- `pass_type`: `kids_care`
- `category`: `other`
- `classes_total`: 16
- `classes_remaining`: 16
- `status`: `active`
- `purchased_at`: 2026-05-20 00:00:00 America/Chicago
- `expires_at`: 2026-06-19 23:59:59 America/Chicago (cycle_start + 1 month − 1 day, per credit-management rule)
- `price_paid`: 75.00
- `is_member_price`: true

No code changes. After insert, Summer's KidsCarePassGate will see an active pass and the "buy new pass" prompt goes away; she can immediately book for Aria.

## Out of scope
- Investigating why the renewal webhook didn't auto-provision the pass (separate follow-up if you want me to dig into `stripe-webhook` for the `invoice.payment_succeeded` event on her kids_care subscription).
