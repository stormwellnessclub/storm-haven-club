

# Update Soft Launch Hours Banner

## Changes to `src/components/member/SoftLaunchHoursBanner.tsx`

1. **Update Sunday hours**: Change from "8:00 AM - 6:00 PM" to "9:00 AM - 6:00 PM"
2. **Remove the blue info box**: Delete the entire block (lines 82-88) with the Info icon and "Members have access to gym and amenities from 7 PM - 10 PM tomorrow only" message
3. **Update the date subtitle**: Change from "Saturday, February 28, 2026" to "Sunday, March 1, 2026"
4. **Bump the storage key**: Change to `'soft-launch-banner-dismissed-week2-sun'` so the updated banner reappears for everyone
5. **Remove unused `Info` import**: Clean up the import since the info box is being removed

