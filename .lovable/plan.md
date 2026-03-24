

# Fix Kids Care Age Range: 4 months to 8 years

## What needs to change

The current code uses "3 months to 10 years" everywhere. The correct range is **4 months to 8 years**. Jessica's 3-month-old is a one-time exception — the system minimum should be 4 months going forward.

## All locations to update

### 1. Age validation logic
- **`src/components/booking/KidsCareBookingModal.tsx`** line 175: change `ageNum < 0.25` (3 months) to `ageNum < 0.333` (4 months), and `ageNum > 10` to `ageNum > 8`. Update error message to "4 months to 8 years".

### 2. Age group definitions
- **`src/hooks/useKidsCareBooking.ts`** line 48: change `AGE_GROUPS.infants.min` from `0.25` to `0.333` (4 months). Change `AGE_GROUPS` school age max from implied 10 to 8. Update the `getAgeGroup` function accordingly.

### 3. Room/age display on public Kids Care page
- **`src/pages/KidsCare.tsx`** lines 69, 79: change "3 months - 1 year" to "4 months - 1 year", and "5 - 10 years" to "5 - 8 years".

### 4. Member dashboard banner
- **`src/pages/member/Dashboard.tsx`** line 189: change "Ages 3 months – 10 years" to "Ages 4 months – 8 years".

### 5. FAQ page
- **`src/pages/FAQ.tsx`** line 34: change "6 months to 12 years" to "4 months to 8 years".

### 6. Amenities page (from the current code shown)
- **`src/pages/Amenities.tsx`**: the Kids Care listing just says "Supervised childcare" — no age range text, so no change needed there.

### 7. Admin childcare RPC
- **`admin_create_kids_care_booking`** RPC: currently has no age validation. No change needed since the client validates, but the age group assignment logic in the RPC uses hardcoded thresholds that already work for 4mo–8yr.

## Files to change
- `src/components/booking/KidsCareBookingModal.tsx` — age validation bounds + error message
- `src/hooks/useKidsCareBooking.ts` — AGE_GROUPS min/max + getAgeGroup function
- `src/pages/KidsCare.tsx` — room age range display text
- `src/pages/member/Dashboard.tsx` — banner text
- `src/pages/FAQ.tsx` — FAQ answer text

