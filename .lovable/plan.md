

## Fix Missing Gold Tier Credits for Zeinab Beydoun (STM-000068)

### Problem
Zeinab is an **active Gold member** but is missing her wellness credits. She currently only has a guest pass credit. Gold members should receive:
- 4 Red Light Therapy sessions/month
- 2 Dry Cryo sessions/month

### Fix
Insert the two missing credit records into the `member_credits` table, using her existing cycle dates (Feb 14 - Feb 28, expires Mar 1) so everything stays aligned.

### Technical Details

**Data insert** into `member_credits`:

| Field | Red Light | Dry Cryo |
|-------|-----------|----------|
| member_id | f4266d87-8ac0-43ef-a5d2-c9fc618a2546 | f4266d87-8ac0-43ef-a5d2-c9fc618a2546 |
| user_id | 74ec321a-d5bd-479f-b98c-a6ca2ffff3c4 | 74ec321a-d5bd-479f-b98c-a6ca2ffff3c4 |
| credit_type | red_light | dry_cryo |
| credits_total | 4 | 2 |
| credits_remaining | 4 | 2 |
| cycle_start | 2026-02-14 | 2026-02-14 |
| cycle_end | 2026-02-28 | 2026-02-28 |
| expires_at | 2026-03-01 04:59:59+00 | 2026-03-01 04:59:59+00 |

No code changes needed -- this is a one-time data correction using a database insert.

