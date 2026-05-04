## Goal

Fix the company-language issues, fold the SMS program into the Privacy Policy and Terms (no standalone page), and stop describing SR & D Development LLC as an owner of anything. The Twilio campaign link will point at **`/terms`** (which Twilio actually asks for — "direct link to your terms and conditions"), with `/privacy` carrying the full SMS data-handling detail.

## Corrections being applied

1. **Company name** — Always render the full DBA: **"Storm Fitness DBA Storm Wellness Club"** on first mention in each document, then **"Storm Fitness"** as the short form. Never use bare "Storm." Defined term becomes `("Storm Fitness," "we," "us," or "our")`.
2. **SR & D Development LLC** — Remove every statement that SR & D owns Storm Fitness, owns the brand, owns the assets, or operates the club. SR & D will only appear inside liability/indemnity/release clauses as a named protected affiliate (no relationship described). No "parent entity," no "owner of record," no "owns the brand."
3. **No invented facts** — I will only keep facts you've already given me: legal name Storm Fitness; DBA Storm Wellness Club; address 18340 Middlebelt Rd, Livonia, MI 48152; phone 313-286-5070; email admin@stormwellnessclub.com; SMS via Twilio; Stripe / Resend / Supabase as processors; G-QNSF188FQC analytics. Nothing else added.

## File changes

### A. `src/pages/Terms.tsx` — becomes the Twilio-target page

- **§1 / §2 Parties:** Rewrite to "These Terms govern your use of services provided by **Storm Fitness, doing business as Storm Wellness Club** ('Storm Fitness,' 'we,' 'us,' or 'our')." Remove the line that says SR & D owns/operates anything.
- Global find/replace: every standalone "Storm" → "Storm Fitness".
- **§5 Assumption of Risk / §11 Damages Limitation / §14 IP:** keep "SR & D Development LLC" listed as a released/indemnified affiliate, but strike "owners" language. IP section: change "property of Storm or SR & D Development" → "property of Storm Fitness."
- **New §8a — SMS / Text Messaging Program** (inserted between §8 Payments and §9 Refunds). Self-contained block with all six Twilio-required items:
  - **Program Name:** Storm Wellness Club SMS
  - **Operator:** Storm Fitness DBA Storm Wellness Club
  - **Description:** transactional + service messages — class reminders, waitlist openings, spa/recovery/Kids Care confirmations, billing notices, café pickup, account/operational notices, and (only with separate marketing opt-in) promotional offers
  - **Message Frequency:** varies; typically 4–15 messages/month
  - **Message & Data Rates:** "Message and data rates may apply" per your wireless carrier's plan
  - **Opt-in methods:** membership application; non-member signup; portal Profile SMS toggle; front-desk/kiosk in-person; phone capture at point-of-sale
  - **Opt-out:** reply **STOP**, UNSUBSCRIBE, CANCEL, END, or QUIT (case-insensitive); toggle SMS off in portal Profile; or email admin@stormwellnessclub.com
  - **Help:** reply **HELP** or INFO
  - **Support contact:** admin@stormwellnessclub.com · (313) 286-5070
  - **No third-party sharing:** mobile opt-in data and consent are not shared with third parties or affiliates for marketing purposes
  - Cross-link to `/privacy` for full data handling
  - **STOP** and **HELP** rendered with `<strong>` per Twilio review checklist
- **§20 Contact** address block: drop "Operated by SR & D Development LLC" line. Just "Storm Fitness DBA Storm Wellness Club" + address + email + phone.

### B. `src/pages/Privacy.tsx` — clean entity language

- **Lead paragraph:** "…how **Storm Fitness, doing business as Storm Wellness Club** collects…"
- **§1 Parties and Scope:** Rewrite. New text: "**Storm Fitness DBA Storm Wellness Club** ('Storm Fitness,' 'we,' 'us,' or 'our') is the operator of the club and is responsible for member services, billing, communications, classes, spa, café, Kids Care, and on-site activities." Remove the SR & D paragraph here entirely (SR & D does not appear in §1).
- Global cleanup: "Storm" alone → "Storm Fitness". "Storm-controlled systems" → "Storm Fitness-controlled systems."
- **§4a SMS / Text Messaging Program:** keep (already correct in spirit); rewording uses "Storm Fitness" instead of "Storm." Section already covers opt-in methods, frequency, rates, STOP/HELP, no-third-party-sharing — no new facts added.
- **§5 — Currently titled "SR & D Development LLC Liability Limitation":** rewrite to remove ownership claims. New short text: "To the fullest extent permitted by law, SR & D Development LLC and its members, managers, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of any data breach, unauthorized access, or other security incident affecting Storm Fitness or its service providers. This limitation of liability is in addition to the limitations set forth in our Terms and Conditions." No description of relationship between SR & D and Storm Fitness.

### C. Remove standalone SMS Terms page

- Delete `src/pages/SMSTerms.tsx`.
- Remove the `import SMSTerms` line and `<Route path="/sms-terms">` from `src/App.tsx`.
- Remove the "SMS Terms" link from `src/components/Footer.tsx`.
- (Optional, cheap insurance) add a redirect route `/sms-terms` → `/terms#sms` using `<Navigate>` so any links already given to Twilio resolve. **Will include this** unless you say otherwise.

### D. Memory

- Update `mem://compliance/sms-consent-system.md`: company is **Storm Fitness DBA Storm Wellness Club**; SR & D Development LLC has no operating or ownership role in policy text and is referenced only inside liability/release clauses as a protected affiliate; SMS terms live inside `/terms` §8a, with full data-handling in `/privacy` §4a; the standalone `/sms-terms` page has been removed.

## Twilio submission

After deploy, paste this into Twilio's "Terms & Conditions URL" field:

```
https://stormwellnessclub.com/terms
```

That page's §8a satisfies all six Twilio checklist items (program name, description, msg/data rates, frequency, support contact, opt-out with **HELP** and **STOP** bolded). No content is invented — only the facts you already provided.

## What is **not** changing

- Database (`sms_consent_log`, opt-in columns, triggers) — already in place.
- Consent UI (`SmsConsentCheckbox`, Apply page, portal Profile toggle) — already in place.
- Footer's existing Privacy / Terms links.
- No edge functions added in this pass.
