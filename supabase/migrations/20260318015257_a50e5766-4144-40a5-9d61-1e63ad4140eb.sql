UPDATE member_credits 
SET expires_at = (cycle_end - interval '1 day') + interval '23 hours 59 minutes 59 seconds',
    cycle_end = (cycle_end - interval '1 day')
WHERE expires_at::time != '23:59:59'
  AND expires_at IS NOT NULL;