import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { ArrowLeft, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";

export default function Privacy() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Privacy Policy" description="Privacy policy and data handling practices for Storm Wellness Club." path="/privacy" />
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-display font-bold">Privacy Policy</h1>
          <p className="text-primary-foreground/70 mt-4">Effective Date: January 6, 2025 · Last Updated: May 4, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto prose prose-lg prose-neutral dark:prose-invert">
          <p className="lead text-xl text-muted-foreground mb-12">
            This Privacy Policy describes how <strong>Storm Fitness, doing business as Storm
            Wellness Club</strong>, collects, uses, shares, and protects your personal information
            across our website, mobile experience, member portal, and on-site facilities.
          </p>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">1. Parties and Scope</h2>
            <p>
              <strong>Storm Fitness DBA Storm Wellness Club</strong> ("Storm Fitness," "we," "us,"
              or "our") is the operator of the club and is responsible for member services,
              billing, communications, classes, spa, café, Kids Care, and on-site activities.
              "Storm Wellness Club" is the trade name (DBA) under which Storm Fitness offers its
              services to the public.
            </p>
            <p>
              This Privacy Policy applies to all services, facilities, and programs offered under
              the Storm Wellness Club brand, regardless of whether the day-to-day service is
              delivered by Storm Fitness employees, contractors, instructors, or third-party
              service providers acting on Storm Fitness's behalf.
            </p>
            <p>
              <strong>User:</strong> "You" or "User" refers to any individual who accesses our
              website, uses our services, applies for membership, holds a non-member account,
              visits the facility as a guest, or otherwise provides personal information to us.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">2. Information We Collect</h2>
            <p>We may collect the following categories of information:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Personal Information:</strong> Name, email address, phone number, home address, date of birth, and emergency contact information.</li>
              <li><strong>Account &amp; Authentication Data:</strong> Login credentials (passwords are stored as one-way hashes), session tokens, and account preferences.</li>
              <li><strong>Payment Information:</strong> Card brand, last 4 digits, expiration, and a tokenized payment-method identifier provided by our PCI-DSS compliant processor (Stripe). We never see, store, or log full card numbers, CVCs, or full bank account numbers on Storm Fitness-controlled systems.</li>
              <li><strong>Health &amp; Fitness Data:</strong> Any fitness goals, health history, injuries, restrictions, or medical information you voluntarily provide so we can tailor classes, recovery, and spa services to your needs.</li>
              <li><strong>Photo &amp; Identity Data:</strong> If you choose to provide a member headshot for visual check-in identity, that photo is stored in a private, restricted bucket and used only for staff identity verification at the front desk and scanner.</li>
              <li><strong>Check-In &amp; Facility Usage Data:</strong> Scan events, class attendance, recovery and spa appointments, Kids Care usage, café orders, and other records of how you use the facility.</li>
              <li><strong>Communications:</strong> Records of your communications with us, including emails, SMS messages, and any feedback or support inquiries.</li>
              <li><strong>Children's Information (Kids Care):</strong> If you enroll a child in Kids Care, we collect first name, age, allergies, special instructions, and authorized pickup contacts. Children's data is used solely to deliver care and contact you in an emergency.</li>
              <li><strong>Device, Usage, and Analytics Data:</strong> IP address, browser type and version, operating system, device type, pages viewed, referring URL, and timestamps. We use Google Analytics (G-QNSF188FQC) to understand site usage in aggregate. We do not collect precise geolocation.</li>
              <li><strong>Cookies &amp; Similar Technologies:</strong> See Section 14.</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">3. How We Use Information</h2>
            <p>We use your information for the following purposes and on the following lawful bases:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Performance of contract:</strong> To provide, manage, and improve our services and facilities; process payments, dues, and arrears; manage memberships, applications, freezes, and cancellations; deliver bookings; and maintain attendance and credit records.</li>
              <li><strong>Legitimate interest:</strong> To prevent fraud and abuse, secure our facility (including check-in verification), perform internal analytics, and operate the business safely.</li>
              <li><strong>Consent:</strong> To send marketing communications (email or SMS) and to use any health information you voluntarily provide to personalize service.</li>
              <li><strong>Legal obligation:</strong> To comply with tax (including 6% Michigan sales tax), accounting, regulatory, and law enforcement requirements.</li>
              <li><strong>Communications:</strong> To send transactional messages (class reminders, waitlist alerts, billing notices, appointment confirmations, café and Kids Care updates, account messages) over email and SMS, as more fully described in Section 4a.</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">4. Disclosure of Data</h2>
            <p>We share personal data only with the following categories of recipients, and only to the extent necessary:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Service Providers (Processors):</strong> Vendors who process data on our
                behalf under contract. These include:
                <ul className="list-disc pl-6 mt-2">
                  <li><strong>Stripe</strong> — payment processing, subscriptions, refunds, and tax records.</li>
                  <li><strong>Twilio</strong> — SMS delivery and inbound message handling.</li>
                  <li><strong>Resend</strong> — transactional email delivery.</li>
                  <li><strong>Lovable Cloud / Supabase</strong> — application hosting, database, authentication, and file storage.</li>
                  <li><strong>Google Analytics</strong> — aggregate website analytics.</li>
                </ul>
              </li>
              <li><strong>Legal Authorities:</strong> Law enforcement or regulatory agencies when required by law, valid legal process, or to protect our rights, our facility, our staff, or our members.</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, financing, or sale of assets, your data may be transferred as part of the transaction. You will be notified via email and/or a prominent notice on our website if such a transfer would change how your data is used.</li>
            </ul>
            <p>We do not sell your personal information to third parties for their marketing purposes.</p>
            <p className="font-medium">
              <strong>SMS Originator Data:</strong> No mobile information you provide for the
              purpose of receiving SMS will be shared with third parties or affiliates for
              marketing or promotional purposes. All categories listed above exclude text
              messaging originator opt-in data and consent; this information will not be shared
              with any third parties.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">4a. SMS / Text Messaging Program</h2>
            <p>
              Storm Fitness operates a text messaging program for members, applicants, non-member
              account holders, and guests who provide consent. Categories of messages include:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Class reminders, schedule changes, waitlist openings</li>
              <li>Spa, recovery, and Kids Care appointment confirmations and reminders</li>
              <li>Billing notices and failed-payment alerts</li>
              <li>Café order ready and pickup notifications</li>
              <li>Operational notices and account messages</li>
              <li>Promotional offers (only if you separately opt in to marketing)</li>
            </ul>
            <p className="mt-4"><strong>Opt-in methods.</strong> You may opt in via:</p>
            <ol className="list-decimal pl-6 space-y-1">
              <li>The online membership application form.</li>
              <li>Non-member account signup.</li>
              <li>The SMS toggle in your member portal Profile.</li>
              <li>Front desk and kiosk in-person registration.</li>
              <li>Phone-capture at point-of-sale (e.g., class pass purchases).</li>
            </ol>
            <p className="mt-4">
              <strong>Frequency &amp; rates.</strong> Message frequency varies. Message and data
              rates may apply per your wireless carrier's plan.
            </p>
            <p>
              <strong>Opt-out.</strong> Reply <strong>STOP</strong>, UNSUBSCRIBE, CANCEL, END, or
              QUIT to any message; toggle SMS off in your account; or email{" "}
              <a href="mailto:admin@stormwellnessclub.com" className="text-gold hover:text-gold-light">
                admin@stormwellnessclub.com
              </a>
              . Reply <strong>HELP</strong> or INFO for support information.
            </p>
            <p>
              <strong>No third-party sharing.</strong> Mobile opt-in data and consent will not be
              shared with third parties or affiliates for marketing or promotional purposes. See
              our full <Link to="/terms#sms" className="text-gold hover:text-gold-light">SMS Terms</Link>.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">5. SR &amp; D Development LLC Liability Limitation</h2>
            <p>
              To the fullest extent permitted by law, SR &amp; D Development LLC and its members,
              managers, and affiliates shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages arising out of any data breach, unauthorized
              access, or other security incident affecting Storm Fitness or any service provider
              engaged by Storm Fitness. Users acknowledge that no data transmission or storage
              system can be guaranteed 100% secure. This limitation of liability is in addition to
              the limitations set forth in our Terms and Conditions.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">6. Data Security</h2>
            <p>
              We use reasonable administrative, technical, and physical safeguards to protect your
              personal information, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>TLS encryption in transit for all web, app, and API traffic.</li>
              <li>Encryption at rest for our managed database and file storage.</li>
              <li>Row-level security (RLS) policies enforced at the database tier so users can only access their own data, except where staff roles are authorized.</li>
              <li>Role-based access control for staff (front desk, instructors, managers, admins, super admins) limiting access to the minimum necessary information.</li>
              <li>PCI-DSS compliant payment processing via Stripe — full card numbers and CVCs never touch Storm Fitness-controlled systems.</li>
              <li>Audit logs for sensitive actions (consent changes, billing operations, access-control overrides).</li>
            </ul>
            <p>However, we cannot guarantee the absolute security of your data.</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">7. Data Retention</h2>
            <p>
              We retain personal information for as long as necessary to fulfill the purposes
              outlined in this Policy, including the duration of your membership or account, plus
              any additional period required to comply with tax, accounting, and legal obligations.
              SMS consent records (timestamp, source, IP address, user agent, disclosure version)
              are retained for the life of the account and for at least four (4) years after
              opt-out for compliance audit purposes.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">8. Minors</h2>
            <p>
              Our online services are generally intended for adults 18 and over. Children under 18
              may use the on-site facility (Kids Care, family programs) only when registered by a
              parent or legal guardian who has provided consent. If we become aware that we have
              collected personal information directly from a child under 16 online without parental
              consent, we will take steps to delete such information.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">9. User Rights</h2>
            <p>Depending on applicable law, you may have rights including:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Access:</strong> Request a copy of your personal data.</li>
              <li><strong>Correction:</strong> Request correction of inaccurate data.</li>
              <li><strong>Deletion:</strong> Request deletion of your data, subject to legal retention requirements.</li>
              <li><strong>Opt-Out of marketing:</strong> Opt out of marketing emails (unsubscribe link in every email) and SMS (reply STOP, profile toggle, or email).</li>
              <li><strong>Right to know / Do Not Sell (California — CCPA/CPRA):</strong> California residents may request information about categories of personal information collected, sold, or shared in the past 12 months. <strong>Storm Wellness Club does not sell personal information.</strong></li>
              <li><strong>Non-discrimination:</strong> We will not discriminate against you for exercising your privacy rights.</li>
            </ul>
            <p>
              To exercise any rights, please contact us using the information provided below. We
              will verify your identity before fulfilling sensitive requests.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">10. Third-Party Links</h2>
            <p>
              Our website or services may link to external sites. We are not responsible for the
              privacy practices of these third-party sites.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">11. No Medical Services / No Health Claims</h2>
            <p>
              Storm Fitness does not provide medical services, medical advice, or healthcare treatment.
              Information related to health and wellness is for general informational purposes
              only and should not replace advice from a qualified healthcare provider.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">12. Policy Modifications</h2>
            <p>
              We may update this Privacy Policy periodically. Material changes will be communicated
              via email or through our website. Continued use of our services after changes
              constitutes your acceptance of the updated Policy.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">13. Governing Law and Venue</h2>
            <p>
              This Privacy Policy shall be governed by and construed in accordance with the laws
              of the State of Michigan, without regard to its conflict of laws principles. Any
              disputes shall be resolved exclusively in the state or federal courts located in
              Wayne County, Michigan.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">14. Cookies and Tracking Technologies</h2>
            <p>We use cookies and similar tracking technologies to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Remember your preferences and settings</li>
              <li>Maintain authenticated sessions</li>
              <li>Analyze website traffic and usage patterns (Google Analytics)</li>
              <li>Improve our website and services</li>
            </ul>
            <p>
              You can manage cookie preferences through your browser settings. However, disabling
              cookies may affect the functionality of our website, including the ability to stay
              logged in.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">15. Contact Information</h2>
            <p>For questions or concerns about this Privacy Policy or our data practices:</p>
            <address className="not-italic">
              <strong>Storm Fitness DBA Storm Wellness Club</strong><br />
              18340 Middlebelt Rd<br />
              Livonia, MI 48152<br />
              Email: <a href="mailto:admin@stormwellnessclub.com" className="text-gold hover:text-gold-light">admin@stormwellnessclub.com</a><br />
              Phone: <a href="tel:+12482328487" className="text-gold hover:text-gold-light">(248) 232-8487</a>
            </address>
          </section>

          <div className="mt-16 pt-8 border-t border-border">
            <Button variant="outline" onClick={scrollToTop} className="gap-2">
              <ArrowUp className="h-4 w-4" />
              Back to Top
            </Button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
