# Mockup v6 — Final Refinements

Build **dash6.html** in `/tmp/browser/mock5/` from the v3 base. Render desktop AND mobile from the same source structure so they line up.

## Changes from v3

1. **Top-right "Quick Book" button → "Support"** — The black/shaded pill button next to the "Welcome back" header becomes a **Support** button (not added as a 5th booking tile). The booking tiles row stays as the original 4: 📅 Book Class, 💧 Book Amenity, 🎟 Buy Passes, 🔔.

2. **Up Next on top** — Move the upcoming-appointment block (next class / spa / wellness) ABOVE the metric tiles row. It's the first thing seen under the welcome header.

3. **Credits expiring → collapsed dropdown** — Replace the full expiring-credits card with a small inline pill: `● 3 credits expiring in 7 days ▾` that expands on click.

4. **Remove Kids Care banner** — Strip the standalone Kids Care promo card from the dashboard body.

5. **Sidebar — full comprehensive nav** (matching v4/v5):
   - **Main**: Dashboard, Member Entry, Support, Cafe Order, Storm Shop
   - **Membership & Billing**: My Membership, My Credits, Payment Methods, Payment History, Buy Passes
   - **Bookings & Visits**: My Bookings, Visit History, Kids Care, Wellness Booking
   - **Health & Wellness**: Health Score, Workouts ✨, Habits, Goals, Achievements, Fitness Profile
   - **Account**: My Profile, Waivers, Freeze Request, Register Guest, Refer a Friend
   - Footer: Back to Website, Sign Out
   - Dark gradient styling preserved

6. **Mobile mirrors desktop** — Same structure, same order, same labels (no shortened text, no reflowed layout). Single column where needed but the sequence is identical: Welcome + Support button → Up Next → 4 metric tiles → 4 booking tiles → expiring pill → Recent Activity + Habits.

## Deliverables

- `/mnt/documents/dashboard-desktop-v6.png`
- `/mnt/documents/dashboard-mobile-v6.png`

No app files touched. Approve v6 → then implement on `Dashboard.tsx` + `MemberSidebar.tsx`.
