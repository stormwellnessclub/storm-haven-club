# Mobile Mockup v6 — show the full drawer

Regenerate `/mnt/documents/member-portal-v6-mobile.png` so the entire drawer fits on screen, including **HEALTH & WELLNESS** and **ACCOUNT** sections that were cut off in v5.

## Fix

- Increase phone frame height from 880px → ~1500px (taller "iPhone Pro Max"-style frame) so all 5 sidebar groups + footer fit without scrolling
- Tighten drawer vertical spacing (smaller gap between rows, slightly smaller section label margins) so the list reads denser
- Pin **Back to Website / Sign Out** footer at the bottom of the drawer (unchanged behavior, just inside the taller frame)
- Keep everything else identical to v5: cream drawer, gold STORM wordmark, X close button, gold section labels, Dashboard active pill, dimmed dashboard peeking behind on the right, bottom tab bar (Book · Activity³ · Support · Account)

## Sections that will be fully visible

1. MAIN — Dashboard, Member Entry, Support, Café Order, Storm Shop
2. MEMBERSHIP & BILLING — My Membership, My Credits, Payment Methods, Payment History, Buy Passes
3. BOOKINGS & VISITS — My Bookings, Visit History, Kids Care, Wellness Booking
4. **HEALTH & WELLNESS** — Health Score, Workouts, Habits, Goals, Achievements, Fitness Profile
5. **ACCOUNT** — My Profile, Waivers, Freeze Request, Register Guest, Refer a Friend
6. Footer — Back to Website, Sign Out

## Out of scope

- No app code changes
- Desktop mockup stays as-is
- Implementation only begins after you approve the redesign
