

## Fix Hour Request Status Labels + Add Cancel Info to Kids Care Pass

### Changes

#### 1. Hour Request: Replace "Pending" with friendlier label
**File:** `src/components/kids-care/HourRequestForm.tsx`
- Change the status badge from "Pending" (which implies waiting for approval) to **"Request Sent"** with a neutral/positive color instead of warning yellow
- Keep "Reviewed" and "Accommodated" as-is since those are meaningful updates from admin
- The section title "Your Previous Requests" already reads fine

#### 2. Kids Care Pass: Add "cancel anytime" messaging
**File:** `src/pages/member/KidsCare.tsx`
- Update the description from `"$75/month — 4 sessions per month, 2 hours max per session. Auto-renews monthly."` to include **"Cancel anytime."**
- When the pass is active, add a small "Cancel anytime" note or a link/button to contact support for cancellation (or invoke the Stripe customer portal if available)
- This reassures parents it's not a locked-in membership

### Files to modify
- `src/components/kids-care/HourRequestForm.tsx` — change "Pending" badge to "Request Sent"
- `src/pages/member/KidsCare.tsx` — add "cancel anytime" to pass description + active pass view

