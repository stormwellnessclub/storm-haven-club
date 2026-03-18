-- Fix Nsreen Almusawi (STM-000157) credit cycle
-- 1. Delete premature credits created March 17 (before her March 25 billing date)
DELETE FROM member_credits 
WHERE member_id = '788e3720-1921-44f2-afa2-6dc8263c33a5'
  AND created_at > '2026-03-16'
  AND cycle_start = '2026-03-25';

-- 2. Extend old credits to expire March 25 (her actual billing date) instead of March 24
UPDATE member_credits
SET cycle_end = '2026-03-25',
    expires_at = '2026-03-25 23:59:59+00'
WHERE member_id = '788e3720-1921-44f2-afa2-6dc8263c33a5'
  AND cycle_start = '2026-02-25';