# Add Sports Stretching Service

Add a new spa service offering under the Recovery category using the Sport Stretch USA method, requiring a therapist.

## What gets added

Two new rows in `spa_services`:

1. **Sports Stretching – 60 min**
   - Category: `Recovery`
   - Duration: 60 min
   - Cleanup: 15 min
   - Requires therapist: yes
   - Price / member price: **TBD (you'll provide)**

2. **Sports Stretching – 90 min**
   - Category: `Recovery`
   - Duration: 90 min
   - Cleanup: 15 min
   - Requires therapist: yes
   - Price / member price: **TBD (you'll provide)**

Both share a description referencing the Sport Stretch USA method (assisted stretching for mobility, recovery, and performance). Both set `is_active = true`, `popular = false`.

## After insert — what you'll still need to do in admin

- **Therapists tab** → mark which therapist(s) are certified/can perform Sports Stretching (links via `spa_therapist_services`).
- **Rooms tab** → assign which room(s) it can use (if it needs a dedicated room — otherwise any).
- **Availability tab** → create availability windows (day/time + therapist + room) so it shows up as bookable on the customer side.

## Open question before insert

Confirm pricing for each duration (regular + member price), then I'll insert both rows and you can configure therapist/room/availability in the admin UI.

## Technical notes

- Insert into `public.spa_services` only — schema already supports duration_minutes, cleanup_minutes, price, member_price, category, description, is_active, popular.
- No schema migration needed.
- Recovery-category services in this project follow the direct-booking flow (no waiver/card gate like Massage), per the spa booking logic memory — Sports Stretching will inherit that automatically by being categorized `Recovery`. If you want it to behave like Massage (waiver + card required) instead, say so and I'll adjust.
