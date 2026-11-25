# Message for Twilio support

Our Storm Wellness Club account shows Suspended. Please tell us the exact reason and what is required to reactivate it.

Our Messaging Insights screenshot for the past seven days shows Spam complaints N/A (0 messages), 83 opt-outs (2.7%), and 426 filtered messages (14%). We understand that this does not establish the reason for suspension.

We investigated our app and found 50 send attempts rejected with error 21610 during the reviewed ten-day period, affecting 38 distinct phone numbers. No inbound replies were recorded in our app. We have not yet verified whether reply forwarding is missing, failing, or configured elsewhere.

We have now marked these 38 phone numbers as opted out across every app consent source. All outgoing texting paths, including card-expiry reminders, share a block check that prevents future attempts to carrier-opted-out numbers. Both immediate 21610 errors and authenticated delivery callbacks persist opt-outs. Signed STOP/START replies synchronize consent across all sources; only a verified restart clears a carrier block. We tested these changes locally without messaging customers.

Please help verify our inbound reply forwarding and Messaging Service Advanced Opt-Out settings, and explain the filtered-message causes. Our opt-in disclosures are documented at https://stormwellnessclub.com/sms-opt-in-proof.

We will not resume promotional campaigns until the account is restored and the opt-out path is verified. We can provide opt-in records and message examples if needed.
