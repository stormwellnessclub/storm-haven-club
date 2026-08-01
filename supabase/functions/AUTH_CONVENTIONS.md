# Edge function authentication conventions

Functions deploy with `verify_jwt = false` (platform default), so **every function must
enforce its own auth in code**. Never rely on the platform to reject anonymous callers.

## Pick one of these, always

| Caller type | Use |
| --- | --- |
| Staff-only admin/ops endpoints | `import { requireStaff } from "../_shared/requireStaff.ts"` |
| Cron / internal maintenance jobs | `import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts"` |
| Signed-in member endpoints | `supabase.auth.getClaims(token)` / `getUser(token)` and scope every query by `sub` |
| Third-party webhooks (Stripe, Twilio, Resend) | Verify the provider signature before any side effect |
| Truly public endpoints | Document why here, validate all input, return no private data |

## Required shape

```ts
const auth = await requireStaff(req);            // or requireTrustedCaller(req)
if (!auth.ok) return auth.response;              // 401/403 with CORS headers
```

## Non-negotiables

- Validate every request body/query param (shape, length, allowed values) before use.
- Never trust client-supplied role, member_id, or price data — resolve server-side.
- Return generic error messages to clients; keep detail in `console.error`.
- Include CORS headers on **all** responses, including errors.

Any new function that does not fall into a row above should not be merged.
