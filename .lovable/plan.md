

## Plan: Skip Twilio Connector, Use Direct Twilio Integration

The Twilio connector keeps rejecting your credentials. Instead of fighting it, we will add your Twilio credentials as manual secrets and call the Twilio API directly from backend functions. This is reliable and gives you full control.

---

### What changes

**Step 1: Add 3 manual secrets**
You will add these in **Settings → Cloud → Secrets**:
- `TWILIO_ACCOUNT_SID` — your `AC...` value
- `TWILIO_AUTH_TOKEN` — your main Auth Token (found on Twilio Console dashboard, not the SK key)
- `TWILIO_PHONE_NUMBER` — your Twilio number in `+1XXXXXXXXXX` format

For this approach you use the **Auth Token** (not the SK API key). The Auth Token is on the main Twilio Console page.

**Step 2: Create `send-sms` edge function**
A new backend function that calls Twilio's REST API directly using HTTP Basic Auth (`AccountSid:AuthToken`). It will:
- Accept `to`, `body`, and optional `contact_id` parameters
- Send SMS via `https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json`
- Log the message to the `sms_messages` table
- Return success/failure status

**Step 3: Create `process-marketing-sequences` edge function**
Processes automated drip campaigns by:
- Querying active enrollments where `next_step_at` is due
- Executing the current step (send email via `send-email`, send SMS via `send-sms`)
- Advancing the enrollment to the next step or marking complete

**Step 4: Add SMS capability to Marketing Portal UI**
Update the marketing tabs to include SMS send buttons alongside existing email functionality.

---

### Technical detail

The `send-sms` function uses Twilio Basic Auth directly:
```
Authorization: Basic base64(AccountSid:AuthToken)
POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
Content-Type: application/x-www-form-urlencoded
Body: To=+1...&From=+1...&Body=Hello
```

No connector gateway needed. This is the standard Twilio integration method.

