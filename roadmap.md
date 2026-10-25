# Roadmap

- [x] Combine seaweed wrap durations in one public listing, add supplied ritual description and highlighted/detailed benefits, verify duration-specific booking prices
- [ ] Complete seaweed ritual booking verification — 90-minute service has no configured availability in the next 60 days; staff must set its hours before clients can reserve it

- [x] Correct Linda’s 90-minute body-wrap price and prevent duration upgrades from retaining shorter-treatment prices; preserve intake/card links and do not charge
- [ ] Verify upgraded treatment checkout through staff screen — requesting user's preview session returns Access Denied; menu-price tests pass and Linda's $290 price, intake and card link verified directly

- [x] Correct massage/body-wrap two-hour and 24-hour reminder timing in Detroit; verify without triggering client messages

- [x] Unify abandoned applications into a full searchable roster with time/stage filters and visible-list CSV export
- [ ] Verify abandoned roster with real staff data — preview sign-in returns Access Denied; isolated controls and tests passed

- [x] Preserve spa voucher/credit coverage at checkout and collect only uncovered extras without changing live appointments

- [x] Correct unpaid spa payment badges, booking records, and checkout balances without changing live appointments

- [x] Show complete appointment intakes and provide therapist printing in admin and front desk

- [x] Show spa appointment request alerts on admin and front desk main pages with direct request access

- [x] Month-by-month sales tax report (every taxed sale, all sources, per month)
- [x] PT portal: manually add a new client
- [x] Locate the month-by-month sales tax report in Admin Finance → Reports
- [x] Admin Class Studio Portal (day grid, month planner, templates, metrics)
- [x] Public class discovery: show class name/details inline on /classes and /schedule (no extra clicks), stronger selling copy + booking CTAs
- [x] New public /reviews page: all class reviews grouped, review text left with class type + instructor name, SEO metadata + JSON-LD, linked from site nav
- [x] Fix Non-Member Detail class history (instructors first/last name)
- [x] Fix pt_group_slot_occupancy (profiles.full_name -> first/last)
- [x] Rola Taleb: freeze ended 8/11 but Stripe collection stayed paused — resumed + finalized Aug dues (card declined, insufficient funds)
- [x] Cancelled members list/tab: separate roster of cancelled vs. cancelled-but-owing members, no emails triggered, accurate active member count
- [x] Fix guest passes failing to load (explicit column selects after grant tightening)
- [x] Early closing notice (Wed Sep 2, 9:00 PM urgent maintenance): email template + preview/test controls, member & public site banner
- [x] Rebuild Admin / Front Desk / Kiosk notification chime as one persistent service
- [x] Make the main front desk computer chime self-recovering, visible, and diagnosable

## PT Future Autopay Validation (Phase 2C.5B2 gap closure)
- [ ] Route PT payment functions + webhook through Stripe test mode when flagged
- [ ] Create test-mode webhook endpoint + store signing secret
- [ ] Build disposable test client, pack, plan ($1200: $300 + 3x$300) with Stripe test clock
- [ ] T1 second installment, T2 third, T3 reconciliation, T4 duplicate webhook, T5 failure, T6 retry, T7 completion
- [ ] Clean up all disposable data; report gates A-J

## Non-member list cleanup (Oct 13)
- [x] Non-member Body Roller emails use the full list (imported + accounts), no 1,000 cap, count shown in admin
- [x] Non-member accounts linked into contacts (backfill + automatic)
- [x] Hide current members from non-member account lists
- [x] Cancelled members: non-member portal and pricing only
- [ ] Remove 89 duplicate non-member records — waiting on user review of list
- [ ] Book club last call: send email and text (owner presses Send), publish
- [x] Freezes: pre-pause dues when renewal falls before an approved, paid freeze start (Nsreen paused manually)
- [x] Jenna Saleh $250 refunded
- [x] Cancellation texts for class, PT and spa cancellations (membership stays email only)
