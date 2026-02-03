

# Annual Fee Payment Link Feature

## Summary
Create an admin feature to generate personalized Stripe Checkout payment links for the initiation/annual fee. When applicants whose cards were declined complete the payment via the link, the system will **automatically update** their application status without manual intervention.

## How It Works

### Admin Workflow
1. Admin navigates to **Applications** page
2. Finds applicant with failed/pending annual fee status
3. Clicks **"Generate Payment Link"** from the dropdown menu
4. System creates a personalized Stripe Checkout link
5. Admin copies the link (or it opens a dialog with copy option)
6. Admin emails the link to the applicant manually
7. Applicant clicks link → lands on Stripe Checkout → pays
8. **Webhook automatically updates** `membership_applications.annual_fee_status` to `paid`

### Applicant Experience
- Receives email with payment link from admin
- Clicks link → Stripe hosted checkout page (no account required)
- Email is pre-filled, applicant enters card details
- Completes payment
- Redirected to a simple success page
- Application status updated automatically

---

## Technical Implementation

### 1. Edge Function: `stripe-payment/index.ts`

Add new action: `create_annual_fee_payment_link`

**Parameters:**
- `applicationId` (required): UUID of the membership application
- `gender` (required): To determine price (women: $300, men: $175)

**Logic:**
```text
1. Verify admin role (requires authorization)
2. Fetch application details from database (email, name)
3. Get or create Stripe customer for the applicant
4. Create Stripe Checkout Session with:
   - mode: 'payment' (one-time charge, not subscription)
   - customer pre-filled
   - Annual fee price ID based on gender
   - success_url: /payment-success?type=annual_fee
   - cancel_url: /
   - metadata:
     - type: 'annual_fee_payment_link'
     - application_id: applicationId
     - source: 'admin_generated_link'
5. Return checkout URL to admin
```

### 2. Webhook: `stripe-webhook/index.ts`

Add handler for `annual_fee_payment_link` type in `checkout.session.completed`:

```text
When session.metadata.type === 'annual_fee_payment_link':
1. Extract application_id from metadata
2. Update membership_applications:
   - annual_fee_status = 'paid'
   - stripe_customer_id = session.customer (if not set)
3. Log payment in payment_attempts table
4. Return success
```

### 3. UI: `Applications.tsx`

Add dropdown menu item: **"Generate Payment Link"**

```text
- Only show for applications where:
  - annual_fee_status !== 'paid'
  - Application status is 'pending' or 'approved'
- On click:
  1. Call stripe-payment with action: 'create_annual_fee_payment_link'
  2. Show dialog with:
     - Copyable URL
     - "Copy Link" button
     - Amount: $300 (women) or $175 (men)
     - Applicant name/email for reference
  3. Success toast when copied
```

### 4. Success Page (Optional Enhancement)

Create or update `/payment-success` to handle `?type=annual_fee`:
- Display: "Payment Complete! Your initiation fee has been received."
- No login required
- Simple thank you message

---

## Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/stripe-payment/index.ts` | Modify | Add `create_annual_fee_payment_link` action |
| `supabase/functions/stripe-webhook/index.ts` | Modify | Handle `annual_fee_payment_link` checkout type |
| `src/pages/admin/Applications.tsx` | Modify | Add UI button and dialog for generating links |

---

## Implementation Details

### Edge Function Addition

```typescript
// In stripe-payment/index.ts action switch

case 'create_annual_fee_payment_link': {
  const { applicationId, gender } = body;
  
  if (!applicationId || !gender) {
    throw new Error("Missing applicationId or gender");
  }
  
  // Verify admin role
  const { data: roleData } = await supabase
    .from('staff_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  
  if (!roleData?.role) {
    throw new Error("Unauthorized: Admin access required");
  }
  
  // Fetch application
  const { data: application, error: appError } = await supabase
    .from('membership_applications')
    .select('id, email, full_name, first_name, last_name')
    .eq('id', applicationId)
    .single();
  
  if (appError || !application) {
    throw new Error("Application not found");
  }
  
  // Get or create Stripe customer
  const applicantEmail = application.email;
  const applicantName = application.full_name || 
    `${application.first_name} ${application.last_name}`;
  
  const customers = await stripe.customers.list({ 
    email: applicantEmail, 
    limit: 1 
  });
  
  let customerId: string;
  if (customers.data.length > 0) {
    customerId = customers.data[0].id;
  } else {
    const customer = await stripe.customers.create({
      email: applicantEmail,
      name: applicantName,
      metadata: { source: 'annual_fee_payment_link', application_id: applicationId }
    });
    customerId = customer.id;
  }
  
  // Get annual fee price ID
  const normalizedGender = (gender.toLowerCase() === 'male' || 
    gender.toLowerCase() === 'men') ? 'men' : 'women';
  const priceId = STRIPE_PRODUCTS.annualFee[normalizedGender];
  
  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'payment',
    success_url: `${successUrl || 'https://storm-haven-club.lovable.app'}/payment-success?type=annual_fee`,
    cancel_url: `${cancelUrl || 'https://storm-haven-club.lovable.app'}/`,
    metadata: {
      type: 'annual_fee_payment_link',
      application_id: applicationId,
      source: 'admin_generated_link',
    },
  });
  
  // Update application with Stripe customer ID
  await supabase
    .from('membership_applications')
    .update({ stripe_customer_id: customerId })
    .eq('id', applicationId);
  
  return new Response(
    JSON.stringify({ url: session.url, applicationId }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}
```

### Webhook Handler Addition

```typescript
// In stripe-webhook/index.ts, inside checkout.session.completed handler

} else if (metadata.type === 'annual_fee_payment_link') {
  // Handle admin-generated annual fee payment link
  const applicationId = metadata.application_id;
  
  if (!applicationId) {
    logError("Missing application_id in annual fee payment link metadata", "ANNUAL_FEE_LINK");
    return errorResponse(new Error("Missing application_id"), "ANNUAL_FEE_LINK");
  }
  
  try {
    // Update application with paid status and customer ID
    const { error: updateError } = await supabase
      .from('membership_applications')
      .update({
        annual_fee_status: 'paid',
        stripe_customer_id: session.customer as string,
      })
      .eq('id', applicationId);
    
    if (updateError) {
      logError(updateError, "ANNUAL_FEE_LINK_UPDATE");
      return errorResponse(updateError, "ANNUAL_FEE_LINK_UPDATE");
    }
    
    // Sync card details to application
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        session.payment_intent as string
      );
      if (paymentIntent.payment_method) {
        const pm = await stripe.paymentMethods.retrieve(
          paymentIntent.payment_method as string
        );
        if (pm.card) {
          await supabase
            .from('membership_applications')
            .update({
              card_brand: pm.card.brand,
              card_last4: pm.card.last4,
              card_exp_month: pm.card.exp_month,
              card_exp_year: pm.card.exp_year,
            })
            .eq('id', applicationId);
        }
      }
    } catch (cardError) {
      logError(cardError, "ANNUAL_FEE_LINK_CARD_SYNC");
      // Don't fail webhook for card sync issues
    }
    
    logStep("Annual fee payment link processed", { applicationId });
  } catch (annualFeeError) {
    logError(annualFeeError, "ANNUAL_FEE_LINK");
    return errorResponse(annualFeeError, "ANNUAL_FEE_LINK");
  }
}
```

### UI Component Updates

Add state and dialog for payment link:

```typescript
// New state
const [showPaymentLinkDialog, setShowPaymentLinkDialog] = useState(false);
const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
const [paymentLinkTarget, setPaymentLinkTarget] = useState<Application | null>(null);
const [isGeneratingLink, setIsGeneratingLink] = useState(false);

// Handler function
const handleGeneratePaymentLink = async (app: Application) => {
  setIsGeneratingLink(true);
  setPaymentLinkTarget(app);
  
  try {
    const { data, error } = await supabase.functions.invoke("stripe-payment", {
      body: {
        action: "create_annual_fee_payment_link",
        applicationId: app.id,
        gender: app.gender || "women",
        successUrl: window.location.origin + "/payment-success",
        cancelUrl: window.location.origin,
      },
    });
    
    if (error) throw error;
    
    setPaymentLinkUrl(data.url);
    setShowPaymentLinkDialog(true);
  } catch (err: any) {
    toast.error(err.message || "Failed to generate payment link");
  } finally {
    setIsGeneratingLink(false);
  }
};

// Dropdown menu item
<DropdownMenuItem 
  onClick={() => handleGeneratePaymentLink(app)}
  disabled={app.annual_fee_status === 'paid' || isGeneratingLink}
>
  <Link2 className="h-4 w-4 mr-2" />
  Generate Payment Link
</DropdownMenuItem>
```

---

## Security Considerations

- **Admin Only**: Requires authenticated admin user
- **Webhook Verification**: Uses Stripe signature verification
- **Idempotency**: Existing webhook idempotency protects against duplicate processing
- **No Account Required**: Applicant can pay without creating a website account

---

## Notes

- This uses `mode: 'payment'` for a one-time charge (not recurring subscription)
- The annual fee is currently set up as a recurring subscription price in Stripe, but Checkout can use it for one-time payments
- If you later want the annual fee to auto-renew yearly, we can adjust to `mode: 'subscription'`
- The link expires based on Stripe's default (24 hours) but can be regenerated anytime

