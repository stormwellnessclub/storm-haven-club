Plan:

1. Update the waitlist promotion charge flow in `ClassRoster.tsx` so “Charge single drop-in” uses the existing admin saved-card function by `userId`, instead of relying only on `non_member_profiles.stripe_customer_id` from the browser.

2. Preserve the current safety rule: do not create the class booking unless the saved-card charge succeeds.

3. Make the error message clearer if the non-member detail page shows card metadata but the payment provider has no usable attached card.

4. Include charge metadata for class/session/waitlist context so the transaction is traceable.

Technical detail:
- Replace the waitlist promotion `charge_saved_card` call with `admin_charge_user_saved_card`, passing `userId`, amount, description, `grossUpFee: true`, and metadata.
- This edge action already looks across members, non-member profiles, profiles, and provider customer records by email, which should match what the non-member account page considers “card on file.”