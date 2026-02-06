

# Permanent Fix: Stripe Publishable Key Reliability

## Root Cause Analysis

The payment forms are failing because of a **fragile configuration chain**:

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     Current Flow (Fragile)                          │
├─────────────────────────────────────────────────────────────────────┤
│  1. Check VITE_STRIPE_PUBLISHABLE_KEY env variable                  │
│     ↓ (not set in .env file)                                        │
│  2. Fallback: Call stripe-config edge function                      │
│     ↓ (function not deployed = 404 error)                           │
│  3. Result: Payment form fails to load                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Why functions aren't deployed automatically:**
- Edge functions in `supabase/functions/` are only deployed when code changes are made to the project
- If the function code exists but was never explicitly deployed (or deployment failed silently), the function won't be available
- The `config.toml` declares the function but doesn't guarantee deployment

---

## Solution: Add Publishable Key to .env

The permanent fix is to add the Stripe publishable key directly to the environment configuration. This eliminates the need for the `stripe-config` edge function fallback entirely.

**Publishable keys are safe to include in frontend code** - they're designed to be public and are used by Stripe.js in the browser.

---

## Implementation

### 1. Add Secret via Lovable Secrets Manager

| Secret Name | Value Source |
|-------------|--------------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | Already exists in backend secrets |

The secret `VITE_STRIPE_PUBLISHABLE_KEY` already exists in the backend (as shown in the secrets list). The issue is that it's not being properly exposed to the frontend build.

### 2. Update StripeProvider for Better Error Handling

Make the error messages more informative and add a retry mechanism:

| File | Change |
|------|--------|
| `src/components/StripeProvider.tsx` | Add better error handling and retry button |

### 3. Ensure stripe-config is Always Deployed

As a backup safety net, ensure the `stripe-config` function is always deployed with the application.

---

## Technical Details

### Changes to StripeProvider.tsx

```typescript
// Add retry capability and clearer error messages
const [retryCount, setRetryCount] = useState(0);

// In the error state, add a retry button
<Button onClick={() => setRetryCount(c => c + 1)}>
  Retry
</Button>

// Also improve logging for debugging
console.log('[StripeProvider] Checking env key...');
console.log('[StripeProvider] Falling back to stripe-config...');
```

### Why This Prevents Future Issues

| Before | After |
|--------|-------|
| Single point of failure (edge function) | Primary source (env var) + fallback (edge function) |
| Silent failures | Clear error messages with retry option |
| No visibility into failures | Console logs for debugging |

---

## Immediate Action Required

The `VITE_STRIPE_PUBLISHABLE_KEY` secret exists but may not be properly configured for frontend access. I'll need to:

1. Verify the secret is properly set
2. Ensure it's exposed to the Vite build process
3. Add retry capability to the StripeProvider for resilience

---

## Files to Modify

| File | Purpose |
|------|---------|
| `src/components/StripeProvider.tsx` | Add retry mechanism, better error handling, and improved logging |

