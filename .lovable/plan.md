

## Remove Abandoned Application Email

Remove all automatic abandoned application email tracking and sending functionality.

### 1. Remove client-side tracking from `src/pages/Apply.tsx`

Remove lines 26-27 (the `ABANDON_TRACK_KEY` constant), lines 301-315 (saving to localStorage when email/firstName entered), lines 320-345 (the `checkAbandonedApplication` function and its call), and line 551 (clearing the tracking key on submission).

### 2. Delete the edge function

Delete `supabase/functions/send-abandoned-application/index.ts` entirely. The function is not listed in `supabase/config.toml` so no config changes needed there.

### 3. Note on admin panel

The `AbandonedApplicationsTab` component in the admin panel provides a manual way to send reminders to people who started card setup but didn't complete. This is separate from the automatic abandoned application email and queries `card_setup_attempts` table. I'll leave this in place since it's a different feature — let me know if you want that removed too.

### Files Modified
- `src/pages/Apply.tsx` — Remove localStorage tracking and 2-hour timer logic
- `supabase/functions/send-abandoned-application/index.ts` — Delete entire file

