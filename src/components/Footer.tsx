import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

const footerLinks = {
  services: [
    { label: "Fitness Classes", href: "/classes" },
    { label: "Spa & Wellness", href: "/spa" },
    { label: "Café", href: "/cafe" },
    { label: "Kids Care", href: "/kids-care" },
  ],
  membership: [
    { label: "Apply Now", href: "/apply" },
    { label: "Class Passes", href: "/class-passes" },
    { label: "Member Amenities", href: "/amenities" },
  ],
  info: [
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "FAQ", href: "/faq" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <img src={logo} alt="Storm Wellness Club" className="h-10 w-auto brightness-0 invert mb-6" />
            <p className="text-primary-foreground/70 text-sm leading-relaxed">
              An exclusive wellness sanctuary where luxury meets performance. 
              Experience the storm of transformation.
            </p>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-xs uppercase tracking-widest font-semibold mb-6 text-gold-light">
              Services
            </h4>
            <ul className="space-y-3">
              {footerLinks.services.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Membership */}
          <div>
            <h4 className="text-xs uppercase tracking-widest font-semibold mb-6 text-gold-light">
              Membership
            </h4>
            <ul className="space-y-3">
              {footerLinks.membership.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs uppercase tracking-widest font-semibold mb-6 text-gold-light">
              Contact
            </h4>
            <ul className="space-y-3 text-sm text-primary-foreground/70">
              <li>123 Wellness Boulevard</li>
              <li>Suite 100</li>
              <li>City, State 12345</li>
              <li className="pt-2">
                <a href="tel:+1234567890" className="hover:text-primary-foreground transition-colors">
                  (123) 456-7890
                </a>
              </li>
              <li>
                <a href="mailto:info@stormwellness.com" className="hover:text-primary-foreground transition-colors">
                  info@stormwellness.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-primary-foreground/50">
            © {new Date().getFullYear()} Storm Wellness Club. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link to="/privacy" className="text-xs text-primary-foreground/50 hover:text-primary-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-xs text-primary-foreground/50 hover:text-primary-foreground transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
