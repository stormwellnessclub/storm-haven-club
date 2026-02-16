

## Update Soft Launch Hours Banner Dates to 2026

The banner is hidden because the expiration date is set to February 2025. Since we're now in 2026, the dates need to be updated.

### Changes

**File: `src/components/member/SoftLaunchHoursBanner.tsx`**

- Change `SOFT_LAUNCH_END` from `2025-02-23` to `2026-02-23`
- Update the displayed date text from "February 16 – 22, 2025" to "February 16 – 22, 2026"
- Update the footer text from "Regular hours begin after Feb 22." to "Regular hours begin after Feb 22, 2026."

No other files need changes -- the component is already wired into `MemberLayout.tsx`.

