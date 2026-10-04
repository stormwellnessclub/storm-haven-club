# Project Architecture Rules

- A frozen or past-due membership never blocks portal routing; benefits and facility access are enforced separately by status-aware UI and authoritative database functions.
- Paying a future membership-freeze fee records payment only; the date-driven freeze activation path pauses billing and changes membership status together on the scheduled Detroit date.- When a freeze ends, the dues subscription is unpaused with its billing anchor reset to that day (full charge, no proration); the freeze is only completed after Stripe confirms, otherwise billing_resume_error is set and the daily job retries. Why: members must never get unbilled days after a freeze.
