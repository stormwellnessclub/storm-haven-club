# PT fixes: past sessions, amounts owed, paying with credits, legacy transfer, identity checks

## What I found (from the live records)

- **Amount owed is wrong.** The balance only counts sessions marked *completed*. There are 82 past sessions across 14 clients that were never closed out and still say *scheduled*. They are unpaid, about $4,510. None of that money is counted, so these clients show $0 owed.
- **Nadine Atoui:**
  - Her 10-pack has 4 credits left.
  - 3 of her past sessions (8/13, 8/15, 9/24) were never marked done and are not on her package. They show $55 each unpaid, but she shows $0 owed.
  - The "Pay with package" option only lists sessions that are marked *completed*. That's why her credits can't be applied to them.
- **Legacy transfer** still exists, but only as a "Transferred package" button on the main PT Packages page. It isn't on the client's own PT page, so it's hard to find.
- **Unclear sessions:** 4 of Nadine's sessions (8/18, 8/20, 8/21, 9/26) are already on her package but also still say *scheduled*. I'll list them so you can confirm what happened with each one.

## What I'll build

1. **One definition of "owed" everywhere.** Any past session that hasn't been paid, and isn't covered by a package or cancelled, counts as owed, whether it's marked completed or was never closed out. The balance shows two lines:
   - Unpaid completed sessions
   - Past sessions not yet closed out
   
   The client PT page, PT Billing and the member's main account will all use it.
2. **Apply package credits to past sessions.** From a client's PT page or billing screen:
   - Pick any unpaid past session, then "Use package credit" or "Record payment".
   - Using a credit marks the session completed and takes exactly 1 credit, through the existing package history. It never takes a second credit.
   - It blocks if the package doesn't have enough credits left or has expired.
3. **Legacy transfer on the client's page.** A "Transfer legacy package" button on each PT client's profile and Packages tab, with the client already filled in. It opens the same existing transfer form: $0 new revenue, no card charge, full audit history. It also stays on the PT Packages page, renamed to "Transfer legacy package".
4. **Finish the identity checks from your last command:**
   - Open every PT client and confirm the Member/Non-member label shown on screen.
   - Test that selling to a brand-new non-member creates exactly one normal account.
   - Run acceptance tests A–F on test records only.
   - Confirm a non-member's PT page has every section you asked for.
5. **Nadine walkthrough.** Using her file, I'll confirm she shows $165 owed before any action. Then I'll show on screen how applying her credits would work. I won't apply any credits to her real sessions unless you tell me which ones.

## What I won't change

- No billing, autopay or Stripe changes. No real charges.
- I won't close out any past session automatically. You decide each outcome.
- Phase 2D.2 won't start.

## Technical details

- Update `pt_outstanding_balance`: count appointments where the start time is past, `status IN ('completed','scheduled')`, `payment_status IN ('unpaid','past_due')`, no pass, and not already on an invoice. Return a separate `unclosed_past_sessions_cents`. `PTBalanceBreakdown` shows it.
- Extend `usePTUnpaidSessions` and `PTSessionCheckoutDialog` to include past scheduled unpaid sessions. `settleWithPackage` completes and settles them through the existing usage/ledger path. It skips anything already reserved or consumed, so a session can never use two credits.
- Reuse `PTAddExistingPackageDialog` (`mode="transfer"`, preset user) from `PTClientDetail` and its Packages tab.
- Checks run with disposable test users; afterwards I'll confirm all 108 appointments are unchanged.
