
# Member Portal Onboarding Checklist for Pending Activation Members

## Problem Identified

When a member receives the "card request email" and logs into their member portal, the `pending_activation` view at `/member/membership` shows:
- ✅ Payment method status (with add/update button)
- ✅ Membership tier preview
- ❌ **MISSING**: Membership agreement signing prompt
- ❌ **MISSING**: Clear checklist showing all required setup tasks

Members need a clear, actionable onboarding experience that shows them exactly what steps remain before their membership can be activated.

## Solution: Add Onboarding Checklist Component

### Implementation Plan

**1. Create a new `MemberOnboardingChecklist` component**

This component will display a clear task list for pending_activation members:
- [ ] Add Payment Method (check if `card_brand` and `card_last4` exist)
- [ ] Sign Membership Agreement (check if member has signed via `member_agreement_signatures` table)
- [ ] Await Activation (status indicator)

**2. Query member agreement signature status**

Create or update hook to check if the member has signed the required membership agreement by querying the `member_agreement_signatures` table.

**3. Update `/member/membership` pending_activation view**

Replace the current disconnected cards with a cohesive onboarding flow:
- Progress indicator showing X of Y tasks complete
- Clear action buttons for each incomplete task
- Checkmarks for completed tasks
- Link to sign agreement (opens agreement PDF with signature form)

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/member/Membership.tsx` | Add checklist UI to pending_activation section |
| `src/hooks/useMemberAgreementStatus.ts` | New hook to check agreement signature status |
| `src/components/member/MemberOnboardingChecklist.tsx` | New component for task checklist |

### Technical Details

**Agreement Signature Query:**
```typescript
const { data: signedAgreements } = await supabase
  .from("member_agreement_signatures")
  .select("agreement_id")
  .eq("member_id", membership.id);
```

**Checklist Logic:**
```typescript
const tasks = [
  { 
    id: 'payment', 
    label: 'Add Payment Method', 
    complete: !!(membership.card_brand && membership.card_last4),
    action: '/member/payment-methods'
  },
  { 
    id: 'agreement', 
    label: 'Sign Membership Agreement', 
    complete: hasSignedMembershipAgreement,
    action: '/member/waivers' // or modal
  },
];
```

### UI Preview

```
┌─────────────────────────────────────────────┐
│ 🎉 Welcome! Complete Your Membership Setup  │
├─────────────────────────────────────────────┤
│ Progress: 1 of 2 tasks complete             │
│ ━━━━━━━━━━━━━━━━░░░░░░░░░░ 50%             │
├─────────────────────────────────────────────┤
│ ✅ Add Payment Method        [Card on File] │
│ ⬜ Sign Membership Agreement [Sign Now →]   │
├─────────────────────────────────────────────┤
│ Your tier: Diamond Membership               │
│ Status: Awaiting activation by staff        │
└─────────────────────────────────────────────┘
```

### Expected Outcome

- Members will see exactly what they need to complete
- Clear calls-to-action for each required task
- Visual feedback as tasks are completed
- Staff can see completion status in admin portal
