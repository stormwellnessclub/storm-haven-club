
# Full Compliance Audit — Storm Wellness Club Membership Agreement

## Goal
Audit `public/agreements/membership-agreement.pdf` against BOTH governing Michigan statutes and deliver a single combined compliance report. No file edits, no contract v2, no member response — report only.

## Statutes in scope

### 1. Michigan Prepayment for Health Studio Services Act (MCL 445.1811 et seq.)
Primary health-club statute. Sets contract disclosure + cancellation-right minimums.

| # | Requirement | Statute |
|---|---|---|
| 1 | 3-day right to cancel (conspicuous, bold/caps, with instructions & address) | MCL 445.1815 |
| 2 | Death cancellation — pro-rata refund | MCL 445.1816 |
| 3 | Disability cancellation — physician certification, pro-rata refund | MCL 445.1816 |
| 4 | Relocation cancellation (>25 miles from comparable club) | MCL 445.1816 |
| 5 | Club closure / material relocation cancellation | MCL 445.1816 |
| 6 | Term cap ≤ 36 months | MCL 445.1814 |
| 7 | Prepayment / financial-security disclosure (bond/escrow if collecting >3 months prepaid) | MCL 445.1813 |
| 8 | Plain-English contract, signed copy delivered to buyer | MCL 445.1813 |
| 9 | Total contract price disclosed on the face of the contract | MCL 445.1813 |
| 10 | No waiver of statutory rights | MCL 445.1817 |

### 2. Michigan Consumer Protection Act (MCL 445.901 et seq.)
General deceptive/unfair-practices overlay. Applies on top of the health-studio act.

| # | Requirement | Statute |
|---|---|---|
| A | No material misrepresentation about goods/services, price, or terms | MCL 445.903(1)(a)–(c),(e),(g) |
| B | No failure to reveal a material fact whose omission tends to mislead | MCL 445.903(1)(s) |
| C | No ambiguity about material terms (auto-renewal, cancellation mechanics, fees) | MCL 445.903(1)(bb),(cc) |
| D | No unconscionable terms (one-sided waivers, hidden acceleration, unilateral change) | MCL 445.903(1)(hh),(z) |
| E | Auto-renewal must be clearly and conspicuously disclosed + easy cancel path | MCL 445.903(1)(y),(bb) |
| F | Refund/cancellation policy must match what was represented pre-sale (website, application, emails) | MCL 445.903(1)(n),(s) |
| G | No collection of unauthorized/undisclosed charges (annual fee, arrears, late fees) | MCL 445.903(1)(u),(bb) |

Cross-check target: `src/pages/Apply.tsx` "one-year commitment" checkbox + public website copy — must be consistent with the signed PDF or MCPA §(F) fires.

## Method

1. Parse `public/agreements/membership-agreement.pdf` via `document--parse_document` for full verbatim text.
2. For each of the 17 items above:
   - Search parsed text for the required language
   - Record status: **Present verbatim / Present but weak / Missing**
   - Quote exact contract language (or note absence)
3. Cross-check `src/pages/Apply.tsx` acknowledgment copy + any public-facing membership pricing/refund copy vs. the signed PDF for MCPA consistency (items F, B, C).
4. Flag internal contract clauses that actively conflict with either statute (e.g., blanket "non-refundable" that swallows the 3-day right; forced arbitration or jury-trial waiver that also purports to waive HCSA rights).

## Deliverable (single chat report)

- **Combined compliance table** — 17 rows (10 Health Studio Act + 7 MCPA), each with pass/weak/fail + verbatim quote or "MISSING".
- **Ranked risk list** — which gaps make the contract voidable or expose you to MCPA damages/attorney fees, vs. cosmetic.
- **Section-by-section fix list** — exact language to add and where (e.g., new Section 4a "3-Day Right to Cancel," Section 4b "Statutory Cancellation Events," Section 9 revision for total-price disclosure, new Section 20 MCPA-safe severability + no-waiver).
- **Enforceability assessment** — plain-English answer to: given what's in and not in this PDF (plus the Apply.tsx acknowledgment record), is the 1-year term enforceable against a member walking mid-term?

## Out of scope
- Drafting the member response (user handles)
- Rewriting the PDF / generating v2
- Any code, DB, RLS, or email changes
