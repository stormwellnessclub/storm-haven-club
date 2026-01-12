# Payment and Agreement Errors - Fix Instructions

## Issues Found

1. **Payment Error**: "Payment system is not configured. Please contact support."
2. **404 Error**: Membership Agreement PDF not loading

---

## Issue 1: Payment System Not Configured

### Problem
The `VITE_STRIPE_PUBLISHABLE_KEY` environment variable is missing in Lovable.

### Solution

**In Lovable Dashboard:**

1. Go to your project settings
2. Navigate to **Environment Variables** or **Secrets**
3. Add the following variable:
   - **Name:** `VITE_STRIPE_PUBLISHABLE_KEY`
   - **Value:** Your Stripe Publishable Key (starts with `pk_`)
   - **Environment:** Production (and Development if needed)

4. **Get your Stripe Publishable Key:**
   - Go to: https://dashboard.stripe.com/apikeys
   - Copy the **Publishable key** (starts with `pk_test_` for test mode or `pk_live_` for live mode)
   - Paste it as the value

5. **Redeploy** your application after adding the variable

### Verification
After adding the key and redeploying:
- The payment form should load without errors
- You should see the Stripe payment form instead of the error message

---

## Issue 2: Membership Agreement 404 Error

### Problem
The membership agreement PDF is returning a 404 error. This can happen if:
- The agreement PDF URL in the database is incorrect
- The PDF file doesn't exist in the expected location
- The agreement hasn't been uploaded to Supabase Storage

### Solution

**Option A: Check Agreement in Database**

1. Go to Supabase Dashboard → SQL Editor
2. Run this query to check the agreement:
```sql
SELECT id, title, pdf_url, is_active 
FROM agreements 
WHERE agreement_type = 'membership_agreement' 
AND is_active = true;
```

3. Verify the `pdf_url` is correct:
   - Should be `'membership-agreement.pdf'` for local files
   - OR a full Supabase Storage URL like `'https://[project].supabase.co/storage/v1/object/public/agreements/membership-agreement.pdf'`

**Option B: Upload Agreement to Supabase Storage**

1. Go to Supabase Dashboard → Storage
2. Create a bucket called `agreements` (if it doesn't exist)
3. Make it **public**
4. Upload `membership-agreement.pdf` to the bucket
5. Copy the public URL
6. Update the agreement in the database:

```sql
UPDATE agreements 
SET pdf_url = 'https://[your-project].supabase.co/storage/v1/object/public/agreements/membership-agreement.pdf'
WHERE agreement_type = 'membership_agreement' 
AND is_active = true;
```

**Option C: Use Admin Interface**

1. Go to `/admin/agreements` in your app
2. Find the "Membership Agreement" entry
3. Click "Edit"
4. Upload the PDF file or update the URL
5. Save

---

## Testing After Fix

1. **Payment Form:**
   - Go to `/apply`
   - Navigate to the payment section
   - Should see Stripe payment form (not error message)

2. **Membership Agreement:**
   - Go to `/apply`
   - Navigate to Membership Agreement section
   - PDF should load (not 404 error)

---

## Additional Notes

- **Stripe Keys:** Make sure you're using the correct Stripe keys (test vs live)
- **Agreement PDFs:** All agreement PDFs should be accessible either:
  - As imported assets (for local files)
  - As public URLs in Supabase Storage (for uploaded files)
- **Environment Variables:** Changes to environment variables require a redeploy to take effect

---

## Support

If issues persist after following these steps:
1. Check browser console for specific error messages
2. Verify Stripe key is correct in Stripe Dashboard
3. Check Supabase logs for any errors
4. Verify agreement PDF exists and is accessible
