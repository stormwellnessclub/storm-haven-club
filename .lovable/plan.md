

# Fix Sales Tax Report — Edge Function Crash

## Problem
The `stripe-sales-tax` edge function crashes on every call with `Deno.core.runMicrotasks() is not supported in this environment`. The report never loads.

## Root Cause
The function uses outdated dependency versions with an incompatible Deno target flag:
- `stripe@14.21.0?target=deno` — the `?target=deno` flag triggers broken Node.js polyfills
- `std@0.168.0` and `supabase-js@2.39.3` — also outdated

All other working edge functions use `stripe@18.5.0`, `std@0.190.0`, and `supabase-js@2.57.2`.

## Fix
Update the three imports in `supabase/functions/stripe-sales-tax/index.ts` to match the working functions:

```
- import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
- import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
- import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
+ import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
+ import Stripe from "https://esm.sh/stripe@18.5.0";
+ import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
```

Then redeploy the function. No other code changes needed — the Stripe API calls are compatible across versions.

