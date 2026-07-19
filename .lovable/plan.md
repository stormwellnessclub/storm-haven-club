## Problem
The `EventAnnouncementBanner` on the member/portal dashboards has a "Buy Sound Bath Tickets" button that just links out to `/events/:slug#tickets`. From inside the portal it feels broken — members expect to buy in place, prefilled with their info.

## Fix

### 1. Inline purchase dialog in the banner
Update `src/components/events/EventAnnouncementBanner.tsx`:
- Replace the current `<Link>` button with a **"Buy Tickets"** button that opens a shadcn `Dialog`.
- Dialog contents:
  - Event title, date/time (ET), venue.
  - Read-only summary of ticket price (uses `member_price_cents` as the displayed rate for logged-in members; server still re-verifies).
  - Prefilled fields from the current session:
    - Pull `first_name`, `last_name`, `email`, `phone` from `profiles` (fallback to `auth.users.email`).
  - Editable **Quantity** (1–min(6, remaining)).
  - Primary action **"Continue to secure checkout"** calls `supabase.functions.invoke("create-event-ticket-checkout", { body: { slug, first_name, last_name, email, phone, quantity } })` and does `window.location.href = data.url`.
  - Cancel button closes the dialog.
- Keep the secondary **"More info"** link → `/events/:slug` unchanged.
- Success return path is already correct: the edge function redirects authenticated buyers to `/portal/my-tickets?session_id=…&just_purchased=1`.

### 2. Loading + error states
- Disable the submit button while the invoke is in flight; show "Redirecting…".
- Toast on error via `sonner`.

### 3. No changes needed to
- `create-event-ticket-checkout` (already accepts these params and applies member pricing server-side).
- `/portal/my-tickets` confirmation flow (already handled last turn).
- Public `/events/:slug` page (still the destination for "More info" and for guests).

## Technical notes
- Profile fetch uses `supabase.from("profiles").select("first_name, last_name, email, phone").eq("id", user.id).maybeSingle()` inside a `useQuery` gated on `user?.id`. If no profile row, fall back to `user.email` and blank names — the form remains editable so the buyer can complete missing fields before checkout.
- Preserve existing banner styling and the "seats left / sold out" pill.
- No schema, RLS, or edge function changes.

## Out of scope
- Building a Stripe Elements card form inside the dialog (still uses hosted Checkout).
- Non-portal surfaces (`/events`, homepage) — the button there already works and stays as-is.