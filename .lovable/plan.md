## Three issues, one fix

### 1. "Wants Tour" labels on every new application

The applicant form no longer asks the tour question, but the admin UI still defaults to showing "Wants Tour" whenever the (now-deprecated) `skip_tour_activate_immediately` column is `false` — which it is for every new submission. That's why Nicole, the Farrells, and everyone else look like they requested a tour.

### 2. Applications submitted without a card

The `Apply.tsx` form does block card-less submits client-side, but RLS allows any insert and there's no DB-level requirement, so a stale cached page or any direct insert can bypass it.

### 3. Detail view is a small side panel and may be missing fields

The application "View Details" opens a right-side `Sheet` capped at `sm:max-w-4xl`. You want a full page that shows everything filled out on the application.

## Plan

### A. Convert the application detail view into a full page

- New route: `/admin/applications/:id` rendered by a new page `src/pages/admin/ApplicationDetail.tsx`.
- The list row "View Details" button becomes a link/navigate to that route instead of opening the Sheet.
- Move all the existing detail markup (personal info, address, plan, payment, agreements, history, action buttons, dialogs for Activate / Charge / Add Card / Mark Paid / Delete / Locked Date / Payment Link) from the Sheet body into the new page so nothing is lost.
- Audit `Application` type vs. the rendered sections and add any fields currently stored but not displayed: `country`, `other_goals`, `other_services`, `other_motivation`, `lifestyle_integration`, `holistic_wellness`, `previous_member`, `referred_by_member`, `motivations[]`, `wellness_goals[]`, `services_interested[]`, all six acknowledgment booleans (`one_year_commitment`, `ack_initiation_fee`, `ack_card_on_file`, `ack_final_readiness`, `membership_agreement_signed`, `liability_waiver_signed`), `payment_info_provided`, full card details, `annual_fee_status`, `created_at`, status history, and SMS consent if present. Render in clearly-labeled sections so admin sees the entire submission.
- Remove the right-side `Sheet` wrapper (lines ~2579–2586 and its closing tags). The bulk of the JSX inside is reused on the new page.
- Add a back button ("← Applications") on the detail page.

### B. Remove deprecated tour UI

In `src/pages/admin/Applications.tsx` (and the new detail page):
- Drop the `Rocket` "Immediate" badge in the list row driven by `skip_tour_activate_immediately`.
- Drop the "Tour Preference" / "Wants Tour" detail field and the conditional waiver block tied to it. Show the Liability Waiver status unconditionally instead.
- Leave the column in the database for historical records.

### C. Enforce the card requirement at the database

Add a `BEFORE INSERT` trigger on `membership_applications`:

```text
if NEW.status = 'pending' and NEW.stripe_customer_id is null then
  raise exception 'A payment method is required to submit a membership application.'
end if
```

This guarantees no future submissions can land card-less, regardless of which version of the form the applicant is on.

## Out of scope

- No changes to `Apply.tsx` (the public form already gates on a card).
- No backfill of existing applications.
- No pricing, billing, or subscription logic changes.

## Files

- New: `src/pages/admin/ApplicationDetail.tsx`
- Edit: `src/pages/admin/Applications.tsx` (remove Sheet + tour UI, change "View Details" to navigate)
- Edit: `src/App.tsx` (register the new route)
- New migration: trigger enforcing `stripe_customer_id` for pending applications
