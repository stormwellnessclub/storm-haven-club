
# Fix: Admin Card Saving for Applications

## Problem Summary
When adding a card for an applicant in the Admin → Applications page, the card saves successfully in Stripe but the card metadata (brand, last 4 digits, expiry) is **not being stored** in the database. This makes it appear as though the card wasn't saved.

## Root Cause
The `AdminAddCardForm` component on the Applications page is rendered **without passing the required props**:

```tsx
// Current (broken):
<AdminAddCardForm 
  onSuccess={handleCardSaved}
  onCancel={() => { ... }}
/>

// Required:
<AdminAddCardForm 
  onSuccess={handleCardSaved}
  onCancel={() => { ... }}
  applicationId={chargeTarget.id}
  stripeCustomerId={chargeTarget.stripe_customer_id || addCardCustomerId}
/>
```

Without `applicationId` and `stripeCustomerId`, the form cannot:
1. Update the application record with card details
2. Sync card metadata to the database

## Solution

### Step 1: Track the Created Customer ID
When creating a setup intent, the edge function may create a new Stripe customer. We need to store this customer ID so we can pass it to the form.

**Add state variable:**
```typescript
const [addCardCustomerId, setAddCardCustomerId] = useState<string | null>(null);
```

**Update `handleAddCard`:**
Store the customer ID returned from the setup intent creation:
```typescript
setAddCardCustomerId(data.customerId);
```

### Step 2: Pass Required Props to AdminAddCardForm
Update the form rendering to include all necessary props:

```tsx
<AdminAddCardForm 
  onSuccess={handleCardSaved}
  onCancel={() => { 
    setShowAddCardForm(false); 
    setAddCardClientSecret(null);
    setAddCardCustomerId(null);  // Reset on cancel
  }}
  applicationId={chargeTarget?.id}
  stripeCustomerId={chargeTarget?.stripe_customer_id || addCardCustomerId || undefined}
/>
```

### Step 3: Update handleCardSaved to Persist Card Metadata
After refreshing card details from Stripe, also update the application record:

```typescript
const handleCardSaved = async () => {
  setShowAddCardForm(false);
  setAddCardClientSecret(null);
  setAddCardCustomerId(null);
  
  if (chargeTarget?.stripe_customer_id || addCardCustomerId) {
    const customerId = chargeTarget?.stripe_customer_id || addCardCustomerId;
    setIsLoadingCard(true);
    try {
      const { data } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "list_application_payment_methods",
          stripeCustomerId: customerId,
        },
      });
      
      if (data?.paymentMethods?.length > 0) {
        const card = data.paymentMethods[0];
        setCardDetails({ ... });
        
        // Also update the application record
        await supabase
          .from("membership_applications")
          .update({
            card_brand: card.brand,
            card_last4: card.last4,
            card_exp_month: card.expMonth,
            card_exp_year: card.expYear,
            payment_info_provided: true,
          })
          .eq("id", chargeTarget.id);
      }
    } catch (err) { ... }
  }
  
  queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
};
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/admin/Applications.tsx` | Add `addCardCustomerId` state, pass props to `AdminAddCardForm`, update `handleCardSaved` to persist card metadata |

## Technical Details

### State Addition
```typescript
const [addCardCustomerId, setAddCardCustomerId] = useState<string | null>(null);
```

### handleAddCard Update (around line 932)
```typescript
setAddCardClientSecret(data.clientSecret);
setAddCardCustomerId(data.customerId);  // <-- Add this line
setShowAddCardForm(true);
```

### AdminAddCardForm Props Update (around line 2263)
```tsx
<AdminAddCardForm 
  onSuccess={handleCardSaved}
  onCancel={() => { 
    setShowAddCardForm(false); 
    setAddCardClientSecret(null); 
    setAddCardCustomerId(null);
  }}
  applicationId={chargeTarget?.id}
  stripeCustomerId={chargeTarget?.stripe_customer_id || addCardCustomerId || undefined}
/>
```

## Expected Outcome
After these changes:
1. Card saves in Stripe ✓ (already working)
2. Application record updated with `card_brand`, `card_last4`, `card_exp_month`, `card_exp_year` ✓
3. `payment_info_provided` set to `true` ✓
4. Card details visible in admin UI immediately after saving ✓
