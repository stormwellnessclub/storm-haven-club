import { Link } from "react-router-dom";
import { NoIndex } from "@/components/seo/NoIndex";

/**
 * Public, no-login page for Twilio A2P 10DLC reviewers.
 * Documents every opt-in path, the verbatim consent disclosure,
 * the confirmation SMS, message types, frequency, STOP/HELP, and links.
 * Linked from the campaign Call-to-Action / Message Flow field.
 */
export default function SmsOptInProof() {
  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4">
      <NoIndex />
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">SMS Opt-In Proof &amp; Call to Action</h1>
          <p className="text-muted-foreground">
            Storm Fitness DBA Storm Wellness Club — A2P 10DLC consent documentation
            for carrier and Twilio reviewers. Public page, no login required.
          </p>
          <p className="text-sm text-muted-foreground">
            Brand: Storm Fitness DBA Storm Wellness Club · Website:{" "}
            <a className="underline" href="https://stormwellnessclub.com">
              stormwellnessclub.com
            </a>{" "}
            · Support: admin@stormwellnessclub.com
          </p>
        </header>

        <section className="space-y-3 rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Verbatim consent disclosure</h2>
          <p className="text-sm leading-relaxed">
            The following text appears next to a <strong>required, unchecked-by-default
            checkbox</strong> on every opt-in path. The user must actively check the
            box to opt in. Consent is <strong>not</strong> a condition of purchase.
          </p>
          <blockquote className="border-l-4 border-primary pl-4 py-2 text-sm leading-relaxed bg-muted/40">
            I agree to receive recurring informational and transactional text messages
            from <strong>Storm Wellness Club</strong> at the mobile number provided,
            including class reminders, waitlist alerts, billing notices, appointment
            confirmations, café and Kids Care updates, and account messages. Message
            frequency varies. Message and data rates may apply. Reply{" "}
            <strong>STOP</strong> to unsubscribe or <strong>HELP</strong> for help.
            Consent is not a condition of purchase. See our{" "}
            <Link to="/terms#sms" className="underline">SMS Terms</Link> and{" "}
            <Link to="/privacy" className="underline">Privacy Policy</Link>.
          </blockquote>
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Opt-in paths (Call to Action)</h2>
          <ol className="list-decimal pl-5 space-y-3 text-sm leading-relaxed">
            <li>
              <strong>Membership application</strong> —{" "}
              <a className="underline" href="https://stormwellnessclub.com/apply">
                stormwellnessclub.com/apply
              </a>
              . Public page. Applicants enter their mobile number and check the
              unchecked-by-default consent box (disclosure above) before submitting.
            </li>
            <li>
              <strong>Non-member registration / checkout</strong> —{" "}
              <a className="underline" href="https://stormwellnessclub.com/auth">
                stormwellnessclub.com/auth
              </a>
              . When a guest creates an account or completes a class-pass, guest-pass,
              or spa-booking checkout, the same disclosure and unchecked-by-default
              checkbox appear at phone-number capture.
            </li>
            <li>
              <strong>Member portal profile</strong> —{" "}
              stormwellnessclub.com/portal/profile (login required). Existing members
              opt in by toggling "Receive SMS notifications." The disclosure above is
              shown before the toggle activates.
            </li>
            <li>
              <strong>In-person enrollment</strong> — Livonia, MI front desk. Staff
              read the disclosure aloud and check a confirmation box in our POS
              attesting verbal consent. The same disclosure is printed on the
              membership agreement the member signs.
            </li>
            <li>
              <strong>SMS keyword</strong> — Texting <strong>START</strong>,{" "}
              <strong>JOIN</strong>, <strong>SUBSCRIBE</strong>, or <strong>YES</strong>{" "}
              to our number re-subscribes a previously opted-out user and triggers the
              opt-in confirmation message below.
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Every opt-in logs timestamp, source channel, IP, and user-agent as a
            consent audit trail. Phone numbers and consent records are never sold,
            rented, or shared with third parties for marketing.
          </p>
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Opt-in confirmation message</h2>
          <p className="text-sm">Sent immediately after a user opts in:</p>
          <blockquote className="border-l-4 border-primary pl-4 py-2 text-sm bg-muted/40">
            Storm Wellness Club: You're subscribed to account &amp; class alerts
            (reminders, waitlist, billing, appointments). Msg freq varies. Msg &amp;
            data rates may apply. Reply HELP for help, STOP to cancel.
          </blockquote>
          <p className="text-sm">
            <strong>Opt-in keywords:</strong> START, JOIN, SUBSCRIBE, YES, UNSTOP
          </p>
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Help &amp; opt-out</h2>
          <div className="text-sm space-y-2">
            <p><strong>HELP reply:</strong></p>
            <blockquote className="border-l-4 border-muted pl-4 py-2 bg-muted/40">
              Storm Wellness Club: Reply STOP to unsubscribe. Help:
              admin@stormwellnessclub.com or stormwellnessclub.com/sms-terms
            </blockquote>
            <p><strong>STOP reply:</strong></p>
            <blockquote className="border-l-4 border-muted pl-4 py-2 bg-muted/40">
              You are unsubscribed from Storm Wellness Club SMS. No more messages will
              be sent. Reply START to re-subscribe.
            </blockquote>
            <p>
              <strong>Opt-out keywords:</strong> STOP, STOPALL, UNSUBSCRIBE, CANCEL,
              END, QUIT
            </p>
            <p>
              Users can also opt out by toggling SMS off in account settings or
              emailing admin@stormwellnessclub.com.
            </p>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Message types &amp; frequency</h2>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>Class booking confirmations, cancellations, and 24h / 2h reminders</li>
            <li>Waitlist alerts (joined, spot opened)</li>
            <li>Spa &amp; appointment confirmations and reminders</li>
            <li>Kids Care booking confirmations and reminders</li>
            <li>Billing notices (failed payment, card expiring, arrears)</li>
            <li>Café order ready notifications</li>
            <li>Account/admin notices</li>
          </ul>
          <p className="text-sm">
            <strong>Frequency:</strong> Varies by member activity, typically 2–10
            messages per month.
          </p>
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Sample messages</h2>
          <ul className="list-disc pl-5 text-sm space-y-2">
            <li>
              Storm: Reminder — Reformer Pilates tomorrow at 9:00 AM. Reply STOP to
              opt out.
            </li>
            <li>
              Storm: Payment failed for monthly dues. Please update your card to keep
              your benefits active: stormwellnessclub.com/portal/billing
            </li>
            <li>
              Storm: A spot opened for Cycling on Tue at 6:00 PM. You're booked.
            </li>
          </ul>
        </section>

        <section className="space-y-2 rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Policy links</h2>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>
              <Link className="underline" to="/terms#sms">SMS Terms</Link>
            </li>
            <li>
              <Link className="underline" to="/privacy">Privacy Policy</Link>
            </li>
            <li>
              <Link className="underline" to="/apply">
                Membership application (live opt-in checkbox)
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
