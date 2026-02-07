-- One-time fix for orphaned member records (10 records)
-- When applications were cancelled, the corresponding member records weren't updated
UPDATE members m
SET status = 'cancelled', updated_at = NOW()
FROM membership_applications ma
WHERE LOWER(m.email) = LOWER(ma.email)
  AND ma.status = 'cancelled'
  AND m.status = 'pending_activation';