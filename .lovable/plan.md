## Goal
Restore all spa menu items (facials, body rituals, body wraps) to the Spa page with a "Coming Soon" indicator instead of a Request/Book button, and shorten the opening notice banner.

## Changes

### 1. Banner text — `src/pages/Spa.tsx` (lines 281-291)
Replace the Spa Aella opening notice with the simpler message:

> Full spa services coming soon.

Keep the same banner styling (accent background, info icon).

### 2. Re-activate hidden services (DB migration)
A previous migration deactivated all Facials, Body Rituals, and Body Wraps (28 rows currently `is_active = false`). Re-enable them so they show up on the menu again:

```sql
UPDATE public.spa_services
SET is_active = true
WHERE category IN ('Facials', 'Body Rituals', 'Body Wraps');
```

Massage and Recovery rows are already active and untouched.

### 3. "Coming Soon" treatment per service — `src/pages/Spa.tsx` (`renderServiceButton`, lines 209-252)
Update the button logic so only Massage and Recovery remain bookable:

- **Recovery** → existing "Book Now" (Red Light / ZeroBody — unchanged)
- **Massage** → existing "Book Now" with waiver/payment gates (unchanged)
- **Facials, Body Rituals, Body Wraps** → render a non-interactive **"Coming Soon"** badge (muted pill) in place of the Request button. Remove the Request flow trigger for these categories.

The Request modal/handler code stays in the file for now (no longer reachable from these categories) — safe to leave or trim later.

### 4. Optional polish
On the service card for "Coming Soon" categories, dim the price slightly (`text-muted-foreground` instead of gold) so the visual cue matches that they're not yet bookable. Card itself stays visible with name, description, duration, and price.

## Files touched
- `src/pages/Spa.tsx`
- `supabase/migrations/<new>_reactivate_spa_services.sql`

## Out of scope
- Admin Spa Services tab visibility (still shows all services with their toggle).
- Any change to Massage/Recovery booking flow.