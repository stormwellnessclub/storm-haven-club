# Body Roller presale: track clicks and unfinished checkouts, then send follow-up emails

## What you'll get

In Admin → Marketing → Body Roller Presale, a new **Funnel** section for members and for non-members:

```text
Emailed  →  Clicked the link  →  Opened checkout  →  Bought
  124           38                    9                4
```

- **Clicked, didn't buy**: people who clicked a campaign email link but never started checkout.
- **Started checkout, didn't finish**: people who opened the card form but didn't pay. This already gets recorded today; it just isn't shown anywhere.
- Each group has a list you can view and download, split by member and non-member.
- Two new follow-up emails, each with the same send screen as now (exact count, view list, add people, skips anyone already sent):
  - **"Still thinking it over?"** goes to people who clicked but didn't buy.
  - **"Your session is still waiting"** goes to people who started checkout but didn't finish.
- Anyone who buys is removed from both follow-up lists automatically. Blocked and unsubscribed people are always left out.
- I'll write the follow-up wording in the same quiet style as the current emails. You'll check it with Preview before anything goes out. Nothing sends automatically.

## Limits
- Clicks can only be tracked for emails sent after this change. The 124 member launch emails already sent can't be tracked.
- A click counts only if the person clicks a link in the email. Opens aren't tracked, because they're unreliable (Apple Mail reports false opens).
- Follow-ups go only to people the club has an email address for: accounts, imported contacts, members.

## Technical details
- New table `body_roller_presale_clicks` (email, kind, clicked_at, user_id nullable). RLS: staff read only; inserts happen only through the edge function using the service role.
- Every link in a campaign email will carry a signed token (HMAC of email + email kind, so it can't be faked or used to list people). The link goes through a new `body-roller-click` edge function, which records the click and then sends the person to the original page (presale page or journal article). It also adds `?ref=` so the presale page can tie a later checkout back to that click.
- Unfinished checkout = `body_roller_presale_purchases` rows with status `pending` older than 1 hour, for buyers with no `paid` or `processing` row.
- `send-body-roller-presale-email` gains two kinds, `followup_clicked` and `followup_abandoned`. Recipients are built from the click table or pending rows, with the same exclusions and per-kind no-repeat rule. Supports `listOnly` and `extraEmails` like the existing kinds.
- New templates are added in `_shared/bodyRollerPresale.ts`, with member and non-member pricing handled the same way as the launch emails.
- The admin tab adds the funnel counts and the two follow-up rows using the existing `BodyRollerSendDialog`.
