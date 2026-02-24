

## Fix: Track Class Pass Purchases from Stripe Payment Links

### The Problem

When someone like Yasmin Dabaja buys a class pass through a **Stripe Payment Link** (shared via text, email, or social media), the purchase completes successfully in Stripe -- but **nothing gets recorded in your system**. This is because:

1. Your app's checkout flow embeds metadata (user ID, pass type, category) into every Stripe session
2. Your webhook handler **relies on that metadata** to know what was purchased and who bought it
3. Stripe Payment Links don't carry your custom metadata, so the webhook sees "Unknown checkout type" and skips it entirely

This means: money comes in, but no class pass gets created, and you can't see the purchase in your admin tools.

### The Solution

Add a **fallback handler** in the webhook that catches checkout sessions **without metadata** (or with unrecognized types). When this happens, the system will:

1. Look at the **price ID** from the Stripe line items to identify what was purchased (class pass type, guest pass, etc.)
2. Look up the buyer by their **Stripe customer email** in the `non_member_profiles` or `members` tables
3. If a matching user is found, create the class pass record automatically
4. If no user is found, create a **pending purchase record** so you can see the transaction in admin and manually link it later

### Technical Details

**File: `supabase/functions/stripe-webhook/index.ts`**

Update the `else` block at line 999 (currently just logging "Unknown checkout type") to:

1. Retrieve the session's line items from Stripe using `stripe.checkout.sessions.listLineItems(session.id)`
2. Match the price IDs against the known `STRIPE_PRODUCTS` map to determine what was purchased
3. Look up the customer email from `session.customer_details?.email` or by retrieving the Stripe customer
4. Search for a matching user in `members` (by email) or `non_member_profiles` (by email)
5. If a class pass price is identified:
   - Create a `class_passes` record with the matched user_id (or null if no match)
   - Log the purchase for admin visibility
6. If no price match is found, log the full session details for manual review

**New helper**: Add a `reverseMapPriceId()` function that maps a Stripe price ID back to a category and pass type using the existing `STRIPE_PRODUCTS` constant already defined in the webhook file.

**File: `supabase/functions/stripe-payment/index.ts`**

No changes needed -- the existing `admin_import_stripe_class_passes` action already handles manual reconciliation for historical purchases.

### What This Fixes

- Purchases via Stripe Payment Links will automatically create class pass records
- The buyer will be matched to their account by email when possible
- Unmatched purchases will still be logged so nothing falls through the cracks
- No changes to the existing in-app purchase flow (which already works correctly)
