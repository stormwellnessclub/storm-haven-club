# Correct weekend hours and publish the right contact details

Correct details:
- Phone: (248) 232-8487
- Club hours: Mon–Thu 6:30 AM–11:00 PM, Fri 6:30 AM–8:00 PM, **Sat–Sun 8:00 AM–7:00 PM**
- Kids Care: Mon–Fri 8:00 AM–8:00 PM, Sat–Sun 8:00 AM–5:00 PM

## Steps
1. Change weekend club opening from 7:00 AM to 8:00 AM in:
   - The footer hours on every page
   - The Guest Pass page hours
   - The Google and Apple Maps listing data
2. Save the correct hours and phone number as project memory so they stay consistent.
3. Publish so the live site picks up the new weekend hours, plus the 248 number and 6:30 AM weekday opening that are already in the current version.
4. Check the live Classes, FAQ, Guest Pass and footer to confirm only the correct details show.

Separately, update your Google Business Profile weekend hours to 8 AM yourself if they show 7 AM. I can't change that from here.

## Technical details
- Files: `src/components/Footer.tsx` (clubHours), `src/pages/GuestPass.tsx` line 530, `src/lib/seo/business.ts` openingHours, `index.html` JSON-LD Saturday/Sunday `opens` -> `08:00`.
- Memory: add `mem://business/hours-and-contact` and an index line.
