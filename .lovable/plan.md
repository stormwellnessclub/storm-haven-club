

## Fix: Restore Both Missing Credits to Carly's Pass

### The Problem
Carly's 10-pack pass started at 10 and is now at 8. Two credits were deducted:

1. **Feb 21, 8:00 AM booking** (confirmed) -- permanent schedule class that isn't happening
2. **Feb 24, 5:00 PM booking** (cancelled) -- was cancelled but the credit was never restored

Neither class is valid during the soft launch, and the cancelled booking should have returned its credit automatically but didn't.

### What Will Change

**1. Cancel the Feb 21 booking**
- Set booking `6958d372-386f-48e2-8274-8d6ac331c80b` status to `cancelled`

**2. Restore both credits to Carly's pass**
- Update pass `0fbd26ad-e4ad-4dd3-a29d-768f31788f7b` from 8 back to **10** `classes_remaining`

**3. Reset the Feb 21 session enrollment to 0**
- No valid bookings remain on session `13e38267-e5e7-4b00-be5a-20d00c0a3995`

### Technical Details

```sql
-- 1. Cancel the phantom booking
UPDATE class_bookings
SET status = 'cancelled'
WHERE id = '6958d372-386f-48e2-8274-8d6ac331c80b';

-- 2. Restore both credits (cancelled booking never refunded + phantom booking)
UPDATE class_passes
SET classes_remaining = 10
WHERE id = '0fbd26ad-e4ad-4dd3-a29d-768f31788f7b';

-- 3. Reset enrollment on the phantom session
UPDATE class_sessions
SET current_enrollment = 0
WHERE id = '13e38267-e5e7-4b00-be5a-20d00c0a3995';
```

### Follow-up: Prevent Future Credit Leaks

The `create_atomic_class_booking` RPC deducts credits on booking but there is no corresponding logic to restore credits when a booking is cancelled. A cancellation handler should be added to automatically refund credits/pass uses when bookings are set to `cancelled`. This can be addressed separately.

