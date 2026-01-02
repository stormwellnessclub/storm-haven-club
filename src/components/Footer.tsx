import { Link } from "react-router-dom";
import logo from "@/assets/storm-logo-gold.png";

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
};

const clubHours = [
  { days: "Monday - Thursday", hours: "5:30 AM - 11:00 PM" },
  { days: "Friday", hours: "5:30 AM - 8:00 PM" },
  { days: "Saturday - Sunday", hours: "7:00 AM - 7:00 PM" },
];

const kidsCareHours = [
  { days: "Monday - Friday", hours: "8:00 AM - 8:00 PM" },
  { days: "Saturday - Sunday", hours: "8:00 AM - 5:00 PM" },
];

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <img src={logo} alt="Storm Wellness Club" className="h-10 w-auto mb-6" />
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

          {/* Hours */}
          <div>
            <h4 className="text-xs uppercase tracking-widest font-semibold mb-6 text-gold-light">
              Hours
            </h4>
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-primary-foreground/50 mb-2">Club Hours</p>
                <ul className="space-y-1 text-sm text-primary-foreground/70">
                  {clubHours.map((item) => (
                    <li key={item.days} className="flex justify-between gap-4">
                      <span>{item.days}</span>
                      <span className="text-primary-foreground/90">{item.hours}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-primary-foreground/50 mb-2">Kids Care</p>
                <ul className="space-y-1 text-sm text-primary-foreground/70">
                  {kidsCareHours.map((item) => (
                    <li key={item.days} className="flex justify-between gap-4">
                      <span>{item.days}</span>
                      <span className="text-primary-foreground/90">{item.hours}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs uppercase tracking-widest font-semibold mb-6 text-gold-light">
              Contact
            </h4>
            <ul className="space-y-3 text-sm text-primary-foreground/70">
              <li>18340 Middlebelt Rd</li>
              <li>Livonia, MI 48127</li>
              <li className="pt-2">
                <a href="tel:+13132865070" className="hover:text-primary-foreground transition-colors">
                  (313) 286-5070
                </a>
              </li>
              <li>
                <a href="mailto:admin@stormwellnessclub.com" className="hover:text-primary-foreground transition-colors">
                  admin@stormwellnessclub.com
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
            <Link to="/faq" className="text-xs text-primary-foreground/50 hover:text-primary-foreground transition-colors">
              FAQ
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
