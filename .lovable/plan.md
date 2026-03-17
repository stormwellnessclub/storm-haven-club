

## Backfill Missing March Credits for All Affected Members

### The Problem
**28+ active non-Silver members** are missing their March credit renewal. This affects members across multiple start dates — not just Feb 9th:

- **Jan 31 start**: 2 members (Zeinab Baydoun, Nada Shatila)
- **Feb 9 start**: ~20 members (the largest group)
- **Feb 10-28 start**: Several more members (Nancy Msheik, Zahna Abdallah, Fatme Beydoun, Alyssa Maley, etc.)

Only 8 members currently have March credits (via webhook or recent activation).

### The Fix — Automated One-Time Backfill
No manual work needed. I will run a SQL INSERT that:

1. Finds every active non-Silver member who is **missing March credits** (no `member_credits` row with `cycle_start` in March matching their billing anniversary)
2. Calculates correct cycle dates per member based on their `membership_start_date` day-of-month
3. Inserts the correct tier-based credits:
   - **Gold**: 4 red_light + 2 dry_cryo
   - **Platinum**: 6 red_light + 4 dry_cryo
   - **Diamond**: 10 class + 10 red_light + 6 dry_cryo
4. Sets `expires_at` to end of cycle (one month from cycle start minus one day)
5. Skips anyone who already has March credits (safe to re-run)

### No Code Changes
This is a data-only operation using the insert tool. The daily cron job will handle all future renewals automatically going forward.

