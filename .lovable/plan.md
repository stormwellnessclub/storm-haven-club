

## Update Guest Pass Success Page Content

Two small text changes to the success confirmation page:

### 1. Remove "Wear comfortable workout attire" line
Delete line `• Wear comfortable workout attire` from the "What to Expect" section.

### 2. Add soft launch notice above hours
Add a highlighted note above the regular hours: **"Currently in Soft Launch -- contact club for hours"**, then keep the regular hours listed below it.

### Technical Details

| File | Changes |
|------|---------|
| `src/pages/GuestPass.tsx` (lines 520-546) | Add a soft launch notice line before the hours listing. Remove the workout attire bullet point. |

