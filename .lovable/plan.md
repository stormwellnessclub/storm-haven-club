
## Add Ozone Sauna to the Spa

A new self-serve Recovery service booked in **Spa Room 3**, 60-minute blocks, with three pay-in-full pricing options.

### 1. Data setup (migration)

- Insert **Spa Room 3** into `spa_rooms` (currently only Spa Room 5 and Red Light Therapy exist).
- Insert **Ozone Sauna** into `spa_services`:
  - `category` = `Recovery`
  - `duration_minutes` = 60
  - `cleanup_minutes` = 15 (matches recovery pattern; adjustable)
  - `price` = 85.00 (single-session default shown on menu)
  - `requires_intake_form` = false
  - `is_active` = true
- Add three purchasable pass options (single / 6-pack / 20-pack) at **$85 / $450 / $1,300**. Prices display as bundle totals only — no "per session" breakdown shown to the customer.
- Pin Ozone Sauna to Spa Room 3 so bookings don't collide with other services.

### 2. Booking flow

- Uses the existing Recovery-style direct-book path (like Red Light / Cryo): pick date + time, confirm.
- **Waiver + card on file required** before the booking dialog will submit — same gate the massage flow uses. If missing, prompt inline to sign the waiver and add a card, then resume.
- 6-pack and 20-pack purchases charge in full upfront and drop credits into the member's account; each future booking deducts one credit instead of re-charging.

### 3. UI

- Ozone Sauna appears under the **Recovery** section on the public spa menu and in the member portal spa view, alongside Red Light, Cryo, Starpool.
- Service card shows the three pricing options as one price list (Single $85 · 6 Sessions $450 · 20 Sessions $1,300) with a single **Book** button.
- Admin sees it in Spa Management → Services (edit price / toggle active / view bookings) and the booking appears on the Spa Room 3 lane in the daily schedule.

### 4. Technical notes

- Migration: `INSERT` into `spa_rooms` and `spa_services`; add the three package options to whichever table the existing recovery packs use (will confirm during build — likely `spa_service_addons` or a new `spa_service_packages` row set). Grants + RLS follow existing recovery-service patterns.
- No Stripe product pre-creation needed for single sessions (charged via existing spa booking edge function). Packages use the same "charge card on file, credit member's account" flow already used for Red Light / Cryo packs.
- Frontend: no new pages — Ozone Sauna picks up the existing Recovery service card and booking sheet components automatically once the row exists.

### Open item to confirm during build

Only two rooms exist in `spa_rooms` today. I'll add "Spa Room 3" as a new room and pin Ozone Sauna to it. If you actually meant an existing physical room that just isn't in the system yet, that's still the right move — the label will read "Spa Room 3" everywhere. Say the word if you want a different display name.
