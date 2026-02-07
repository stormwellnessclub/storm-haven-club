
# Complete Phase 1 Implementation - Detailed Plan

## Overview
This plan implements the three remaining components:
1. **CardSyncFailuresWidget** integration in Admin Dashboard
2. **"Send Phase 1 Setup Email"** action in Members page
3. **Duplicate account prevention** in Auth.tsx and Apply.tsx

---

## Part 1: Add CardSyncFailuresWidget to Dashboard.tsx

### What to Do
Import and add the `CardSyncFailuresWidget` to the admin dashboard to display card sync failures prominently.

### Implementation Details

**File**: `src/pages/admin/Dashboard.tsx`

**Changes**:
1. Import the widget at the top
2. Add it to the main dashboard grid after the BillingHealthWidget (alongside other critical alerts)
3. Position it with appropriate spacing and visual priority

**Code Pattern**:
```typescript
// Add import
import { CardSyncFailuresWidget } from "@/components/admin/CardSyncFailuresWidget";

// Add to the grid in the JSX (around line 375, after BillingHealthWidget)
// This widget handles its own loading/error states and returns null if no failures
<CardSyncFailuresWidget />
```

**Why**: The widget already exists with all the retry logic built in. We just need to display it in the dashboard. It's designed to:
- Show green success state if no failures
- Show critical red alert if failures exist
- Allow one-click retry per failure or "Retry All"
- Silently fail if there's an error loading failures (doesn't block dashboard)

---

## Part 2: "Send Phase 1 Setup Email" Action in Members.tsx

### What to Do
Add a new dropdown menu item in the Members table row actions that sends the `phase_one_setup` email specifically for pre-paid members.

### Current State
- The Members page already has `sendActivationEmail()` function (lines 194-228)
- It currently sends `member_activation_setup` email type
- Row action dropdown already exists (lines 545-582)

### Implementation Details

**File**: `src/pages/admin/Members.tsx`

**Changes**:
1. Create a new function `sendPhase1SetupEmail()` similar to `sendActivationEmail()` but:
   - Uses email type `phase_one_setup` instead of `member_activation_setup`
   - Only available if member has `annual_fee_paid_at` (initiation fee was paid)
   - Includes founding member status and tier change option in template data
   - Includes data about initial tier selection (for tier change reminder)

2. Add a new dropdown menu item in the row actions that:
   - Is conditionally visible: `member.status === "pending_activation" && member.annual_fee_paid_at`
   - Icon: `Send` (already imported)
   - Label: "Send Phase 1 Setup Email"
   - Calls `sendPhase1SetupEmail(member)`
   - Disabled state during sending

**Code Pattern** (added after `sendActivationEmail` function):
```typescript
const sendPhase1SetupEmail = async (member: typeof members[0], e?: React.MouseEvent) => {
  e?.stopPropagation();
  setIsSendingActivationEmail(true);
  try {
    const { error } = await supabase.functions.invoke("send-email", {
      body: {
        type: "phase_one_setup",
        to: member.email,
        data: {
          name: member.first_name,
          email: member.email,
          membershipTier: member.membership_type,
          isFoundingMember: member.is_founding_member,
          tier: member.membership_type?.toLowerCase(),
          allowTierChange: true, // Allow tier change if pending_activation
          launchDate: "February 9, 2026",
          hasCardOnFile: !!member.card_last4,
        },
      },
    });
    if (error) throw error;

    // Update activation_email_sent_at
    await supabase
      .from("members")
      .update({ activation_email_sent_at: new Date().toISOString() })
      .eq("id", member.id);

    toast.success(`Phase 1 setup email sent to ${member.first_name}`);
    queryClient.invalidateQueries({ queryKey: ["admin-members"] });
  } catch (error) {
    console.error("Error sending Phase 1 email:", error);
    toast.error("Failed to send Phase 1 setup email");
  } finally {
    setIsSendingActivationEmail(false);
  }
};
```

**Row Action Menu Update** (added to dropdown menu around line 574, right after the existing "Send Activation Email"):
```typescript
{member.status === "pending_activation" && member.annual_fee_paid_at && (
  <DropdownMenuItem 
    onClick={(e) => {
      e.stopPropagation();
      sendPhase1SetupEmail(member, e as any);
    }}
    disabled={isSendingActivationEmail}
  >
    <Send className="h-4 w-4 mr-2" />
    Send Phase 1 Setup Email
  </DropdownMenuItem>
)}
```

**Why**: 
- Targets only members who have already paid their initiation fee
- Sends the specialized email template with founding perks, tier options, and payment method setup instructions
- Reuses existing email infrastructure and state management

---

## Part 3: Duplicate Account Prevention

### 3.1 Prevention in Auth.tsx (Sign In / Sign Up)

**File**: `src/pages/Auth.tsx`

**What to Do**:
Before allowing signup, check if an email is already associated with an application or existing member record.

**Implementation Details**:

Add a new function after the `validateForm()` function:

```typescript
const checkForDuplicateAccount = async (email: string): Promise<{
  isDuplicate: boolean;
  reason: string;
}> => {
  try {
    // Check for existing member
    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .select("id, status, email")
      .ilike("email", email) // Case-insensitive
      .maybeSingle();

    if (memberData) {
      return {
        isDuplicate: true,
        reason: `An account already exists for this email address (Status: ${memberData.status}).`,
      };
    }

    // Check for pending application
    const { data: appData, error: appError } = await supabase
      .from("membership_applications")
      .select("id, status, email")
      .ilike("email", email)
      .neq("status", "rejected")
      .neq("status", "cancelled")
      .maybeSingle();

    if (appData) {
      return {
        isDuplicate: true,
        reason: `An application already exists for this email address (Status: ${appData.status}). Please sign in with this email instead.`,
      };
    }

    return { isDuplicate: false, reason: "" };
  } catch (error) {
    // Log but don't block signup if check fails
    console.warn("[Auth] Duplicate check failed:", error);
    return { isDuplicate: false, reason: "" };
  }
};
```

Update the `handleSubmit()` function to call this check:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!validateForm()) return;

  // NEW: Check for duplicates on signup
  if (isSignUp) {
    const dupeCheck = await checkForDuplicateAccount(email);
    if (dupeCheck.isDuplicate) {
      toast({
        title: "Account Already Exists",
        description: dupeCheck.reason,
        variant: "destructive",
      });
      return;
    }
  }

  setIsLoading(true);
  // ... rest of existing handleSubmit logic
};
```

**Why**: 
- Prevents users from creating accounts with emails that already have applications or member records
- Case-insensitive matching ensures consistency
- Provides helpful messaging pointing users to sign in instead
- Silent fail on check errors to avoid blocking legitimate signups

---

### 3.2 Prevention in Apply.tsx (Application Submission)

**File**: `src/pages/Apply.tsx`

**What to Do**:
Before allowing application submission, verify the email doesn't have an active application or member record.

**Implementation Details**:

Add a new function after form validation helpers (around line 650):

```typescript
const checkForDuplicateApplication = async (email: string): Promise<{
  isDuplicate: boolean;
  message: string;
}> => {
  try {
    // Check for existing member
    const { data: memberData } = await supabase
      .from("members")
      .select("id, status, email")
      .ilike("email", email)
      .maybeSingle();

    if (memberData) {
      return {
        isDuplicate: true,
        message: `A member account already exists for ${email}. Please contact support if you need to update your information.`,
      };
    }

    // Check for pending/approved application
    const { data: appData } = await supabase
      .from("membership_applications")
      .select("id, status, email")
      .ilike("email", email)
      .neq("status", "rejected")
      .neq("status", "cancelled")
      .maybeSingle();

    if (appData) {
      const statusDisplay = appData.status.replace(/_/g, " ").toUpperCase();
      return {
        isDuplicate: true,
        message: `An application already exists for ${email} with status: ${statusDisplay}. Only one application per email address is allowed.`,
      };
    }

    return { isDuplicate: false, message: "" };
  } catch (error) {
    console.warn("[Apply] Duplicate check failed:", error);
    return { isDuplicate: false, message: "" };
  }
};
```

Update the `handleSubmit()` function to call this check (around line 607):

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Validate required fields
  if (!formData.firstName || !formData.lastName || ... /* existing checks */) {
    toast.error("Please fill in all required fields");
    return;
  }

  // NEW: Check for duplicate application
  const dupeCheck = await checkForDuplicateApplication(formData.email);
  if (dupeCheck.isDuplicate) {
    toast.error(dupeCheck.message);
    return;
  }

  // ... rest of existing handleSubmit logic
};
```

**Why**:
- Prevents duplicate applications from same email
- Allows users to see application status if it exists
- Uses case-insensitive matching to catch variations (John@example.com vs john@example.com)
- Fails gracefully if check errors

---

## Part 4: Database Constraints (Already Implemented)

The migrations already created:
- `idx_members_email_unique` - Case-insensitive unique constraint on members email
- `idx_applications_active_email` - Case-insensitive unique constraint on active applications

These provide a safety net against duplicate records even if the UI checks are bypassed.

---

## Technical Architecture

### Data Flow for Phase 1 Email
```
Admin clicks "Send Phase 1 Setup Email"
  ↓
sendPhase1SetupEmail() function invoked
  ↓
supabase.functions.invoke("send-email", { type: "phase_one_setup", ... })
  ↓
send-email edge function receives request
  ↓
Renders phase_one_setup template with:
  - Member name & tier
  - Founding member perks (if applicable)
  - Setup steps (account creation, card save, agreements)
  - Tier change reminder (if tier_change_used = false)
  - Launch date info
  ↓
Email sent via Resend API
  ↓
activation_email_sent_at updated in database
  ↓
Toast confirmation shown to admin
```

### Duplicate Prevention Flow
```
User enters email in Auth.tsx or Apply.tsx
  ↓
User clicks "Sign Up" or "Submit Application"
  ↓
checkForDuplicate*() function queries database:
  - Query members table (case-insensitive)
  - Query membership_applications (case-insensitive, exclude rejected/cancelled)
  ↓
If found: Show error message, prevent submission
If not found: Continue with signup/application
  ↓
Database constraint acts as final safety net:
  - If duplicate somehow inserted, constraint violation occurs
  - Error is caught and reported to user
```

---

## Files to Modify

| File | Type | Changes |
|------|------|---------|
| `src/pages/admin/Dashboard.tsx` | Modify | Import and add CardSyncFailuresWidget component |
| `src/pages/admin/Members.tsx` | Modify | Add sendPhase1SetupEmail() function + dropdown menu item |
| `src/pages/Auth.tsx` | Modify | Add checkForDuplicateAccount() function + call in handleSubmit |
| `src/pages/Apply.tsx` | Modify | Add checkForDuplicateApplication() function + call in handleSubmit |

---

## Testing Checklist

### CardSyncFailuresWidget Display
- [ ] Widget appears on admin Dashboard
- [ ] Widget shows green "All synced" when no failures
- [ ] Widget shows red alert with failures list when failures exist
- [ ] "Retry All" button works and retries all failures
- [ ] Individual retry buttons work per failure
- [ ] X (dismiss) buttons work per failure

### Phase 1 Email
- [ ] Menu item only shows for pending_activation members with annual_fee_paid_at
- [ ] Email button sends phase_one_setup template
- [ ] Email includes founding member perks if applicable
- [ ] Email includes tier change reminder
- [ ] activation_email_sent_at timestamp updates in database
- [ ] Sent status appears in "Email Sent" column after sending
- [ ] Toast confirms successful send

### Duplicate Prevention - Auth.tsx
- [ ] Try to sign up with email that has existing member → blocked with message
- [ ] Try to sign up with email that has pending application → blocked with message
- [ ] Try to sign up with new email → succeeds
- [ ] Try to sign up with rejected application email → succeeds (different person)
- [ ] Check works case-insensitively (John@example.com blocks john@example.com)

### Duplicate Prevention - Apply.tsx
- [ ] Try to apply with email that has existing member → blocked with message
- [ ] Try to apply with email that has pending application → blocked with message
- [ ] Try to apply with email that has approved application → blocked with message
- [ ] Try to apply with new email → succeeds
- [ ] Try to apply with rejected application email → succeeds
- [ ] Check works case-insensitively

### Database Constraints
- [ ] If somehow a duplicate slips past UI, database constraint prevents it
- [ ] Error message is shown to user when constraint violated

