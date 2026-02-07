
# Guest Pass Experience - Comprehensive Implementation Plan

## Executive Summary
Create an elevated, intentional guest pass purchase experience at `/guest-pass` with personalization, add-on services, and proper integration with waivers, Stripe, booking, and admin visibility.

---

## Integration Verification Summary

### What Works Now ✅
- **Stripe Guest Pass Product**: `price_1SxATYLyZrsSqLhs6vDu1QWg` ($60) already configured
- **Waiver System**: `guest_pass_agreement_signed` column exists in profiles, active agreement in database
- **Class Pass Non-Member Pricing**: Reformer/Cycling ($40), Aerobics ($30) prices configured
- **Admin Portal**: Basic `/admin/guest-passes` page exists for selling passes
- **Webhook Handler**: Existing `guest_pass` type handler in stripe-webhook

### Gaps to Address ❌
1. **No public guest pass page** - Currently admin-only flow
2. **No add-on Stripe products** - Need RLT ($18/$28) and Cryo ($45) prices
3. **Database schema incomplete** - Missing personalization fields
4. **No admin guest detail view** - Can't view guest profiles, preferences, or add-ons
5. **Guest cards not viewable** - Guests don't create accounts, so no saved payment methods

---

## Technical Implementation

### Phase 1: Database Schema Updates

Add columns to `guest_passes` table:

| Column | Type | Purpose |
|--------|------|---------|
| `user_id` | uuid | Logged-in user who purchased (null for admin sales) |
| `valid_date` | date | Selected visit date |
| `phone_number` | text | Guest phone number |
| `member_referral` | text | "Guest of" member name (optional) |
| `visit_interests` | text[] | What they're excited to experience |
| `visit_notes` | text | Preferences, injuries, intentions |
| `add_ons` | jsonb | Selected premium services |
| `stripe_customer_id` | text | For tracking payment |

### Phase 2: Stripe Products (Need to Create)

| Product | Price | Type |
|---------|-------|------|
| Full Body Red Light Therapy — 10 min | $18 | One-time |
| Full Body Red Light Therapy — 20 min | $28 | One-time |
| ZeroBody Cryo | $45 | One-time |

For class add-ons, use existing non-member prices:
- Reformer/Cycling Single: `price_1SlA38LyZrsSqLhsMjRhYzpT` ($40)
- Other Classes Single: `price_1SlABFLyZrsSqLhsGOpvWGFE` ($30)

### Phase 3: New Public Page `/guest-pass`

```text
┌─────────────────────────────────────────────────────────────┐
│  WELCOME TO STORM WELLNESS CLUB                             │
│  A shared ritual of movement, recovery, and presence.       │
└─────────────────────────────────────────────────────────────┘

Two-column layout:

LEFT SIDE (Form):
├── GUEST INFORMATION
│   ├── Full Name *
│   ├── Email Address *
│   ├── Phone Number *
│   ├── Date of Visit * (Today → +7 days)
│   └── Guest of (Member Name) - Optional
│
├── YOUR VISIT
│   ├── What are you excited to experience? *
│   │   ☐ Movement & Training
│   │   ☐ Recovery Therapies
│   │   ☐ Spa Amenities
│   │   ☐ Just exploring the space
│   └── Is there anything we should know? (Optional)
│
├── ENHANCE YOUR EXPERIENCE
│   ├── RECOVERY SERVICES
│   │   ☐ Full Body Red Light — 10 min    $18
│   │   ☐ Full Body Red Light — 20 min    $28
│   │   ☐ ZeroBody Cryo                   $45
│   └── STUDIO CLASSES
│       ☐ Reformer/Cycling Class          $40
│       ☐ Aerobics/Other Class            $30
│
└── [Complete Your Guest Pass — $60+]

RIGHT SIDE (Info):
├── A FEW GENTLE NOTES
│   • Valid for selected date only
│   • Respect quiet energy of spaces
│   • Phones limited in wellness areas
│   • Kids Care is members only
│
└── LOOKING AHEAD
    If today resonates...
    [Learn About Membership →]
```

### Phase 4: User Flow

```text
User visits /guest-pass
        │
        ▼
   Logged in? ───No───► Redirect to /auth?redirect=/guest-pass
        │
       Yes
        ▼
   Liability waiver signed? ───No───► Show prompt to sign at /member/waivers
        │
       Yes
        ▼
   Complete form:
   • Guest information
   • Visit preferences
   • Optional add-ons
        │
        ▼
   Stripe Checkout ($60 + add-ons)
        │
        ▼
   Webhook creates:
   • guest_passes record with all metadata
   • spa_appointments if RLT/Cryo selected (pending booking)
   • class_passes if class add-ons selected
        │
        ▼
   Success page:
   • Visit date & check-in instructions
   • List of purchased add-ons
   • Instructions to book class/recovery (if applicable)
```

### Phase 5: Edge Function Updates

**New action**: `create_guest_pass_experience_checkout`

```typescript
// Collects:
// - Base guest pass ($60)
// - Selected add-ons (RLT, Cryo, Classes)
// - All personalization metadata

// Creates Stripe Checkout with line items:
line_items: [
  { price: GUEST_PASS_PRICE_ID, quantity: 1 },
  // ... add-ons based on selection
]

// Passes metadata for webhook:
metadata: {
  type: 'guest_pass_experience',
  user_id,
  guest_name,
  guest_email,
  phone_number,
  valid_date,
  member_referral,
  visit_interests: JSON.stringify([...]),
  visit_notes,
  add_ons: JSON.stringify([...]),
}
```

### Phase 6: Webhook Handler Updates

New handler for `guest_pass_experience`:
1. Insert into `guest_passes` with all personalization data
2. Set `expires_at` to 11:59 PM of `valid_date`
3. For class add-ons: create `class_passes` records
4. For recovery add-ons: store in `add_ons` jsonb for booking reference

### Phase 7: Admin Portal Enhancements

**Enhanced `/admin/guest-passes`**:
- Add date range filter (not just today)
- Add guest detail sheet/modal on click showing:
  - Guest information (name, email, phone)
  - Visit date and status
  - Member referral
  - Visit interests and notes
  - Purchased add-ons
  - Stripe payment link
- Guest passes are one-time purchases, no saved cards to display

---

## Files to Create/Modify

| File | Action |
|------|--------|
| Database migration | Add columns to `guest_passes` |
| `src/pages/GuestPass.tsx` | **Create** - New public page |
| `src/App.tsx` | Add `/guest-pass` route |
| `src/components/Navigation.tsx` | Add nav link |
| `src/pages/Index.tsx` | Add homepage link |
| `src/lib/stripeProducts.ts` | Add RLT/Cryo price IDs |
| `supabase/functions/stripe-payment/index.ts` | Add new action + price IDs |
| `supabase/functions/stripe-webhook/index.ts` | Handle new type |
| `src/pages/admin/GuestPasses.tsx` | Enhance with filters + detail view |
| `src/components/admin/GuestDetailSheet.tsx` | **Create** - Admin detail view |

---

## Stripe Products to Create

Before implementation, create these in Stripe Dashboard:

| Product Name | Price | Recurring |
|--------------|-------|-----------|
| Full Body Red Light Therapy — 10 min | $18 | No (one-time) |
| Full Body Red Light Therapy — 20 min | $28 | No (one-time) |
| ZeroBody Cryo Session | $45 | No (one-time) |

---

## Important Notes on Guest Cards

**Guests do NOT have persistent accounts or saved cards:**
- Guest purchases happen via Stripe Checkout (one-time)
- Payment info is not saved for future use
- Admin cannot "view saved cards" for guests
- All payment history visible via Stripe Dashboard link

This is intentional — guests are not members and shouldn't have account management overhead.

---

## Waiver Integration

The page will check for `liability_waiver` (required for all guests):
- If not signed → Show gentle prompt with link to `/member/waivers`
- If signed → Show full form

The `guest_pass_agreement_signed` in profiles can be used for optional additional terms.

---

## Success Page Content

```text
YOUR VISIT IS CONFIRMED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Visit Date: [Selected Date]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT'S INCLUDED
• Full gym access
• Recovery suite (sauna, steam, cold plunge)
• Locker room amenities

YOUR ADD-ONS (if any)
• Full Body Red Light Therapy — 10 min
• Reformer Pilates Class

NEXT STEPS
1. Bring photo ID to check in
2. [Book your class] (if class purchased)
3. [Book your recovery session] (if RLT/Cryo purchased)

Questions? Ask at the front desk.
```

---

## Estimated Implementation Time

- **Database migration**: 5 min
- **Stripe product creation**: 10 min (manual)
- **New GuestPass.tsx page**: 30 min
- **Edge function updates**: 20 min
- **Webhook handler updates**: 15 min
- **Admin portal enhancements**: 25 min
- **Testing & refinement**: 15 min

**Total**: ~2 hours
