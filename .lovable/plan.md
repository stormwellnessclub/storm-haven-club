I’ll fix this so members cannot keep using old published Kids Care times just because their app stayed open.

Plan:

1. Make Kids Care times refresh everywhere members see them
- Member Kids Care booking modal
- Member Kids Care Bookings page “Upcoming Open Hours”
- Public Kids Care booking entry points that open the same modal
- Admin booking flow, so staff also uses the current source of truth

2. Add live refresh for schedule changes
- Subscribe the app to Kids Care hour changes so when staff saves/removes/changes a slot, open member pages automatically refetch.
- Add short background refetching for these availability queries as a backup for devices that miss the live event.
- Keep `staleTime: 0` so cached availability is never treated as reliable.

3. Silently remove stale selected times
- If a member has 10:00 AM selected and staff removes that slot, the modal will clear that invalid selected time automatically.
- No announcement, no extra alert, no push/email/SMS.
- If staff adds a different time, it will appear as available normally.

4. Block stale bookings at the backend level
- Add server-side validation before a Kids Care booking is created.
- The selected date/start/end time must fit inside a currently published `kids_care_hour_slots` row.
- If an old app tab tries to book a removed time, the booking will be rejected even if the old UI still shows it.

5. Preserve existing bookings
- Removing a published time only removes it from future available booking options.
- It will not auto-cancel existing bookings and will not message parents.

Technical details:
- Update Kids Care availability hooks to force fresh data and realtime invalidation for `kids-care-hour-slots*` query keys.
- Update `KidsCareBookingModal` to refetch on open/date change/focus and clear invalid start/end selections.
- Add a database-level validation path for member-created and admin-created Kids Care bookings against current published slots.