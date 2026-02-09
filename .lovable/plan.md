
## Enhanced Admin Charge Dialog and Membership Editing

### Problem Summary
1. **Charge dialog is too basic**: Currently just a free-text amount and description field. No preset charge items. Admin must manually remember prices and type descriptions.
2. **Edit form is too limited**: Only edits name, email, phone, membership_type, and status. Missing: gender, billing_type, membership_start_date, activated_at, is_founding_member.
3. **Members like Deana Boussi show "active" but have incomplete subscriptions** -- admins need to quickly correct status and record manual payments.

---

### Fix 1: Replace Charge Dialog with Item Selector

Replace the basic charge dialog in both `MemberDetail.tsx` and `MemberDetailSheet.tsx` with a new dialog that has a **charge item dropdown** with pre-populated amounts. When an item is selected, the amount and description auto-fill. Admin can still override the amount or choose "Custom" for ad-hoc charges.

**Charge Item Categories:**

| Item | Amount | Description |
|------|--------|-------------|
| Membership Dues (Monthly) | Auto-calculated from tier/gender | "Monthly membership dues - [Tier]" |
| Membership Dues (Annual) | Auto-calculated from tier/gender | "Annual membership dues - [Tier]" |
| Past Due Payment | Auto-calculated | "Past due membership payment" |
| Failed Payment Recovery | Auto-calculated | "Failed payment recovery - [Tier]" |
| Initiation Fee | $175 (men) / $300 (women) | "Initiation fee" |
| Guest Pass | $60 | "Guest pass - gym and amenities" |
| Guest Add-on: RLT 10min | $18 | "Red Light Therapy 10 min" |
| Guest Add-on: RLT 20min | $28 | "Red Light Therapy 20 min" |
| Guest Add-on: Cryo | $45 | "ZeroBody Cryo Session" |
| Single Class Pass (Member) | $25 / $15 | "Single class pass" |
| Single Class Pass (Non-Member) | $40 / $30 | "Single class pass (non-member)" |
| 10-Pack Class Pass (Member) | $170 / $150 | "10-pack class pass" |
| 10-Pack Class Pass (Non-Member) | $300 / $200 | "10-pack class pass (non-member)" |
| Late Cancel Fee | $25 | "Late cancellation fee" |
| Custom | Admin enters amount | Admin enters description |

**Implementation:**
- Create a new `ChargeItemSelector` component or inline it in the dialog
- Use a Select dropdown with grouped items (Membership, Class Passes, Guest Services, Fees, Custom)
- When selected, auto-populate amount and description
- Amount remains editable for overrides
- Add an optional "Record as manual/cash" checkbox that logs to `manual_charges` instead of charging Stripe

---

### Fix 2: Expand the Edit Form

Add these fields to the edit form in both `MemberDetail.tsx` and `MemberDetailSheet.tsx`:

| Field | Type | Notes |
|-------|------|-------|
| Gender | Select (Male/Female) | Affects pricing |
| Billing Type | Select (Monthly/Annual/Cash) | "Cash" bypasses Stripe checks |
| Membership Start Date | Date input | Contract start |
| Activated At | Date input | When access began |
| Is Founding Member | Checkbox/Switch | Affects billing type |

**Edit form state expansion:**
```text
editForm = {
  first_name, last_name, email, phone,
  membership_type, status,
  // NEW:
  gender,
  billing_type,
  membership_start_date,
  activated_at,
  is_founding_member,
}
```

The `saveChanges` function will be updated to include all new fields in the database update.

---

### Fix 3: "Record Manual Payment" Option

Add a checkbox in the charge dialog: **"Record as cash/manual payment (do not charge card)"**

When checked:
- Instead of calling `charge_saved_card`, insert directly into `manual_charges` table
- Fields: member_id, amount (in cents), description, charge_type ("membership_dues", "initiation_fee", "class_pass", "guest_pass", "other"), status ("succeeded"), payment_method select (Cash, Check, External)
- This creates an audit trail without touching Stripe
- Useful for members who pay in person

---

### Summary of File Changes

| File | Changes |
|------|---------|
| `src/pages/admin/MemberDetail.tsx` | Expand editForm with gender, billing_type, start date, activated_at, is_founding_member. Replace charge dialog with item selector + manual payment option. |
| `src/components/admin/MemberDetailSheet.tsx` | Same edit form expansion and charge dialog upgrade. |

### Technical Notes
- Pricing data is sourced from `src/lib/membershipPricing.ts` and `src/lib/stripeProducts.ts` (already have all the price constants)
- The `manual_charges` table already exists with the needed columns (member_id, amount, description, charge_type, status)
- No backend/edge function changes needed -- the charge item selector just pre-fills the existing `charge_saved_card` action parameters
- The "record as manual" path inserts directly into `manual_charges` via the Supabase client
