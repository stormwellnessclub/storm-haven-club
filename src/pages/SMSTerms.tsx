import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { ArrowLeft, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";

export default function SMSTerms() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="SMS Terms & Conditions"
        description="SMS messaging program terms, opt-in methods, and consent disclosures for Storm Wellness Club."
        path="/sms-terms"
      />

      <div className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-6">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-display font-bold">SMS Terms & Conditions</h1>
          <p className="text-primary-foreground/70 mt-4">Effective Date: May 4, 2026</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto prose prose-lg prose-neutral dark:prose-invert">
          <p className="lead text-xl text-muted-foreground mb-12">
            These SMS Terms govern your participation in the text messaging program operated by{" "}
            <strong>Storm Fitness</strong>, doing business as <strong>Storm Wellness Club</strong>{" "}
            ("Storm," "we," "us," or "our"). The program is owned by SR &amp; D Development LLC.
          </p>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-semibold mb-4">1. Program Description</h2>
            <p>
              Storm Wellness Club uses SMS to send transactional and informational messages to
              members, applicants, non-member account holders, and guests who have provided their
              mobile number and consented to receive texts. Categories of messages include:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Class reminders, schedule changes, waitlist openings, and instructor updates</li>
              <li>Spa and recovery appointment confirmations and reminders</li>
              <li>Kids Care booking confirmations and urgent parent alerts</li>
              <li>Billing notices, failed-payment alerts, and account updates</li>
              <li>Café order ready and pickup notifications</li>
              <li>Membership announcements and operational notices (closures, hours)</li>
              <li>Promotional offers (only sent to users who explicitly opted in to marketing)</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-semibold mb-4">2. Consent (Opt-In)</h2>
            <p>End users opt in to receive SMS through one or more of the following methods:</p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>
                <strong>Online membership application</strong> at{" "}
                <a href="https://stormwellnessclub.com/memberships" className="underline">
                  stormwellnessclub.com/memberships
                </a>
                . Applicants enter their mobile phone number and check a clearly labeled consent
                checkbox before submitting.
              </li>
              <li>
                <strong>Non-member account signup</strong> at{" "}
                <a href="https://stormwellnessclub.com/auth" className="underline">
                  stormwellnessclub.com/auth
                </a>
                . Users creating a non-member account to book classes, recovery, spa, or Kids Care
                enter a mobile number and check a consent checkbox.
              </li>
              <li>
                <strong>Member portal toggle</strong>. Existing members can opt in (or out) at any
                time from their Profile page in the member portal.
              </li>
              <li>
                <strong>Front desk / kiosk registration</strong>. Walk-in guests who register
                in-person at the front desk or kiosk provide their phone number and check the
                same consent checkbox on the registration form.
              </li>
              <li>
                <strong>Point-of-sale phone capture</strong>. When a phone number is collected at
                checkout (e.g., class pass purchase, guest pass) for the first time, the same
                consent checkbox is presented.
              </li>
            </ol>
            <p className="mt-4">
              At every opt-in point, users see the following disclosure before checking the box:
            </p>
            <blockquote className="border-l-4 border-primary pl-4 italic">
              "I agree to receive recurring informational and transactional text messages from
              Storm Wellness Club at the mobile number provided, including class reminders,
              waitlist alerts, billing notices, appointment confirmations, café and Kids Care
              updates, and account messages. Message frequency varies. Message and data rates may
              apply. Reply STOP to unsubscribe or HELP for help. Consent is not a condition of
              purchase. See our SMS Terms and Privacy Policy."
            </blockquote>
            <p className="mt-4">
              Consent is recorded with timestamp, source, IP address, and user agent for audit
              purposes. Consent is not a condition of any purchase.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-semibold mb-4">3. Message Frequency &amp; Rates</h2>
            <p>
              Message frequency varies based on your activity (class bookings, appointments,
              billing events). On average, members receive 4–15 messages per month. Message and
              data rates may apply per your wireless carrier's plan. Storm does not charge for SMS.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-semibold mb-4">4. Opt-Out (STOP)</h2>
            <p>You can opt out of SMS messages at any time by:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Replying <strong>STOP</strong>, UNSUBSCRIBE, CANCEL, END, or QUIT to any message
                from Storm Wellness Club. You will receive a one-time confirmation that you have
                been unsubscribed.
              </li>
              <li>Toggling SMS off in your member portal or non-member account profile.</li>
              <li>
                Emailing{" "}
                <a href="mailto:admin@stormwellnessclub.com" className="underline">
                  admin@stormwellnessclub.com
                </a>{" "}
                from the address associated with your account.
              </li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-semibold mb-4">5. Help (HELP)</h2>
            <p>
              Reply <strong>HELP</strong> or INFO to any message to receive help instructions and
              support contact information. You can also reach support at{" "}
              <a href="tel:+13132865070" className="underline">(313) 286-5070</a> or{" "}
              <a href="mailto:admin@stormwellnessclub.com" className="underline">
                admin@stormwellnessclub.com
              </a>
              .
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-semibold mb-4">6. Mobile Information Sharing</h2>
            <p className="font-medium">
              No mobile information will be shared with third parties or affiliates for marketing
              or promotional purposes. All categories of personal information described in our
              Privacy Policy exclude text messaging originator opt-in data and consent; this
              information will not be shared with any third parties.
            </p>
            <p>
              We only share mobile information with the service providers necessary to deliver
              SMS (e.g., Twilio, our SMS infrastructure provider) under contract.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-semibold mb-4">7. Carrier Disclaimer</h2>
            <p>
              Carriers are not liable for delayed or undelivered messages. Service is available
              on supported carriers and may not be available on all networks.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-semibold mb-4">8. Privacy</h2>
            <p>
              For details on how we collect, use, and protect your information, see our{" "}
              <Link to="/privacy" className="underline">Privacy Policy</Link>.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-display font-semibold mb-4">9. Contact</h2>
            <address className="not-italic">
              <strong>Storm Wellness Club</strong>
              <br />
              Operated by Storm Fitness; owned by SR &amp; D Development LLC
              <br />
              18340 Middlebelt Rd, Livonia, MI 48152
              <br />
              Email:{" "}
              <a href="mailto:admin@stormwellnessclub.com" className="text-gold hover:text-gold-light">
                admin@stormwellnessclub.com
              </a>
              <br />
              Phone:{" "}
              <a href="tel:+13132865070" className="text-gold hover:text-gold-light">
                (313) 286-5070
              </a>
            </address>
          </section>

          <div className="mt-16 pt-8 border-t border-border">
            <Button variant="outline" onClick={scrollToTop} className="gap-2">
              <ArrowUp className="h-4 w-4" /> Back to Top
            </Button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
