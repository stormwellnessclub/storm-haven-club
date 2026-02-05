# Member Portal Credits & Wellness Booking Fixes

## ✅ COMPLETED

All fixes have been implemented:

### Fix 1: Debug Logging Added to useUserCredits ✅
- Added console logging to trace data flow
- Added error handling for all Supabase queries
- **KEY BUG FIXED**: Changed query from `user_id` to `member_id` - credits are stored by member_id, not user_id

### Fix 2: Wellness Credits on Dashboard ✅
- Added Red Light Therapy card (orange theme, Zap icon)
- Added Dry Cryotherapy card (blue theme, Snowflake icon)
- Only displays when credits are available (Gold/Platinum/Diamond)

### Fix 3: Wellness Booking Page Created ✅
- New page at `/member/wellness`
- Shows credit balance cards with book buttons
- Lists upcoming wellness appointments
- Opens SpaBookingModal for booking (supports credit payment)

### Fix 4: Sidebar Updated ✅
- Added "Wellness Booking" link with Zap icon
- Positioned after "Buy Passes" in the My Account section

---

## Root Cause of Missing Credits

The `useUserCredits` hook was querying `member_credits` table using:
```typescript
.eq("user_id", user.id)
```

But credits are stored with `member_id`. Fixed to:
```typescript
.eq("member_id", memberId)
```

This explains why class credits were showing (they happened to be in a working state) but wellness credits weren't loading properly.

---

## Files Modified

- `src/hooks/useUserCredits.ts` - Fixed query + added logging
- `src/pages/member/Dashboard.tsx` - Added wellness credit cards
- `src/pages/member/Wellness.tsx` - NEW: Wellness booking page
- `src/components/member/MemberSidebar.tsx` - Added Wellness Booking link
- `src/App.tsx` - Added /member/wellness route

**Q: Where do members book Red Light / Cryo?**
A: Currently only via the public `/spa` page. The `SpaBookingModal` already supports credit-based payment, but members need a more obvious path to access this.
