
# Update Soft Launch Hours Banner for Saturday Feb 28

## What Changes

Update the `SoftLaunchHoursBanner` component with tomorrow's special schedule:

**Current Saturday hours:**
- Saturday: 8:00 AM - 5:00 PM
- Saturday: 8:00 PM - 11:30 PM (Pop-Up Event)

**New Saturday Feb 28 hours:**
- Saturday: 10:00 AM - 7:00 PM
- Saturday: 9:00 PM - Sell Out (Pop-Up Event)
- Special note: "Members have access to gym and amenities from 7 PM to 10 PM tomorrow only -- courtesy extended hours"

## Implementation Details

### File: `src/components/member/SoftLaunchHoursBanner.tsx`

1. Update the `softLaunchHours` array:
   - Change Saturday regular hours from `8:00 AM - 5:00 PM` to `10:00 AM - 7:00 PM`
   - Change Saturday pop-up hours from `8:00 PM - 11:30 PM` to `9:00 PM - Sell Out`

2. Add a courtesy note below the hours table with a distinct visual treatment (e.g., a small info callout) stating:
   > "Members have access to gym and amenities from 7 PM – 10 PM tomorrow only — courtesy extended hours."

3. Bump the `STORAGE_KEY` to `soft-launch-banner-dismissed-week2-sat` so the updated banner reappears for all members who previously dismissed it.

4. Update the date range label from "February 23 - March 1" to "February 28, 2026" (or keep the week range and highlight Saturday specifically -- will match the single-day focus).

No database or backend changes needed -- this is a frontend-only banner update.
