# Rebuild the launch-damage report around actual operations and revenue

## Goal
Replace the narrow labor-gap argument with a partner-ready operating and financial diagnosis of the first nine months: what Storm actually launched, what remained inactive, what revenue each area produced, how founder overload constrained activation, and what recovery now requires.

This will remain a separate one-page brief under **Scheduling portal → Cost of waiting**, with drill-down evidence available on the same page. It will not change schedules, transactions, members, classes, spa appointments, or café orders.

## Verified baseline to reconcile
- The current report measures uncovered front desk, café, and kids-care labor, but does not model classes, spa capacity, marketing, customer service, maintenance, training, IT, cleaning, ordering, or hiring work.
- The class goal is **20 classes per weekday across three studios**: 100 per week. Existing dated class records show 274 visible, non-cancelled classes through September 21, with delivery peaking at 68 in June and declining afterward. The final report will calculate the exact goal only from Storm's actual opening date and eligible weekdays.
- The spa has **six active rooms**. Existing records show 112 completed appointments across four used rooms, with 41 recorded clients; 15 returned for another completed appointment. Spa revenue requires reconciliation because appointment totals and payment records are not interchangeable.
- The café order system shows 147 completed orders totaling $3,946.80, including card, cash, and member-account purchases. Separate member charges also contain café purchases, so the report must reconcile payment references instead of summing both sources.
- Actual payment records are fragmented across payment attempts, manual/member charges, café orders, spa appointments, class passes/bookings, and other service ledgers. The same payment can appear in more than one place.

## Build plan

### 1. Create a reconciled actual-revenue layer
- Build a read-only reporting query/helper that produces one canonical transaction list for the nine-month period.
- Reconcile by Stripe payment reference first, then stable source record, so café, spa, classes, membership, PT, and miscellaneous charges are not counted twice.
- Separate gross collected, refunds, taxes, processing fees, tips, credits/prepaid redemptions, cash, and unpaid/failed attempts.
- Treat café credit redemption as service usage rather than new revenue when the money was collected earlier.
- Show a reconciliation panel: source totals, duplicates removed, unclassified charges, and final included amount. Nothing unclassified will silently become revenue for a department.

### 2. Measure the class-launch shortfall
- Compare actual visible, non-cancelled classes delivered with the **20-per-weekday goal** from opening through the selected report date.
- Show monthly classes delivered, goal attainment percentage, cancellations, booked spots, attendance where recorded, capacity offered, fill rate, instructors active, studios used, and the gap by studio/daypart.
- Distinguish three separate constraints: classes never scheduled, scheduled classes cancelled, and classes delivered with low early enrollment.
- Show the community-ramp problem honestly: instructors and recurring time slots need time to build rapport, but Storm could not consistently supply enough instructors or classes to begin that ramp.

### 3. Measure spa activation and repeat behavior
- Treat all six active rooms as intended operating capacity, while splitting therapist-led and non-therapist room types so one therapist is not assumed capable of serving six rooms simultaneously.
- Show completed appointments, paid service revenue excluding tips, average service ticket, unique clients, repeat clients, repeat appointments, therapists active, rooms used, and monthly trend.
- Compare actual appointment-hours with available room-hours and therapist-hours where availability exists.
- Build three transparent revenue scenarios from Storm's own achieved average ticket and repeat behavior: conservative, evidence-based, and intended-capacity. External spa benchmarks will be reference bands, not substitutes for Storm's data.

### 4. Measure real café activity and member spend
- Reconcile completed café orders with card-on-file/member charges, cash, prepaid credits, and payment references.
- Show net café revenue, orders, purchasing members, orders per purchasing member, average ticket, repeat-purchase frequency, monthly trend, and periods with little or no activity.
- Separate “people did not buy” from “the café was not consistently staffed/open/marketed,” using staffing coverage and transaction timing where the records support it.
- Do not use the old generic percentage-of-club-revenue estimate as the headline. Actual Storm sales lead; external café ramp evidence appears only as context.

### 5. Expand the founder-load model
- Keep the verified 112-hour weekly workload input, but break it into visible operating roles: floor coverage, hiring, training, teaching, customer service, phone/email, café ordering/setup, cleaning, maintenance coordination, marketing, IT, and administration.
- Clearly label recorded hours versus owner-entered hours; the system cannot invent historical time records.
- Show the operational chain in figures: uncovered roles → founder substitution → hiring/marketing/class-development time displaced → slower department activation → delayed revenue ramp.
- Quantify hiring capacity needed to relieve the founder first, then the additional specialist hiring required for instructors and spa therapists.

### 6. Replace one “damage” number with three defensible scenarios
For classes, spa, and café, show:
1. **Conservative:** extrapolate only from Storm's demonstrated revenue and utilization.
2. **Evidence-based:** apply a moderated ramp using Storm's results plus cited industry ranges.
3. **Intended capacity:** show what reaching the stated operating plan would imply, clearly marked as a target rather than lost revenue.

Each figure will identify whether it is:
- actual collected revenue,
- measured operating shortfall,
- modeled unrealized revenue,
- founder labor value, or
- an external benchmark.

No churn assumption will be introduced. No modeled revenue will be presented as money Storm definitively “lost.”

### 7. Show brand damage and recovery horizon responsibly
- Add cited evidence that launch-period first impressions carry disproportionate weight, service recovery can restore satisfaction but does not reliably restore loyalty or brand image, and founder overload affects execution.
- Present recovery as a phased rebuilding requirement rather than a magic date:
  - stabilize core coverage and founder relief,
  - recruit and onboard instructors/therapists,
  - establish consistent class and spa inventory,
  - restart marketing only after service capacity is reliable,
  - rebuild member habits, referrals, and repeat bookings.
- Calculate recovery timelines at several hiring speeds and show how each further month delays both capacity and the start of the customer-habit ramp.

### 8. Partner-facing presentation and audit trail
- Rework the page into five printable sections: **Nine months in**, **What actually earned**, **What could not launch**, **Why the gap compounds**, and **Recovery plan**.
- Add monthly charts for revenue by department, class goal attainment, spa room/therapist activation, café member spend, founder load, and cumulative measured versus modeled exposure.
- Include a plain-language executive page followed by a methodology and sources appendix.
- Add a data-quality ledger listing included records, excluded statuses, duplicate-payment rules, missing historical fields, and confidence level for every scenario.

## Technical details
- Extend the existing launch-cost calculation and page rather than creating another disconnected report.
- Use existing payment, manual charge, café, spa, class, schedule, staffing, and member records through read-only reporting queries.
- Keep America/Detroit boundaries for opening date, weeks, months, classes, appointments, and transaction reporting.
- Stripe Sigma is not enabled, so reconciliation will use the application's stored Stripe payment references and available payment APIs; the report will disclose any payment that cannot be matched rather than guessing.
- External citations will favor HFA/IHRSA, ISPA, peer-reviewed service-recovery and first-impression research, and clearly labelled directional industry sources where primary figures are unavailable.

## Validation
- Hand-reconcile sampled café member charges to café orders and payment references.
- Hand-reconcile sampled spa payments to completed appointments, excluding tips and cancelled appointments from service revenue.
- Verify class counts month by month and confirm hidden, cancelled, fundraiser, and future sessions are treated correctly.
- Confirm the 20-class goal counts weekdays only and starts on Storm's actual opening date.
- Prove scenario totals from their visible inputs and ensure conservative ≤ evidence-based ≤ intended capacity.
- Confirm no transaction, booking, member, schedule, or staffing record is modified.
- Test print/PDF and mobile/desktop readability, then provide a pass/fail evidence report with exact totals and unresolved data gaps.
