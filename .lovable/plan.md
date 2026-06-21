# Member Portal Mockup v5 (preview only — no code changes)

I'll generate two PNG mockups that match the uploaded references exactly, then wait for your approval before touching any app code.

## Desktop reference (image 1) — what I'll reproduce

- **Dark sidebar** (near-black) with gold STORM WELLNESS CLUB wordmark
- Sidebar groups in gold uppercase labels: **MAIN** (Dashboard, Member Entry, Support, Café Order, Storm Shop) · **MEMBERSHIP & BILLING** (My Membership, My Credits, Payment Methods, Payment History, Buy Passes) · **BOOKINGS & VISITS** (My Bookings, Visit History, Kids Care, Wellness Booking) · **HEALTH & WELLNESS** (Health Score, Workouts, Habits, Goals, Achievements, Fitness Profile) · **ACCOUNT** (My Profile, Waivers, Freeze Request, Register Guest, Refer a Friend)
- Dashboard active state: gold-tinted pill
- Footer: Back to Website, Sign Out (red)
- Cream/ivory body background
- Serif headline "Welcome back, Sahar" + subline "Here's your wellness overview."
- Top-right: black pill "🎧 Support" + circular bell button
- **4 stat tiles row**: MEMBERSHIP (Diamond + Active + black diamond icon) · MONTHLY CREDITS (10 of 10 remaining + coin icon) · CLUB VISITS (8 this month + sparkline) · UPCOMING BILLING (Manage Billing › / Next billing date May 20, 2024)
- **Benefits Frozen** banner (cream, gold lock + gold title + chevron)
- **Credits Expiring Soon** banner (10 total credits expiring in 7 days, clock icon, chevron)
- **Book Anything** card with 5 circular gold-tinted icon tiles: Book Class (dumbbell), Book Amenity (droplet), Spa Aella (lotus), Café Order (cup), Buy Passes (ticket)
- **Up Next** card (calendar icon, SAT MAY 4 · 9:00 AM, Strength Sculpt with Jordan, Studio 1, View Schedule button, class photo on the right)
- **Recent Workouts** card (trophy icon, 3 dated rows, "View all workouts" link)
- **Achievements** card (trophy icon, "1 Unlocked", Arrival star tile, "View all achievements" link)
- **Recover. Restore. Reset.** banner across the bottom with spa photo + Explore Amenities button + 4 amenity icons (Sauna, Cold Plunge, Red Light, More)

## Mobile reference (image 2) — what I'll reproduce

iPhone frame, 9:41 status bar, drawer open on left over a dimmed dashboard:
- Cream drawer with STORM wordmark + X close button
- Same 5 sidebar sections in same order, gold section labels
- Back to Website + Sign Out (red) pinned at the bottom of the drawer
- Behind the drawer (dimmed): "…ne back, Sahar / …wellness, all in one place." headline, a dark **Diamond Member** card with Credits/Visits/Upcoming Billing mini-stats inside it, Credits Expiring Soon pill, 4-tile Book Anything row (Book Class · Amenity · Spa Aella · Café), Up Next card with class photo
- **Bottom tab bar** with 4 tabs: Book · Activity (with "3" badge) · Support · Account

## Deliverables

- `/mnt/documents/member-portal-v5-desktop.png` (1600×1000)
- `/mnt/documents/member-portal-v5-mobile.png` (1080×1400, iPhone frame)

Both built as static HTML rendered via headless Chromium so they match the references pixel-faithfully (cream bg, dark sidebar, Cormorant Garamond display + Karla body, gold accents).

## Out of scope

- No edits to `Dashboard.tsx`, `MemberSidebar.tsx`, `MemberBottomNav.tsx`, `MemberLayout.tsx`, or any other app file
- No new routes, hooks, or components
- Implementation only begins after you approve the v5 mockup
