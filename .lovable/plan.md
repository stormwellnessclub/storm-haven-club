
# Member Portal Credits & Wellness Booking Fixes

## Issues Identified

### Issue 1: Dashboard Missing Wellness Credits Display
**Current State**: The dashboard only shows "Monthly Credits" which displays `classCredits` (the 10 class credits). It does NOT display:
- Red Light Therapy credits (10 remaining)
- Dry Cryo credits (6 remaining)

**Location**: `src/pages/member/Dashboard.tsx` lines 142-166

**Impact**: Diamond members don't see their valuable wellness credits on their main dashboard.

---

### Issue 2: Credits Page Loading/Lag Issue
**Current State**: The Credits page (`src/pages/member/Credits.tsx`) uses `useUserCredits()` hook which queries:
1. `members` table for active member status
2. `member_credits` table filtered by `user_id` and `expires_at > now`
3. `class_passes` table for purchased passes

**Potential Causes of Lag**:
- No error handling visible in the hook - if one query fails, data may never load
- The `member_credits` query may be returning empty due to:
  - RLS policy issue
  - Query using `user_id` but credits stored with different ID
  - Date comparison issue with `expires_at`

**Investigation Needed**: Add console logging to verify data flow

---

### Issue 3: No Wellness Booking in Member Portal
**Current State**: Members must navigate to the PUBLIC `/spa` page to book Red Light Therapy and Dry Cryo sessions. There is:
- No "Book Wellness" or "Book Recovery" option in member sidebar
- No dedicated wellness booking page in `/member/` routes
- The Spa page does support credit-based booking via `SpaBookingModal`

**Impact**: Members may not realize they can book these services or how to use their credits.

---

## Proposed Fixes

### Fix 1: Add Wellness Credits to Dashboard Quick Stats

Add two new stat cards to the dashboard grid showing:
- **Red Light Credits**: X of Y remaining (with Zap icon)
- **Dry Cryo Credits**: X of Y remaining (with Snowflake icon)

These should only appear for Gold/Platinum/Diamond members.

**Files to modify**: `src/pages/member/Dashboard.tsx`

---

### Fix 2: Add Debug Logging to Credits Hook

Add error handling and console logs to diagnose why wellness credits aren't loading:

```typescript
const { data: credits, error: creditsError } = await supabase
  .from("member_credits")
  .select("*")
  .eq("user_id", user.id)
  .gt("expires_at", now);

console.log("Credits query result:", { credits, creditsError, userId: user.id });
```

**Files to modify**: `src/hooks/useUserCredits.ts`

---

### Fix 3: Add Wellness Booking to Member Portal

**Option A: Add Sidebar Links to Spa Page (Quick)**
Add links in member sidebar:
- "Book Red Light" → `/spa?category=Recovery`
- "Book Cryo" → `/spa?category=Recovery`

**Option B: Create Dedicated Member Wellness Page (Better UX)**
Create new page `src/pages/member/Wellness.tsx` that:
1. Shows current wellness credit balances
2. Lists only Recovery services (Red Light, Cryo)
3. Has direct "Book Now" buttons that open `SpaBookingModal`
4. Shows upcoming wellness appointments

Add to sidebar: "Wellness Booking" with Sparkles icon

---

## Recommended Implementation Order

1. **Debug First**: Add logging to `useUserCredits.ts` to confirm data is being fetched
2. **Dashboard Credits**: Add wellness credit cards to dashboard (visible feedback)
3. **Wellness Booking Page**: Create dedicated booking interface in member portal
4. **Update Sidebar**: Add wellness booking link

---

## Technical Details

### Dashboard Wellness Credits Widget

```tsx
{/* Wellness Credits - Show for Gold/Platinum/Diamond */}
{credits?.redLightCredits && (
  <Card variant="interactive" className="hover-lift-sm">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium">Red Light Therapy</CardTitle>
      <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/20">
        <Zap className="h-4 w-4 text-orange-500" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold font-serif">
        {credits.redLightCredits.credits_remaining}
      </div>
      <p className="text-xs text-muted-foreground">
        of {credits.redLightCredits.credits_total} sessions
      </p>
    </CardContent>
  </Card>
)}
```

### Member Wellness Page Structure

```
/member/wellness
├── Credit Balance Cards (Red Light + Dry Cryo)
├── Quick Actions
│   ├── Book Red Light Session
│   └── Book Dry Cryo Session
├── Available Time Slots (today/this week)
└── My Upcoming Wellness Appointments
```

### Sidebar Update

Add to `wellnessMenuItems` array:
```typescript
{ title: "Wellness Booking", url: "/member/wellness", icon: Sparkles },
```

---

## Questions Answered

**Q: Why are class passes empty for Sahar?**
A: Correct behavior. Class passes are **purchased separately** (e.g., 5-class pilates pack). Sahar hasn't bought any passes - she uses her Diamond membership **credits** instead. The credits come automatically with her membership tier.

**Q: Where do members book Red Light / Cryo?**
A: Currently only via the public `/spa` page. The `SpaBookingModal` already supports credit-based payment, but members need a more obvious path to access this.
