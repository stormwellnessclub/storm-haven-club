## Finish SMS-Enabling the Campaign Playbooks

Right now the 6 strategic playbooks (Convert to Applicant, Re-engage Lapsed Guests, Collect Feedback, Prevent Churn, Upsell Tier, Referral Push) only run as **email** through `ComposeEmailDialog`. The SMS plumbing (`send-sms` edge function, MMS picker, opt-in gating, idempotency, send-log with thumbnails) is fully built but can only fire from the one-off "SMS Blast" tab and the per-recipient `SendSmsDialog`.

This plan wires the playbooks into SMS/MMS so each card has a "Launch Campaign" dropdown → choose **Email** or **SMS/MMS**, with the same audience auto-targeting and 14-day conversion attribution.

### What gets built

**1. New file: `src/components/admin/marketing/ComposeSmsDialog.tsx`**
- Mirror of `ComposeEmailDialog` but for SMS, accepting `goalType`, `playbookName`, optional `prefilledRecipient`.
- Reuses the same 6 audience-resolution queries already in `ComposeEmailDialog.fetchSmartAudience`, but additionally filters to recipients where `profiles.sms_opt_in = true` AND `profiles.phone IS NOT NULL`. Shows two counts: "Total in segment: X · SMS-eligible: Y".
- Body editor with segment counter, MMS media picker (`SmsMediaPicker`, up to 3 images), live cost estimate (`estimateCost` from `@/lib/smsCosts`).
- Quick-template chips per goal:
  - `guest_to_applicant`: "Loved your visit? Apply for membership today: stormwellnessclub.com/apply"
  - `re_engage_guest`: "We miss you! Come back this week — book a guest pass: stormwellnessclub.com/guest-pass"
  - `collect_feedback`: "How was your visit to Storm? 30-sec feedback: stormwellnessclub.com/feedback"
  - `prevent_churn`: "Storm: We need an updated card to keep your benefits active: stormwellnessclub.com/portal/billing"
  - `upsell_tier`: "Unlock more at Storm — upgrade your tier and save: stormwellnessclub.com/member/membership"
  - `referral_push`: "Refer a friend, earn 500 pts: stormwellnessclub.com/member/referrals"
- On send: creates an `sms_campaigns` row, then iterates audience invoking `send-sms` with `templateKey: "admin-custom"`, `bypassConsent: false` (so opt-in is enforced), `metadata: { campaign_id, goal_type, source: "playbook_sms" }`. Inserts an `sms_campaign_recipients` row per send with status from the response.
- Confirmation modal showing recipient count + total estimated cost before firing.
- Throttled loop (250ms between sends) to stay under Twilio short-burst limits.

**2. New migration: `sms_campaigns` + `sms_campaign_recipients` tables**
Mirrors the email_campaigns pattern so analytics can use the same `goal_type` + 14-day attribution logic.
```
sms_campaigns(id, campaign_name, campaign_type 'guest'|'member', body, media_urls jsonb, 
              media_count int, sent_count int, sent_at, goal_type text, 
              goal_metadata jsonb, created_by uuid, created_at)
sms_campaign_recipients(id, campaign_id fk, recipient_user_id uuid, phone, recipient_name,
                        status 'sent'|'failed'|'blocked_no_consent', twilio_sid, 
                        error_message, sent_at, created_at)
```
RLS: SELECT/INSERT/UPDATE for `has_any_role(auth.uid(), 'admin','super_admin','manager','front_desk')`. Both tables un-realtime.

**3. Edit: `src/components/admin/marketing/CampaignPlaybooks.tsx`**
- Replace the single "Launch Campaign" button with a `DropdownMenu` split-style: primary action stays "Launch Email", secondary item "Launch SMS/MMS". 
- Add a new prop `onLaunchSmsPlaybook: (playbook: PlaybookConfig) => void`.
- Add a small SMS-eligible chip under the recipient badge (e.g. `~62% reachable by SMS`) — computed from a single `profiles` count query on `sms_opt_in = true` filtered by the audience emails. Cached in component state.

**4. Edit: `src/components/admin/marketing/GuestMarketingTab.tsx` and `MemberMarketingTab.tsx`**
- Add `composeSmsOpen` state and `handleLaunchSmsPlaybook` handler.
- Render `<ComposeSmsDialog>` alongside `<ComposeEmailDialog>`.

**5. Edit: `src/components/admin/marketing/CampaignAnalytics.tsx`**
- Add a "Channel" column to the campaigns list: pulls from both `email_campaigns` and `sms_campaigns`, shows `Email` or `SMS/MMS` badge.
- Conversion attribution stays goal-based — it doesn't care which channel drove it, but now we can compare email vs SMS conversion rates side-by-side per playbook.
- Add a small per-channel rollup card: "Last 30d — Email: X sent, Y converted (Z%) · SMS: A sent, B converted (C%)".

### Out of scope
- No changes to `send-sms` edge function, `SmsMediaPicker`, `SendSmsDialog`, or the existing SMS log/thumbnails (already done last turn).
- No automated drip scheduling — that's the existing Automation Hub. This is one-shot manual playbook launches.
- No Stripe/billing changes.

### Technical notes
- Audience queries in `ComposeSmsDialog` are duplicated from `ComposeEmailDialog` rather than extracted to a shared hook to keep this PR contained; we can refactor later if a third channel appears.
- `bypassConsent: false` — playbook campaigns are marketing, so TCPA/10DLC opt-in is strictly enforced. The audience preview shows the SMS-eligible subset only.
- Idempotency key per send: `playbook-sms-${campaign.id}-${recipient.user_id ?? phone}`.
- Cost guardrail: confirmation modal blocks send if estimated total > $50 unless re-confirmed.
