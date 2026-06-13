# Remove the red "Add payment method" banner

In `src/components/portal/PortalLayout.tsx`, delete the destructive banner block that renders when `profile && !hasCard`. The card-on-file requirement is still enforced at purchase time (per existing card-on-file policy), so users will be prompted to add a card when they actually try to buy something — no need for the persistent red bar.

## Changes
- `src/components/portal/PortalLayout.tsx`: remove the `{profile && !hasCard && (...)}` Alert block and the now-unused `CreditCard` and `Alert`/`AlertDescription` imports if no longer referenced.

No backend, logic, or enforcement changes.
