# Club-wide texting rule and audit

Rule: after STOP, no future club text reaches the provider until a verified restart; settled message history stays unchanged.

Read and checked:
- Campaign Studio send/test and scheduled campaigns; targeted send-sms-campaign plus run-sms-campaign-scheduled; legacy Society sends: all route through send-sms, no consent bypass.
- Cafe ready notices; waitlist notices; class reminders; PT booking and request notices; spa reminders/guest confirmations; Kids Care pass-ending notices; guest invitations; Google review flow; planner reminders: all route through send-sms.
- Staff SendSmsDialog, ComposeSmsDialog, SmsBlastTab; class roster cancellations and unfinished spa checkout outreach: all route through send-sms. Some legacy clients submit bypassConsent, but only service role can use it and the new carrier block cannot be bypassed.
- Card-expiry daily job: previously sent directly to Twilio; corrected to use send-sms with stable per-notice idempotency.
- Member/non-member toggles, gates, member opt-in banner, cafe opt-in UI: ordinary profile changes never clear carrier suppression; verified START is required for carrier STOP. Reminders and provider sends use the shared boundary regardless of these UI flags.
- Database set_phone_sms_consent previously skipped profiles and spa consent; corrected to normalize phone matches and update all four sources. sms_phone_is_blocked checks carrier history and account opt-outs. record_sms_phone_choice is atomic and ignores older replies/callbacks.
- Inbound webhook previously used fragile formatted-phone matching for consent changes and ignored write failures; now uses normalized atomic choice handling and returns failure for retries. Twilio Advanced OptOutType supported; duplicate confirmations avoided. Status callback 21610 also records suppression.
- Provider direct-send search now finds only send-sms. Scheduled jobs enter through the above shared functions; no other direct Twilio provider sends found.

Verification: 15 isolated handler/database tests; all 38 historical refused phone numbers now have consent disabled in each existing matching source; no sms_messages records changed by repair. Functions deployed. Provider forwarding remains unverified: linked Twilio read rejected with 70051. Neither the suspension cause nor the full list of 83 screenshot opt-outs has been established.
