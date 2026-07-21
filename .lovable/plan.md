## Plan: make Front Desk show today’s admin check-ins

I confirmed the database already has today’s check-ins: `check_ins` has 21 entries for today, `class_bookings` has 5 checked-in class attendees, and scanner logs show 8 auto check-ins. The problem is not that the records are missing.

### What I’ll change
1. **Use the same admin attendance source in Front Desk mode**
   - Replace the Front Desk kiosk-only attendance fetch with the fuller attendance loader that reads the actual admin check-in tables directly: member check-ins, guest passes, class bookings, and spa appointments.
   - This keeps Front Desk in sync with check-ins done from admin, scanner, roster, spa, and guest flows.

2. **Preserve the Front Desk display**
   - Keep the same totals, “Currently In,” member counts, and attendance table.
   - Map the existing attendance fields so member names, class/spa labels, guest/non-member labels, and first-visit notes still display correctly.

3. **Add reliable refresh behavior**
   - Keep the manual Refresh button.
   - Ensure the feed re-checks automatically and updates after check-ins from both admin and front desk actions.

4. **Validate with real data**
   - After implementation, verify the Front Desk attendance count is no longer zero and matches today’s backend records.

### Technical notes
- The current backend RPC `kiosk_todays_attendance()` is valid and has execute permission, but the live Front Desk display is still showing zero despite today’s data existing.
- The admin-facing attendance hook already reads the underlying tables directly and is a better fit for a shared Front Desk dashboard that must reflect admin-created check-ins.