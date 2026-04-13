

## Update Spa Page Button Logic

**Goal**: Replace "Coming Soon" labels with functional buttons — "Book Now" for Massage (with waiver + payment gates) and "Request" for all other non-Recovery/non-Massage categories.

### 1. Create `spa_service_requests` table (migration)

```sql
CREATE TABLE public.spa_service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  service_name text NOT NULL,
  service_category text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.spa_service_requests ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated or anonymous user to insert
CREATE POLICY "Anyone can submit a service request"
  ON public.spa_service_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read requests
CREATE POLICY "Admins can read service requests"
  ON public.spa_service_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

### 2. Update `src/pages/Spa.tsx`

**New state variables**: `showWaiverGate`, `showPaymentGate`, `showRequestModal`, `requestService`

**Button logic per category**:

- **Recovery** (existing): "Book Now" → auth check → open SpaBookingModal directly (unchanged)
- **Massage**: "Book Now" → auth check → Gate 1 (waiver check via `profiles` + `non_member_profiles`) → Gate 2 (payment on file check via `members.card_last4`/`stripe_customer_id` or `non_member_profiles.card_last4`/`stripe_customer_id`) → open SpaBookingModal
- **All others** (Body Rituals, Body Wraps, Facials): "Request" → open a simple request modal

**Waiver Gate Modal**: 
- Fetch liability waiver PDF from `useAllAgreements` hook (already used in SpaBookingModal)
- Show PDF link, checkbox "I have read and agree to the liability waiver", and "Sign & Continue" button
- On sign: call `signWaiver()` from `useUserProfile` or `signNonMemberWaiver()` from `useNonMemberProfile`
- On success: proceed to payment gate check

**Payment Gate Modal**:
- Check member record (`useUserMembership`) for `stripe_customer_id` AND `card_last4`
- For non-members, check `non_member_profiles` for same fields
- If missing: show modal with message "A payment method is required before booking" and a button linking to `/member/billing` (members) or `/portal/billing` (non-members)
- If present: proceed to open SpaBookingModal

**Request Modal** (new `Dialog`):
- Pre-filled name/email from `useAuth` user metadata
- Message pre-filled with service name
- On submit: insert into `spa_service_requests`
- Success toast: "We'll be in touch soon!"

### 3. New hooks/imports needed in Spa.tsx
- `useUserProfile` (waiver status + signing)
- `useNonMemberProfile` (waiver status + signing for non-members)
- `useUserMembership` (card on file check for members)
- `useAllAgreements` (liability waiver PDF)
- `supabase` client (for request insert)

### Files to create/modify
- **Migration**: new `spa_service_requests` table
- **`src/pages/Spa.tsx`**: Add waiver gate modal, payment gate modal, request modal, and updated button logic

