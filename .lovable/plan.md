

## Restrict Spa Bookings to Recovery Only + "Opening Early April" Notice

### What's Happening Now
The `/spa` page lists ~44 spa services across 5 categories (Facials, Massage, Body Rituals, Body Wraps, Recovery) and all have a "Book Now" button that opens the booking modal. There's no restriction — anyone can book any service.

### Plan

#### 1. Mark non-recovery services as not yet bookable (`src/pages/Spa.tsx`)
- Add a flag or check: only services in the "Recovery" category (Red Light Therapy and Zero Body Cryo) get the "Book Now" button
- For all other categories (Body Rituals, Body Wraps, Massage, Facials), replace the "Book Now" button with a disabled state showing "Coming Soon"
- Add a prominent banner/notice at the top of the spa page (below the hero): **"Spa Aella is opening early April. Red Light Therapy and ZeroBody Cryo are available now — full spa services coming soon."**

#### 2. Keep the member Wellness page as-is (`src/pages/member/Wellness.tsx`)
- This page already only shows Red Light Therapy and Dry Cryotherapy — no changes needed

#### 3. Prevent booking modal from processing non-recovery services
- In `SpaBookingModal`, add a guard: if the service category is not "Recovery", show a message that spa services open early April instead of the booking form. This is a safety net in case someone bypasses the disabled button.

### Files to modify
- `src/pages/Spa.tsx` — add "opening early April" banner, disable booking for non-Recovery services
- `src/components/booking/SpaBookingModal.tsx` — add guard for non-Recovery services

