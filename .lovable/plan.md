

# Complete Implementation Plan (With Email Branding Fix)

## Summary

This plan addresses all outstanding issues plus the email branding fix you just mentioned:

| Issue | Priority |
|-------|----------|
| Email templates use wrong colors (blue/yellow instead of brand) | HIGH |
| Logo too small and poor contrast on dark header | HIGH |
| Admin sees only 1 card (not all Stripe cards) | HIGH |
| Onboarding checklist missing detailed setup steps in email | HIGH |
| Missing founding tier options | MEDIUM |
| No "View as Member" for admins | MEDIUM |
| No default card guidance for members | LOW |

---

## Phase 1: Fix Email Template Branding

**File:** `supabase/functions/send-email/index.ts`

### Current Problems:
- Using Tailwind default colors: `#fef3c7` (yellow), `#f59e0b` (amber), `#e0f2fe` (blue)
- Logo height only 60px - too small
- Dark header (`#312D28`) makes the black logo hard to see

### Brand Colors to Use:
```
Smoked Umber (Primary):  #1C170F
Limestone Haze (Cream):  #DEDACE  
Still Sand (Secondary):  #C1B19C
Golden Dune (Accent):    #F0DFC4
Clay Veil (Muted):       #88766B
Earth Smoke:             #6C5D3E
Gold Accent:             #B8A068 (refined)
```

### Changes:

**1. Update `emailStyles` object (lines 17-28):**
```typescript
const emailStyles = {
  container: 'font-family: Georgia, "Times New Roman", Times, serif; max-width: 600px; margin: 0 auto; padding: 0;',
  header: 'background: #DEDACE; padding: 40px 30px; text-align: center;', // Limestone Haze - LIGHT background for logo visibility
  content: 'background: #ffffff; padding: 30px; border-left: 1px solid #C1B19C; border-right: 1px solid #C1B19C;',
  footer: 'background: #1C170F; padding: 25px; text-align: center; color: #DEDACE;', // Smoked Umber footer
  button: 'display: inline-block; background: #1C170F; color: #DEDACE; padding: 14px 32px; text-decoration: none; border-radius: 4px; font-weight: 600; font-family: Georgia, serif; letter-spacing: 0.5px;', // Dark button
  buttonSecondary: 'display: inline-block; background: #C1B19C; color: #1C170F; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 500; font-family: Georgia, serif;',
  link: 'color: #6C5D3E; text-decoration: underline;', // Earth Smoke links
  muted: 'color: #88766B; font-size: 14px; font-family: Georgia, serif;', // Clay Veil
  heading: 'color: #1C170F; margin-top: 0; font-family: Georgia, serif; font-weight: 500;',
  // Brand accent boxes
  infoBox: 'background: #F0DFC4; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 25px 0;', // Golden Dune
  warningBox: 'background: #F0DFC4; border: 2px solid #B8A068; border-radius: 8px; padding: 20px; margin: 25px 0;',
  successBox: 'background: #DEDACE; border: 1px solid #C1B19C; border-radius: 8px; padding: 20px; margin: 20px 0;',
};
```

**2. Update `getEmailHeader()` (lines 30-34):**
```typescript
const getEmailHeader = () => `
  <div style="${emailStyles.header}">
    <img src="${BASE_URL}/storm-logo-gold.png" alt="Storm Wellness Club" height="80" style="display: block; margin: 0 auto;" />
  </div>
  <div style="height: 4px; background: linear-gradient(90deg, #B8A068, #C1B19C, #B8A068);"></div>
`;
```

Key changes:
- **Light cream header** (`#DEDACE`) so the gold logo is visible
- **Larger logo** (80px instead of 60px)
- **Gold gradient accent line** below header for elegance

**3. Update `getEmailFooter()` (lines 36-48):**
```typescript
const getEmailFooter = () => `
  <div style="height: 1px; background: #C1B19C;"></div>
  <div style="${emailStyles.footer}">
    <p style="color: #B8A068; font-size: 14px; margin: 0 0 15px 0; font-family: Georgia, serif;">
      Have questions? Visit your member portal
    </p>
    <p style="margin: 0 0 15px 0;">
      <a href="${BASE_URL}/member/support" style="color: #DEDACE; text-decoration: none; margin: 0 10px;">Contact Support</a> · 
      <a href="${BASE_URL}/member/bookings" style="color: #DEDACE; text-decoration: none; margin: 0 10px;">Manage Bookings</a>
    </p>
    <p style="color: #88766B; font-size: 12px; margin: 15px 0 0 0; font-family: Georgia, serif;">
      Storm Wellness Club · <a href="${BASE_URL}" style="color: #88766B;">stormwellnessclub.com</a>
    </p>
  </div>
`;
```

**4. Replace all info/warning boxes throughout the file:**

Replace these colors:
- `#fef3c7` → `#F0DFC4` (Golden Dune)
- `#f59e0b` → `#B8A068` (Brand Gold)
- `#92400e` → `#6C5D3E` (Earth Smoke)
- `#e0f2fe` (blue info box) → `#DEDACE` (Limestone Haze)
- `#0284c7` (blue border) → `#C1B19C` (Still Sand)
- `#0369a1` (blue text) → `#1C170F` (Smoked Umber)
- `#ecfdf5` (green success) → `#DEDACE` (Limestone Haze)
- `#10b981` (green border) → `#88766B` (Clay Veil)
- `#065f46` (green text) → `#1C170F` (Smoked Umber)

---

## Phase 2: Debug Admin Payment Methods Display

**File:** `src/hooks/useAdminMemberPaymentMethods.ts`

Add debugging to understand why only 1 card shows:

```typescript
queryFn: async () => {
  console.log("[useAdminMemberPaymentMethods] Fetching for member:", memberId);
  
  // First check if member has stripe_customer_id
  const { data: memberData } = await supabase
    .from("members")
    .select("stripe_customer_id")
    .eq("id", memberId)
    .single();
  
  console.log("[useAdminMemberPaymentMethods] Member stripe_customer_id:", memberData?.stripe_customer_id);
  
  if (!memberData?.stripe_customer_id) {
    console.log("[useAdminMemberPaymentMethods] No Stripe customer ID found");
    return { paymentMethods: [] };
  }
  
  const { data, error } = await supabase.functions.invoke("stripe-payment", {
    body: { 
      action: "admin_list_member_payment_methods", 
      memberId,
      stripeCustomerId: memberData.stripe_customer_id  // Pass directly
    },
  });
  
  console.log("[useAdminMemberPaymentMethods] Response:", data, "Error:", error);
  return data;
}
```

**File:** `supabase/functions/stripe-payment/index.ts`

Verify the `admin_list_member_payment_methods` action returns ALL cards:

```typescript
case "admin_list_member_payment_methods": {
  const { memberId, stripeCustomerId } = body;
  
  let customerId = stripeCustomerId;
  if (!customerId) {
    const { data: member } = await supabaseAdmin
      .from("members")
      .select("stripe_customer_id")
      .eq("id", memberId)
      .single();
    customerId = member?.stripe_customer_id;
  }
  
  if (!customerId) {
    return jsonResponse({ paymentMethods: [], error: "No Stripe customer" });
  }
  
  // Get ALL payment methods
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
  });
  
  // Get default payment method
  const customer = await stripe.customers.retrieve(customerId);
  const defaultPmId = customer.invoice_settings?.default_payment_method;
  
  console.log(`[admin_list_member_payment_methods] Found ${paymentMethods.data.length} cards for ${customerId}`);
  
  return jsonResponse({
    paymentMethods: paymentMethods.data.map(pm => ({
      id: pm.id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
      isDefault: pm.id === defaultPmId,
    })),
  });
}
```

---

## Phase 3: Enhanced Setup Email with Full Instructions

**File:** `supabase/functions/send-email/index.ts`

Update `setup_instructions` / `member_activation_setup` / `phase_one_setup` templates:

```html
<div style="background: #F0DFC4; border: 1px solid #C1B19C; border-radius: 8px; padding: 25px; margin: 25px 0;">
  <h3 style="margin: 0 0 15px 0; color: #1C170F; font-family: Georgia, serif; font-weight: 600;">
    Complete Your Membership Setup:
  </h3>
  <ol style="color: #1C170F; line-height: 2.2; margin: 0; padding-left: 20px; font-family: Georgia, serif;">
    <li><strong>Sign in or create your account</strong> using this email: <code style="background: #DEDACE; padding: 2px 6px; border-radius: 3px;">${data.email || to}</code></li>
    <li>Go to the <strong>Waivers</strong> tab and sign any required waivers</li>
    <li>Sign your <strong>Membership Agreement</strong> (also in the Waivers tab)</li>
    <li>Add a <strong>Payment Method</strong> for monthly dues and mark one as default</li>
    <li>Review your setup checklist in the <strong>My Membership</strong> tab</li>
  </ol>
</div>

<div style="background: #DEDACE; border: 1px solid #C1B19C; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0; font-size: 14px; color: #1C170F; font-family: Georgia, serif;">
    <strong>💳 Important:</strong> When adding payment methods, please indicate which card 
    you'd like us to use for your membership dues by setting it as your <em>default</em>.
  </p>
</div>

<div style="background: #DEDACE; border: 1px solid #88766B; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0 0 10px 0; font-size: 14px; color: #1C170F; font-family: Georgia, serif;">
    <strong>One-Time Courtesy:</strong> If you'd like to change your membership tier, 
    you may do so once from the My Membership page before activation.
  </p>
  <p style="margin: 0; font-size: 14px; color: #6C5D3E; font-family: Georgia, serif;">
    Founding members can also opt-in or out of founding status if needed.
  </p>
</div>
```

---

## Phase 4: Add Founding Tier Options

**File:** `src/components/member/TierChangeCard.tsx`

Add founding tier visibility and opt-in/opt-out options:

```typescript
// Extended tier options
const TIER_OPTIONS = [
  { value: "silver", label: "Silver", monthlyPrice: 129 },
  { value: "gold", label: "Gold", monthlyPrice: 189 },
  { value: "platinum", label: "Platinum", monthlyPrice: 249 },
  { value: "diamond", label: "Diamond", monthlyPrice: 349 },
  // Founding versions (annual prepaid)
  { value: "founding-silver", label: "Founding Silver", annualPrice: 1299, isFounding: true },
  { value: "founding-gold", label: "Founding Gold", annualPrice: 1899, isFounding: true },
  { value: "founding-platinum", label: "Founding Platinum", annualPrice: 2499, isFounding: true },
  { value: "founding-diamond", label: "Founding Diamond", annualPrice: 3499, isFounding: true },
];

// Show founding toggle
{isFoundingMember ? (
  <Alert className="mb-4 border-accent/30 bg-accent/5">
    <Crown className="h-4 w-4 text-accent" />
    <AlertDescription>
      <strong>You're a Founding Member</strong>
      <p className="text-sm text-muted-foreground mt-1">
        Your founding rate is locked in with annual billing. 
        If you need to switch to monthly billing, please contact us.
      </p>
    </AlertDescription>
  </Alert>
) : (
  <Alert className="mb-4">
    <Info className="h-4 w-4" />
    <AlertDescription>
      <strong>Become a Founding Member?</strong>
      <p className="text-sm text-muted-foreground mt-1">
        Lock in special founding rates with annual prepaid billing. 
        Contact us for details.
      </p>
    </AlertDescription>
  </Alert>
)}
```

---

## Phase 5: Add Default Card Guidance

**File:** `src/pages/member/PaymentMethods.tsx`

Add explanation about default card:

```typescript
<Alert className="mb-6 border-accent/30">
  <CreditCard className="h-4 w-4" />
  <AlertDescription>
    <strong>Your default card will be used for membership dues.</strong>
    <p className="text-sm text-muted-foreground mt-1">
      Click the star icon on any card to set it as your default payment method.
    </p>
  </AlertDescription>
</Alert>
```

---

## Phase 6: Admin "View Member Portal" Feature

**File:** `src/components/admin/MemberDetailSheet.tsx`

Add button to view member's portal:

```typescript
<Button 
  variant="outline" 
  size="sm"
  onClick={() => window.open(`/member/membership?admin_view=${member.id}`, '_blank')}
>
  <Eye className="mr-2 h-4 w-4" />
  View Member Portal
</Button>
```

**File:** `src/pages/member/Membership.tsx`

Support `admin_view` query parameter to load different member's data:

```typescript
const [searchParams] = useSearchParams();
const adminViewMemberId = searchParams.get('admin_view');
const { isAdmin } = useUserRoles();

// If admin is viewing another member
const effectiveMemberId = (isAdmin && adminViewMemberId) ? adminViewMemberId : membership?.id;

// Show admin banner
{isAdmin && adminViewMemberId && (
  <Alert className="mb-4 border-destructive bg-destructive/5">
    <Shield className="h-4 w-4" />
    <AlertDescription>
      <strong>Admin View Mode</strong> - Viewing as member (read-only)
    </AlertDescription>
  </Alert>
)}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/send-email/index.ts` | Update all colors to brand palette, larger logo, light header |
| `src/hooks/useAdminMemberPaymentMethods.ts` | Add debugging, pass stripe_customer_id |
| `supabase/functions/stripe-payment/index.ts` | Verify admin_list_member_payment_methods returns all cards |
| `src/components/member/TierChangeCard.tsx` | Add founding tiers, opt-in/opt-out info |
| `src/pages/member/PaymentMethods.tsx` | Add default card guidance |
| `src/components/admin/MemberDetailSheet.tsx` | Add "View Member Portal" button |
| `src/pages/member/Membership.tsx` | Support admin_view query param |

---

## Email Visual Preview (After Changes)

```text
┌─────────────────────────────────────────┐
│   [Limestone Haze Cream Background]     │
│                                         │
│         ⚜ STORM WELLNESS CLUB ⚜         │  ← 80px gold logo on light bg
│                                         │
├═════════════════════════════════════════┤  ← Gold gradient accent line
│                                         │
│   Dear [Name],                          │
│                                         │
│   [Content with Georgia serif font]     │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │  Golden Dune info box (#F0DFC4) │   │  ← Brand color, not yellow
│   │  with Earth Smoke text          │   │
│   └─────────────────────────────────┘   │
│                                         │
│        [ DARK CHARCOAL BUTTON ]         │  ← #1C170F with cream text
│                                         │
│   Warmly,                               │
│   Storm Wellness Club                   │
│                                         │
├─────────────────────────────────────────┤
│   [Smoked Umber Dark Footer #1C170F]    │
│   Gold accent links                     │
│   stormwellnessclub.com                 │
└─────────────────────────────────────────┘
```

---

## Testing Checklist

**Email Branding:**
- [ ] Send test email, verify cream header (not dark brown)
- [ ] Verify logo is larger and clearly visible
- [ ] Verify info boxes use Golden Dune (#F0DFC4), not yellow
- [ ] Verify no blue colors anywhere
- [ ] Verify footer is dark with gold/cream text

**Admin Card Display:**
- [ ] Check console logs for debug output
- [ ] Verify all 3 cards appear for test member
- [ ] Refresh button works

**Setup Email:**
- [ ] Instructions mention creating account
- [ ] Waivers tab mentioned
- [ ] Default card note included
- [ ] Founding member info included

**Tier Change:**
- [ ] Founding tiers visible
- [ ] Opt-in/opt-out info shown

