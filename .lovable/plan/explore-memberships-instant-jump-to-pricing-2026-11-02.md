# Explore Memberships + instant jump to pricing

## What changes
1. **Button wording and destination** — Every public "Apply for Membership" button (top menu on desktop and mobile, homepage hero and bottom section, Amenities, Recovery Guide, Class Passes, service landing pages) becomes **"Explore Memberships"** and opens the Memberships page instead of the application form. Footer "Apply Now" becomes "Explore Memberships" too. Member-portal buttons stay as they are.
2. **Premium shortcut on the Memberships page** — A slim bar pinned just below the top menu with two links: **"View Membership Tiers"** (smooth-scrolls straight to the four tier prices) and **"Apply for Invitation"** (opens the application). It stays visible while scrolling.
3. **Direct-to-prices links** — Buttons pointing to memberships use the tiers anchor so visitors land on the prices immediately when they want them; the hero button gains a second option "View Tiers" beside "Apply for invitation".
4. Shortened photo hero on phones (80% screen height to about 55%) so prices are closer.

## Technical
- Replace `/apply` links with `/memberships#tiers` (nav/hero) in listed files; `ServiceLandingPage` default label/href.
- Memberships.tsx: sticky sub-nav (`sticky top-[nav height] z-40`), button calls `document.getElementById('tiers').scrollIntoView({behavior:'smooth'})`; on mount, scroll to `location.hash` after render. `#tiers` already has `scroll-mt-24`; bump to account for sub-nav.
