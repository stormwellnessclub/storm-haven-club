
## Plan: Remove Member Self-Service Cancellation Option

### Overview
Remove the ability for members to cancel their own subscription from the member portal. Memberships are 1-year commitments that auto-renew, and only staff should be able to cancel them. Admin cancellation functionality will be preserved.

---

### Changes Required

#### File 1: `src/components/member/InlineBillingSection.tsx`

**What to remove:**

1. **Import statement** (line 11)
   - Remove: `import { CancelSubscriptionDialog } from "@/components/member/CancelSubscriptionDialog";`

2. **State for cancel dialog** (line 79)
   - Remove: `const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);`

3. **Cancel success handler** (lines 172-174)
   - Remove: `const handleCancelSuccess = () => { refetchSubscription(); };`

4. **Cancel button UI** (lines 252-262)
   - Remove the entire block that renders the "Cancel Subscription" button:
   ```tsx
   {!isCanceled && (
     <div className="pt-4 border-t">
       <Button 
         variant="outline" 
         className="text-destructive hover:text-destructive hover:bg-destructive/10"
         onClick={() => setIsCancelDialogOpen(true)}
       >
         <XCircle className="mr-2 h-4 w-4" />
         Cancel Subscription
       </Button>
     </div>
   )}
   ```

5. **Cancel dialog component** (lines 427-436)
   - Remove the CancelSubscriptionDialog component render:
   ```tsx
   {stripeSubscriptionId && (
     <CancelSubscriptionDialog
       open={isCancelDialogOpen}
       onOpenChange={setIsCancelDialogOpen}
       subscriptionId={stripeSubscriptionId}
       accessEndDate={nextBillingDate}
       onSuccess={handleCancelSuccess}
     />
   )}
   ```

6. **Unused import** (line 7)
   - Remove `XCircle` from the lucide-react import since it was only used for the cancel button

---

#### File 2: `src/components/member/CancelSubscriptionDialog.tsx`

**Action:** Delete this file entirely

This component is only used for member self-service cancellation. The admin panel has its own inline cancellation logic in `MemberDetailSheet.tsx` that doesn't use this component.

---

### What Stays Unchanged

| Component | Location | Status |
|-----------|----------|--------|
| Admin cancel subscription button | `src/components/admin/MemberDetailSheet.tsx` | **Preserved** |
| Admin cancel annual fee subscription | `src/components/admin/MemberDetailSheet.tsx` | **Preserved** |

Staff will continue to have full control to cancel memberships from the admin member detail view.

---

### Member Portal Experience After Change

**Subscription Details Card** will show:
- Subscription status (Active/Canceled)
- Plan type (e.g., "Diamond (Monthly)")
- Next billing date
- Monthly/Annual amount

**What's removed:**
- ❌ "Cancel Subscription" button
- ❌ Cancellation confirmation dialog

Members who wish to cancel will need to contact staff, ensuring adherence to the 1-year commitment policy.
