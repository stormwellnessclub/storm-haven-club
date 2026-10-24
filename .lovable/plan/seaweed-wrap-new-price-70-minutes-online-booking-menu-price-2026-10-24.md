# Seaweed wrap: new price, 70 minutes, online booking, menu price editing

## What changes

1. **Detox Seaweed & Charcoal Wrap (the shorter one)**
   - Price: $165 -> **$220**
   - Length: 60 min -> **70 min** (room cleanup time stays 15 min)
   - The 90-minute Extended wrap stays at $290 and 90 min.
   - Already-booked appointments keep the price they were booked at; only new bookings use $220.

2. **Book Now instead of Request Appointment — this wrap only**
   - On the spa page this wrap gets a **Book Now** button with live open times, the same way massages work: sign in, signed waiver, card on file to reserve.
   - Right after booking, the client is sent to the body wrap intake form (it still has to be done before the visit, same as now).
   - Every other body wrap, and the Extended seaweed wrap, stay as **Request Appointment**.

3. **Price shows the same everywhere**
   - Spa page, booking window, admin/front desk booking, checkout and the upgrade price check all already read the menu, so they update right away.
   - The wrap's own info page and the search-engine copy of the menu still say "60 min / $165" in fixed text. Those get changed to read from the menu (or updated to 70 min / $220) so nothing shows the old price.

4. **Where you change spa prices**
   - It already exists: **Admin -> Spa Management -> Services**, then the pencil next to any treatment. You can change name, description, length, cleanup time, price and member price.
   - I'll make it easier to find: a visible "Edit price" button on each row and a short note at the top of the Services tab, plus a front desk/kiosk shortcut if you want it.

5. **Longer description**
   - Waiting on your info. When you send it, I'll put it on the spa menu card and the wrap's info page (what it is, steps, benefits, who it's for).

## Things I invented or need to confirm
- 70 min: I'll show "70 min" on the info page; the Extended wording ("doubles the cocoon time") stays unless your new description says otherwise.

## Technical notes
- Data update on `spa_services` id `3e53a2cf-…`: `price = 220`, `duration_minutes = 70`.
- `src/pages/Spa.tsx` `renderServiceButton`: Body Wraps stay request-only except an allow-list (by service id) routed through the massage booking path (waiver + card checks, `SpaBookingModal`), then open the body-wrap intake after success.
- Confirm the room-assignment logic picks Room 6 (wrap room) for online wrap bookings; therapist availability already applies.
- `src/lib/spa-content.ts` (durations "70 min", "90 min") and `supabase/functions/serve-static/full-site-content.ts` rows updated; check `spaUpgradePricing` still resolves 70 -> 90 to $290 (add a test: $220 + upgrade = $290).
- `SpaServicesTab.tsx`: clearer edit control; save already writes the shared menu table.
