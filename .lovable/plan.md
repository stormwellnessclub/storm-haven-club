

## Update Soft Launch Hours Banner + Create Email Template

### Banner Changes (`src/components/member/SoftLaunchHoursBanner.tsx`)

- Change `SOFT_LAUNCH_END` from `2026-02-23` to `2026-03-02` (covers through Sunday March 1)
- Reset `STORAGE_KEY` to `'soft-launch-banner-dismissed-week2'` so everyone sees the updated banner
- Update date label to **"February 23 - March 1, 2026"**
- Replace the hours data with a richer structure supporting multiple time blocks per day and a "special event" flag:
  - **Monday - Thursday**: 7:00 AM - 11:00 PM
  - **Friday**: 7:00 AM - 5:00 PM + 8:00 PM - 11:30 PM (Pop-Up Event)
  - **Saturday**: 8:00 AM - 5:00 PM + 8:00 PM - 11:30 PM (Pop-Up Event)
  - **Sunday**: 8:00 AM - 6:00 PM
- Friday and Saturday evening blocks get a small highlighted "Pop-Up Event" badge
- **Remove** the "Regular hours begin after..." note entirely

### Email Template (database insert)

Insert a new row into `email_templates`:
- **Name**: "Weekly Hours - Feb 23"
- **Category**: "announcement"
- **Subject**: "This Week's Hours at Storm Wellness Club"
- **Merge fields**: `{name}`
- **Body**: Styled HTML email with the same hours table, pop-up event callout for Friday/Saturday evenings, and a greeting using `{name}`

### Technical Detail

**No new dependencies** -- the component already uses `useState`, `Clock`, `X`, and `Button`. The hours array changes from a flat structure to one that supports multiple blocks per day:

```text
type HourBlock = {
  days: string;
  hours: string;
  special?: string;  // e.g. "Pop-Up Event"
};
```

Friday and Saturday each get two entries -- one for daytime, one for the evening event. The render logic adds a gold badge next to entries with a `special` value.
