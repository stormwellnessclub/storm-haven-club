# Fix two broken database lookups

Both findings are confirmed in the current code.

## 1. Waitlist confirmation email/SMS

When someone joins a class waitlist, the app looks up the class session to fill in the class name, date and time for the confirmation message. It asks for column names that don't exist (`scheduled_date`, `scheduled_time`), so the lookup fails and the confirmation goes out with no class details — or not at all.

Fix: read the real columns `session_date` and `start_time` in `src/hooks/useWaitlist.ts` and use them for the formatted date/time.

## 2. AI workout recommendations

The recommendations function reads a member's last 10 workouts to personalize suggestions, but asks for a `workout_name` column that doesn't exist on the workout logs table. The read fails, so members with workout history get generic suggestions.

Fix: drop `workout_name` from the select in `supabase/functions/ai-recommendations/index.ts` and redeploy the function.

## Verification

- Join a waitlist as a test user and confirm the confirmation text shows the correct class, date and time.
- Trigger a recommendation for a member with logged workouts and confirm no Postgres error in the function logs.

## Note on abandoned application tracking

It is working. Card setup attempts are being recorded daily (succeeded, abandoned and initiated rows through today), the nightly reconcile job against Stripe is active, and the Abandoned Applications tab reads that same table. Nothing to change there.
