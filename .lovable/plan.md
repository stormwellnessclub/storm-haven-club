# Jenna Bloom — Card Update Failing

## Diagnosis (from `card_setup_attempts`)

Jenna (jennaalameedi@gmail.com, `cus_UOJUUnlDbQ0kcl`) made two attempts tonight, both **declined by her issuing bank**, not by our system:

| Time (UTC) | Result | Reason |
|---|---|---|
| 22:10:42 | Declined | `transaction_not_allowed` — "Your card does not support this type of purchase" |
| 22:11:08 | Declined | `generic_decline` — "Your card has been declined" |

`transaction_not_allowed` on a SetupIntent (a $0 card verification) almost always means her bank is blocking **card-on-file / recurring authorizations**. That's a bank-side control we can't override.

## What to tell her

She needs to do one of:
1. **Call the number on the back of her card** and ask them to allow "card-on-file / recurring merchant authorizations" for Storm Wellness Club, then retry.
2. **Try a different card** (a different Visa/MC, or a debit card).
3. **Use Apple Pay / Google Pay** in the modal — sometimes clears the block.

## Proposed action

No code changes — the flow is working; the bank is refusing. I'll:

1. Draft an outreach email to Jenna explaining the two decline reasons in plain language and the three options above, plus a direct reply-to for support.
2. On your approval, deploy a one-shot `send-jenna-card-decline-outreach` edge function (same pattern used for Amal) that sends via Resend and logs to `email_audit_log`.

If you'd rather I skip the email and just DM her the message text to send yourself, say the word.
