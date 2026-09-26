# Project Architecture Rules

- A frozen or past-due membership never blocks portal routing; benefits and facility access are enforced separately by status-aware UI and authoritative database functions.
- Paying a future membership-freeze fee records payment only; the date-driven freeze activation path pauses billing and changes membership status together on the scheduled Detroit date.