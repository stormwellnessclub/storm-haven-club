

## Plan: Kids Care Pass Purchase Flow + Per-Child Profiles

### Summary
Two features:
1. **Kids Care Pass subscription** — members purchase a $75/month auto-renewing pass via Stripe Checkout (4 days access, 2hr max per session, 30-day validity)
2. **Per-child profiles** — parents register each child separately with medical/emergency info stored in the database, then select a saved child when booking

---

### 1. Stripe Product & Price

Create a Stripe product and recurring price:
- **Product**: "Kids Care Pass (Member)" 
- **Price**: $75/month recurring
- Add the price ID to `src/lib/stripeProducts.ts` under a new `kidsCare` section

---

### 2. Database Changes

**New table: `kids_care_children`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid | FK auth.users, the parent |
| full_name | text | Child's full name |
| date_of_birth | date | |
| age_group | text | Auto-calculated from DOB |
| allergies | text | |
| medical_conditions | text | |
| medications | text | |
| special_instructions | text | |
| emergency_contact_name | text | |
| emergency_contact_phone | text | |
| relationship_to_child | text | |
| authorized_pickup_persons | text | |
| photo_release | boolean | default false |
| is_active | boolean | default true |
| created_at / updated_at | timestamptz | |

RLS: users can CRUD their own children; staff can read all.

---

### 3. Edge Function Updates (`stripe-payment/index.ts`)

Add a new action `create_kids_care_checkout`:
- Server-side membership verification (same pattern as `create_class_pass_checkout`)
- Creates a Stripe Checkout session in `mode: 'subscription'` with the Kids Care price ID
- Adds recurring processing fee line item
- Metadata: `type: 'kids_care_pass'`, `user_id`

---

### 4. Webhook Updates (`stripe-webhook/index.ts`)

Handle `kids_care_pass` metadata type on `checkout.session.completed`:
- Insert a record into `class_passes` with `pass_type: 'kids_care'`, `category: 'other'`, `classes_total: 4`, `classes_remaining: 4`, `expires_at: now + 30 days`
- Store the Stripe subscription ID for cancellation support

Handle `invoice.payment_succeeded` for renewals:
- Detect Kids Care subscription by price ID
- Reset pass: `classes_remaining = 4`, extend `expires_at` by 30 days, set `status = 'active'`

---

### 5. Frontend: Kids Care Pass Purchase

**Update `src/pages/KidsCare.tsx`**:
- Add a "Purchase Kids Care Pass" section with pricing card ($75/mo, 4 sessions, 2hr max)
- Purchase button calls `supabase.functions.invoke("stripe-payment", { body: { action: "create_kids_care_checkout", ... } })`
- Show active pass status if user already has one

**Update `src/pages/ClassPasses.tsx`** (optional):
- Add a Kids Care section or link to the Kids Care page for pass purchase

---

### 6. Frontend: Per-Child Profiles

**Create `src/hooks/useKidsCareChildren.ts`**:
- `useKidsCareChildren()` — fetch all children for the logged-in user
- `useAddChild()` — mutation to add a child profile
- `useUpdateChild()` — mutation to update
- `useDeleteChild()` — soft delete (set `is_active = false`)

**Update `src/pages/member/KidsCareServiceForm.tsx`**:
- Transform from a one-time boolean form into a child profile manager
- Show list of registered children with edit/delete
- "Add Child" form with all the medical/emergency fields
- Each child saved to `kids_care_children` table
- Still track `kids_care_service_form_completed` on profile (set to true when at least one child is registered)

**Update `src/components/booking/KidsCareBookingModal.tsx`**:
- Replace manual child name/age entry with a dropdown of registered children from `kids_care_children`
- Auto-fill age group and room assignment from the selected child's DOB
- "Add a new child" link if no children registered

---

### 7. Subscription Management

- Members can cancel their Kids Care subscription via the existing Stripe Customer Portal flow
- Add a "Manage Kids Care Pass" button on the Kids Care page that links to portal or shows cancel option
- No proration on cancellation — access continues until the current period ends

---

### Files to Create/Update

- **Migration**: `kids_care_children` table + RLS policies
- **Create**: `src/hooks/useKidsCareChildren.ts`
- **Update**: `src/lib/stripeProducts.ts` — add Kids Care price IDs
- **Update**: `supabase/functions/stripe-payment/index.ts` — add `create_kids_care_checkout` action
- **Update**: `supabase/functions/stripe-webhook/index.ts` — handle Kids Care pass fulfillment + renewal
- **Update**: `src/pages/KidsCare.tsx` — add purchase section
- **Update**: `src/pages/member/KidsCareServiceForm.tsx` — convert to per-child profile manager
- **Update**: `src/components/booking/KidsCareBookingModal.tsx` — child selector from saved profiles

