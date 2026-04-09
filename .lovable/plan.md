

# Bulk-Add Teresa's Availability

## What This Does
Inserts Teresa's availability for all 10 active Massage services across Thursday, Friday, and Saturday, assigned to Spa Room 5. Times stored as 12-hour format references (10:00 AM – 8:00 PM).

## Details
- **Therapist**: Teresa Tyler
- **Room**: Spa Room 5
- **Days**: Thursday (4), Friday (5), Saturday (6)
- **Hours**: 10:00 AM – 8:00 PM each day
- **Services**: All 10 active Massage services (Deep Relief 60/90, Lymph & Flow 60/90, Prenatal 60/90, Sports Performance 60/90, Storm Signature 60/90)
- **Gap**: 15-min cleanup already configured per service — meets your requirement
- **max_bookings**: 1 per slot (single therapist, single room)
- **Last appointment**: Automatically fits within 8:00 PM based on service duration (e.g., 5:30 PM for 90-min, 5:45 PM for 60-min+cleanup)

## Steps
1. Link Teresa to all 10 massage services in `spa_therapist_services`
2. Insert 30 availability rows (10 services × 3 days) with `start_time = '10:00'` and `end_time = '20:00'` (database stores 24h internally, but the UI displays 10:00 AM – 8:00 PM)

**Note**: The database requires 24-hour format internally (`20:00` = 8:00 PM) — this is how all time columns work in the system. The admin UI already displays these as readable times. No schema changes needed, data inserts only.

