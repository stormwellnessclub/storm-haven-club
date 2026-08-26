import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { ArrowLeft, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";

export default function Terms() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Terms of Service" description="Terms and conditions for Storm Wellness Club membership and services." path="/terms" />
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-display font-bold">Terms and Conditions</h1>
          <p className="text-primary-foreground/70 mt-4">Effective Date: January 6, 2025</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto prose prose-lg prose-neutral dark:prose-invert">
          <p className="lead text-xl text-muted-foreground mb-12">
            Please read these terms carefully before using Storm Fitness facilities and services.
          </p>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing, registering for, or using any services, facilities, or programs
              provided by <strong>Storm Fitness, doing business as Storm Wellness Club</strong>{" "}
              ("Storm Fitness," "we," "us," or "our"), you agree to be bound by these Terms and
              Conditions ("Terms"). If you do not agree to these Terms, you must not use our
              services or facilities.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">2. Parties and Entities</h2>
            <p>
              <strong>Operating Entity:</strong> Services are provided by <strong>Storm Fitness
              DBA Storm Wellness Club</strong>. "Storm Wellness Club" is the trade name (DBA) under
              which Storm Fitness offers its services. All memberships, transactions, and services
              described in these Terms are provided by Storm Fitness.
            </p>
            <p>
              <strong>User:</strong> "You" or "User" refers to any individual using Storm Fitness's
              services or facilities, including members, guests, and pass holders.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">3. Scope of Services</h2>
            <p>
              Storm Fitness provides fitness, wellness, and related services, including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access to gym facilities</li>
              <li>Fitness classes</li>
              <li>Personal training sessions</li>
              <li>Wellness programs (e.g., spa, recovery)</li>
              <li>Café services</li>
              <li>Childcare services (Storm Kids Care)</li>
            </ul>
            <p>
              Services may be updated, modified, or discontinued at Storm Fitness's discretion. Storm Fitness is not obligated to maintain or continue specific services indefinitely.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">4. Account Registration and Conduct</h2>
            <p><strong>Registration:</strong> Users must provide accurate, complete, and current information when registering for a membership or any Storm Fitness service.</p>
            <p><strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your account credentials. Any activities under your account are your responsibility.</p>
            <p><strong>Conduct:</strong> Users must:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Follow all posted rules, guidelines, and instructions from Storm Fitness staff.</li>
              <li>Treat other users, staff, and property with respect.</li>
              <li>Refrain from any illegal, threatening, abusive, or disruptive behavior.</li>
            </ul>
            <p>
              Storm Fitness reserves the right to terminate or suspend any user's membership or access for violations of these Terms or other unacceptable conduct.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">5. Assumption of Risk</h2>
            <p>
              Use of Storm Fitness's facilities, services, and programs involves inherent risks, including but not limited to risk of physical injury, illness, or other harm. By using our services, you:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Acknowledge that participation in fitness activities, wellness treatments, and related offerings can be physically demanding and may pose health risks.</li>
              <li>Agree to assume full responsibility for any personal injury, property damage, or loss resulting from your participation.</li>
              <li>Release and hold harmless Storm Fitness, SR & D Development, and their respective officers, employees, and agents from any claims arising out of your use of our services or facilities.</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">6. User Duty of Care</h2>
            <p>
              Users are advised to consult a qualified physician before starting any fitness program or treatment, especially if you have pre-existing health conditions, injuries, or concerns. Storm Fitness staff are not medical professionals and are not responsible for diagnosing or treating medical conditions.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">7. No Medical Services</h2>
            <p>
              Storm Fitness does not offer or provide medical services, medical advice, or healthcare treatment. Any information, recommendations, or guidance provided by staff or through our offerings is for informational and general wellness purposes only and should not be construed as a substitute for professional medical advice. Always seek the guidance of your physician or other qualified health provider for any medical questions or conditions.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">8. Payments and Fees</h2>
            <p><strong>Payment Terms:</strong> All fees must be paid in accordance with the membership agreement or service agreement you signed. Storm Fitness may use third-party payment processors, and by providing payment information, you consent to these processors handling your transactions.</p>
            <p><strong>Non-Payment:</strong> Failure to pay fees may result in suspension or termination of membership privileges.</p>
          </section>

          <section id="sms" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-display font-semibold mb-4">8a. SMS / Text Messaging Program</h2>
            <p>
              By providing your mobile number and opting in, you agree to receive text messages
              from <strong>Storm Fitness DBA Storm Wellness Club</strong> as described below. Your
              consent is not a condition of any purchase.
            </p>

            <div className="my-6 rounded-lg border border-border bg-muted/30 p-6">
              <h3 className="text-lg font-display font-semibold mb-4">Program Summary</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-x-6 gap-y-3 text-sm">
                <dt className="font-semibold">Program Name</dt>
                <dd>Storm Wellness Club SMS</dd>
                <dt className="font-semibold">Operator</dt>
                <dd>Storm Fitness DBA Storm Wellness Club</dd>
                <dt className="font-semibold">Description</dt>
                <dd>
                  Transactional and service messages including class reminders, waitlist
                  openings, spa, recovery, and Kids Care appointment confirmations, billing
                  notices, café pickup notifications, and account or operational notices.
                  Promotional offers are sent only if you separately opt in to marketing.
                </dd>
                <dt className="font-semibold">Message Frequency</dt>
                <dd>Varies; typically 4–15 messages per month per subscriber.</dd>
                <dt className="font-semibold">Message &amp; Data Rates</dt>
                <dd>Message and data rates may apply per your wireless carrier's plan.</dd>
                <dt className="font-semibold">Opt-In Methods</dt>
                <dd>
                  Online membership application; non-member account signup; SMS toggle in your
                  member portal Profile; front-desk and kiosk in-person registration; and
                  phone-number capture at point of sale.
                </dd>
                <dt className="font-semibold">Opt-Out</dt>
                <dd>
                  Reply <strong>STOP</strong>, UNSUBSCRIBE, CANCEL, END, or QUIT to any message;
                  toggle SMS off in your member portal Profile; or email{" "}
                  <a href="mailto:admin@stormwellnessclub.com" className="text-gold hover:text-gold-light">
                    admin@stormwellnessclub.com
                  </a>
                  .
                </dd>
                <dt className="font-semibold">Help</dt>
                <dd>
                  Reply <strong>HELP</strong> or INFO for support information.
                </dd>
                <dt className="font-semibold">Support Contact</dt>
                <dd>
                  <a href="mailto:admin@stormwellnessclub.com" className="text-gold hover:text-gold-light">
                    admin@stormwellnessclub.com
                  </a>{" "}
                  ·{" "}
                  <a href="tel:+12482328487" className="text-gold hover:text-gold-light">
                    (248) 232-8487
                  </a>
                </dd>
              </dl>
            </div>

            <p>
              <strong>No third-party sharing.</strong> Mobile opt-in data and consent will not be
              shared with third parties or affiliates for marketing or promotional purposes. See
              our <Link to="/privacy" className="text-gold hover:text-gold-light">Privacy Policy</Link>{" "}
              for details on how SMS data is handled.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">9. Refunds and Credits</h2>
            <p>
              Unless otherwise provided by applicable law, membership fees and service payments are non-refundable. Any credits or refunds are at Storm Fitness's sole discretion.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">10. Facility Use</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>All users must follow posted hours of operation, dress code, and usage policies.</li>
              <li>Users must present a valid membership card or check in appropriately before accessing facilities.</li>
              <li>Storm Fitness is not responsible for lost, stolen, or damaged personal property on our premises.</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">11. Damages Limitation</h2>
            <p>
              To the fullest extent permitted by law, Storm Fitness, SR & D Development LLC, and their respective members, managers, directors, officers, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of our services or facilities. In no event shall our total liability exceed the amount you paid for the specific service or membership fee that gave rise to the claim.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">12. Property Damage</h2>
            <p>
              Users are liable for any damage they cause to Storm Fitness's facilities, equipment, or property. Storm Fitness reserves the right to seek reimbursement for repair or replacement costs.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">13. Third-Party Providers</h2>
            <p>
              Storm Fitness may engage or recommend third-party providers for certain services (e.g., spa treatments, personal training, health assessments). These providers operate independently, and Storm Fitness is not responsible for their acts or omissions.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">14. Intellectual Property</h2>
            <p>
              All content, branding, logos, and materials on our website, in our facilities, or in our communications are the property of Storm Fitness. You may not reproduce, distribute, or create derivative works without prior written consent.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">15. Governing Law</h2>
            <p>
              These Terms and any disputes arising hereunder shall be governed by and construed in accordance with the laws of the State of Michigan, without regard to its conflict of laws principles.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">16. Venue</h2>
            <p>
              Any legal action or proceeding arising out of or relating to these Terms shall be filed exclusively in the state or federal courts located in Wayne County, Michigan. Both parties consent to the personal jurisdiction of such courts.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">17. Jury Trial Waiver</h2>
            <p>
              To the fullest extent permitted by law, you and Storm Fitness each waive the right to a jury trial in any action, proceeding, or counterclaim arising out of or relating to these Terms or any dispute between the parties.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">18. Severability</h2>
            <p>
              If any provision of these Terms is held unenforceable, the remaining provisions shall remain in full force and effect.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">19. Modifications</h2>
            <p>
              Storm Fitness may modify these Terms at any time. Notice of material changes may be provided via email or posted on our website. Continued use of our services after such changes constitutes your acceptance.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">20. Contact</h2>
            <p>For questions about these Terms:</p>
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
