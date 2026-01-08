import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";

export default function Privacy() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-display font-bold">Privacy Policy</h1>
          <p className="text-primary-foreground/70 mt-4">Effective Date: January 6, 2025</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto prose prose-lg prose-neutral dark:prose-invert">
          <p className="lead text-xl text-muted-foreground mb-12">
            This Privacy Policy describes how Storm Wellness Club collects, uses, and protects your personal information.
          </p>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">1. Parties and Scope</h2>
            <p>
              <strong>Operating Entity:</strong> Storm Wellness Club ("Storm," "we," "us," or "our") is owned and operated by SR & D Development LLC ("SR & D Development"). This Privacy Policy applies to all services, facilities, and programs offered by Storm.
            </p>
            <p>
              <strong>User:</strong> "You" or "User" refers to any individual who accesses our website, uses our services, or provides personal information to us.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">2. Information We Collect</h2>
            <p>We may collect the following types of information:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Personal Information:</strong> Name, email address, phone number, home address, date of birth, and emergency contact information.</li>
              <li><strong>Payment Information:</strong> Credit/debit card details or other payment details necessary to process membership fees and purchases.</li>
              <li><strong>Health & Fitness Data:</strong> Any fitness goals, health history, or medical information you voluntarily provide to help tailor our services.</li>
              <li><strong>Usage Data:</strong> Information about how you interact with our website, facilities, and services (e.g., class attendance, facility usage).</li>
              <li><strong>Communications:</strong> Records of your communications with us, including emails and any feedback or inquiries.</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">3. How We Use Information</h2>
            <p>We may use your information to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide, manage, and improve our services and facilities.</li>
              <li>Process payments and maintain membership records.</li>
              <li>Communicate with you about your membership, account, and services.</li>
              <li>Send promotional materials or updates (you may opt out at any time).</li>
              <li>Comply with legal requirements and protect our rights.</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">4. Disclosure of Data</h2>
            <p>We may share your personal data with:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Service Providers:</strong> Third-party vendors who assist with payment processing, IT services, marketing, and other operational needs.</li>
              <li><strong>Legal Authorities:</strong> Law enforcement or regulatory agencies when required by law or to protect our rights and safety.</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, your data may be transferred as part of the transaction.</li>
            </ul>
            <p>We do not sell your personal information to third parties for their marketing purposes.</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">5. SR & D Development LLC Liability Limitation</h2>
            <p>
              SR & D Development is responsible for Storm's data handling practices. However, to the fullest extent permitted by law, SR & D Development shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of any data breach, unauthorized access, or other security incident. Users acknowledge that no data transmission or storage system can be guaranteed 100% secure.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">6. Data Security</h2>
            <p>
              We use reasonable administrative, technical, and physical safeguards to protect your personal information. However, we cannot guarantee the absolute security of your data.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">7. Data Retention</h2>
            <p>
              We retain personal information for as long as necessary to fulfill the purposes outlined in this Policy, unless a longer retention period is required or permitted by law.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">8. Minors</h2>
            <p>
              Our services are generally intended for adults. If we become aware that we have collected personal information from a child under 16 without parental consent, we will take steps to delete such information.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">9. User Rights</h2>
            <p>Depending on applicable law, you may have rights including:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Access:</strong> Request a copy of your personal data.</li>
              <li><strong>Correction:</strong> Request correction of inaccurate data.</li>
              <li><strong>Deletion:</strong> Request deletion of your data, subject to legal retention requirements.</li>
              <li><strong>Opt-Out:</strong> Opt out of marketing communications.</li>
            </ul>
            <p>
              To exercise any rights, please contact us using the information provided below.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">10. Third-Party Links</h2>
            <p>
              Our website or services may link to external sites. We are not responsible for the privacy practices of these third-party sites.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">11. No Medical Services / No Health Claims</h2>
            <p>
              Storm does not provide medical services, medical advice, or healthcare treatment. Information related to health and wellness is for general informational purposes only and should not replace advice from a qualified healthcare provider.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">12. Policy Modifications</h2>
            <p>
              We may update this Privacy Policy periodically. Material changes will be communicated via email or through our website. Continued use of our services after changes constitutes your acceptance of the updated Policy.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">13. Governing Law and Venue</h2>
            <p>
              This Privacy Policy shall be governed by and construed in accordance with the laws of the State of Michigan, without regard to its conflict of laws principles. Any disputes shall be resolved exclusively in the state or federal courts located in Wayne County, Michigan.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">14. Cookies and Tracking Technologies</h2>
            <p>We use cookies and similar tracking technologies to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Remember your preferences and settings</li>
              <li>Analyze website traffic and usage patterns</li>
              <li>Improve our website and services</li>
              <li>Deliver targeted advertising</li>
            </ul>
            <p>
              You can manage cookie preferences through your browser settings. However, disabling cookies may affect the functionality of our website.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-display font-semibold mb-4">15. Contact Information</h2>
            <p>For questions or concerns about this Privacy Policy or our data practices:</p>
            <address className="not-italic">
              <strong>Storm Wellness Club</strong><br />
              Operated by SR & D Development LLC<br />
              18340 Middlebelt Rd<br />
              Livonia, MI 48127<br />
              Email: <a href="mailto:admin@stormwellnessclub.com" className="text-gold hover:text-gold-light">admin@stormwellnessclub.com</a><br />
              Phone: <a href="tel:+13132865070" className="text-gold hover:text-gold-light">(313) 286-5070</a>
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
