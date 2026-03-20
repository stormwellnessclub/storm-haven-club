

## Update Approval Letter — Now-Open Language (Without Assuming Payment Status)

### The Problem
The current template says "We are currently finalizing the last details before our opening" and "Thank you for your patience as we prepare to welcome you." Both are outdated since the club is open. But we can't replace them with "complete your initiation fee, payment method, and waivers" because some approved members may have already completed those steps (e.g., immediate activation applicants who already paid).

### Solution
Use neutral language that works for everyone — whether they've already paid or still need to set up billing. Don't list specific setup steps in the approval letter. The onboarding checklist in the member portal already handles that dynamically (showing only incomplete tasks).

### Changes

**File: `supabase/functions/send-email/index.ts` (lines 195–216)**

Replace the two outdated paragraphs with:
- **Line 199-201**: Change "We are currently finalizing..." → "You will receive your member account activation details shortly. Once your account is set up, your personalized member portal will guide you through any remaining steps."
- **Lines 209-211**: Change "Thank you for your patience..." → "We look forward to seeing you at the club."
- **Lines 214-216**: Change "Storm / Founder" → "The Storm Wellness Club Team"

This way:
- Members who already paid won't be confused by being told to "complete payment"
- Members who haven't paid will see their specific tasks in the onboarding checklist once they log in
- The email stays clean and doesn't over-promise or under-inform

**File: `supabase/functions/generate-approval-letter/index.ts`**
- Update AI prompt guideline #5 from "they'll receive setup instructions soon" → "they'll receive their account activation details shortly, and their member portal will guide them through any remaining steps"
- Update sign-off instruction to "The Storm Wellness Club Team"

### Files to modify
- `supabase/functions/send-email/index.ts` — update 3 text sections (lines 195-216)
- `supabase/functions/generate-approval-letter/index.ts` — update AI prompt guidelines

