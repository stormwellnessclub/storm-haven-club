
# Membership Agreement — Delivery + Mariam Response Plan

## 1. Deliver you the actual signed contract

The Membership Agreement lives in the app at `public/agreements/membership-agreement.pdf` (also served publicly at `https://stormwellnessclub.com/agreements/membership-agreement.pdf`). It is 3 pages, 19 sections. When you approve this plan I will copy it to `/mnt/documents/membership-agreement.pdf` so you get a download tile in this chat.

## 2. What the contract actually says about the one-year term (verbatim)

I parsed the full PDF end-to-end. Here is the ONLY section that speaks to term/cancellation, word-for-word:

**Section 4 — Term and Auto-Renewal:**
> "Memberships are issued for an initial annual term. Upon expiration of the initial term, membership shall automatically renew for successive annual terms unless Member provides written notice of cancellation in accordance with Club policies prior to the renewal date."

**Section 5 — Dues:**
> "…All payments are non-refundable except where required by law. Failure to maintain current payment status may result in suspension or termination of membership."

**Section 18 — Entire Agreement:**
> "This Agreement constitutes the entire agreement and supersedes all prior agreements."

That is every clause in the document that touches term, cancellation, or dues obligations. There are no others.

## 3. What is in the contract vs. what is NOT

**IN the contract (supports the Club):**
- One-year initial term — YES (Section 4).
- Auto-renews annually unless written notice before renewal — YES (Section 4).
- Dues already paid are non-refundable — YES (Section 5).
- Non-payment can result in suspension/termination — YES (Section 5).
- Michigan law, Wayne County venue, no arbitration — YES (Sections 15–16).
- Club can amend on notice — YES (Section 19).

**NOT in the contract (what Mariam is exploiting):**
- No clause saying a member cannot cancel during the initial term.
- No early-termination fee.
- No acceleration clause ("if you cancel, you owe the remaining months").
- No incorporation of a separate written "Cancellation Policy."
- No liquidated-damages clause.

**Mariam's legal claim is that Section 4 only covers renewal notice, not mid-term cancellation prohibition. Reading the four corners of this PDF, she is factually correct that those specific words are not in the document.** That is not my opinion — it is what the PDF says. If you want, I can render the PDF to images and point at the exact lines.

## 4. Realistic outcomes if this goes to court

- Venue is Wayne County district/small claims (Section 16 waives arbitration).
- Michigan contract law: ambiguity in an adhesion contract is construed **against the drafter (the Club)**.
- MI Consumer Protection Act (MCL 445.903) prohibits misleading practices — including enforcing terms not disclosed in writing.
- Likely result: court orders cancellation honored, no future dues owed, paid dues kept by Club. Plus reputational cost, chargebacks, potential 1-star review campaign, and legal fees.

I am telling you this so you can make an informed business decision — not to take her side.

## 5. Recommended actions (you pick, then switch to build mode)

**A. Give you the contract now** — copy PDF to `/mnt/documents/` for download.

**B. Draft Mariam's response** — two versions ready for your choice:
   - **B1 (Recommended):** Professional acceptance. Confirm cancellation effective 7/9/26, cancel her Stripe subs (monthly dues + annual fee), state that paid dues are non-refundable per Section 5, no future charges. Closes the exposure.
   - **B2 (Hold-firm):** Cite Section 4 one-year term, demand payment of remaining months. Include this only with the caveat above about likely legal outcome.

**C. Close the gap in v2 of the Membership Agreement** (critical, and cheap to do):
   - Add **Section 4(a) — Early Termination:** "This is a binding 12-month agreement. Member may not cancel during the initial term except as provided herein. Cancellation during the initial term requires payment of an Early Termination Fee equal to 50% of remaining monthly dues, due immediately, in addition to the non-refundable Annual Club Fee."
   - Add **Section 4(b) — Medical/Relocation Exception:** Documented medical inability or relocation >50 miles = pro-rated exit with no ETF.
   - Add **Section 5(a) — Acceleration:** On default, all remaining dues for the initial term become immediately due.
   - Add **Section 14(a):** Incorporate written "Membership Policies" hosted at `/policies/membership` by reference.
   - Regenerate `membership-agreement.pdf` v2, keep v1 as `membership-agreement-v1-archive.pdf` for existing signers (grandfathered), and require v2 e-signature for all new applicants going forward.

## 6. Deliverables in build mode

1. Copy `public/agreements/membership-agreement.pdf` → `/mnt/documents/` (download tile).
2. Whichever response letter (B1 or B2) you pick — either as a Resend email via a one-off edge function, or as a `.docx`/`.pdf` you can send yourself.
3. If approved: generate v2 Membership Agreement PDF (using the pdf/docx skills), archive v1, wire the applicant signup flow to serve v2.

---

**Approve this plan and tell me which of A / B1 / B2 / C you want executed — I can do all four in one build pass.**
