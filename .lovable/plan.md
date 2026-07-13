
# HCSA Compliance Audit — Membership Agreement PDF

## Goal
Audit `public/agreements/membership-agreement.pdf` against Michigan Health Club Services Act (MCL 419.301 et seq.) requirements and deliver a compliance report identifying which required notices are present, missing, or defective.

## Michigan HCSA — Required Contract Provisions

| # | Requirement | Statute | What must appear in the PDF |
|---|---|---|---|
| 1 | **3-day right to cancel** | MCL 419.305 | Conspicuous notice (bold/caps) that buyer may cancel within 3 business days of signing for full refund. Must include cancellation instructions & address. |
| 2 | **Death cancellation** | MCL 419.306(1)(a) | Right to cancel (pro-rata refund to estate) on member's death. |
| 3 | **Disability cancellation** | MCL 419.306(1)(b) | Right to cancel on permanent disability preventing use (with physician certification). |
| 4 | **Relocation cancellation** | MCL 419.306(1)(c) | Right to cancel on move >25 miles from any comparable club. |
| 5 | **Club closure/relocation cancellation** | MCL 419.306(1)(d) | Right to cancel if club closes or materially relocates. |
| 6 | **Term cap ≤ 3 years** | MCL 419.304 | Contract term cannot exceed 36 months. (Current: 1 yr → OK.) |
| 7 | **Financial security disclosure** | MCL 419.309 | If prepaid dues collected, bond/escrow disclosure. |
| 8 | **Plain language + copy to buyer** | MCL 419.303 | Written, plain English, signed copy delivered. |
| 9 | **Total contract price disclosure** | MCL 419.303 | All fees & total cost of membership disclosed on face of contract. |
| 10 | **No waiver of statutory rights** | MCL 419.310 | Contract cannot make member waive HCSA-granted rights. |

## Method
1. Parse `public/agreements/membership-agreement.pdf` via `document--parse_document` to get full verbatim text of all 3 pages / 19 sections.
2. For each of the 10 requirements above:
   - Search the parsed text for the required disclosure
   - Record: **Present verbatim / Present but weak / Missing**
   - Quote the exact contract language (or note absence)
3. Cross-check the enrollment flow (`src/pages/Apply.tsx` — one-year commitment checkbox) as a supplemental disclosure, and note that it is *not* a substitute for HCSA disclosures inside the signed contract.
4. Flag any clauses that may **conflict** with HCSA (e.g. non-refundable language that swallows the 3-day right, waivers of statutory rights).

## Deliverable
A single compliance report posted in chat, with:
- **Compliance table** (10 rows, pass/fail + verbatim quote or "MISSING")
- **Ranked risk list** — which gaps could make the contract voidable, which are cosmetic
- **Section-by-section fix list** — the exact language to add for each missing HCSA notice (Section 4a "3-Day Right to Cancel," Section 4b "Statutory Cancellation Events," etc.)
- **Enforceability assessment** — plain-English answer to: "Given what's in and not in this PDF, is the 1-year term enforceable against a member who wants to walk mid-term?"

No file edits. No email drafts. No contract v2 rewrite. Report only — you'll decide next steps after reading it.

## Out of Scope
- Drafting Mariam's response (you said you're handling)
- Rewriting the PDF or generating v2
- Any code, DB, or email changes
