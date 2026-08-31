import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, User, LogOut, LayoutDashboard, CalendarDays, CreditCard, Ticket, FileText, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const navLinks = [
  { href: "/memberships", label: "Memberships" },
  { href: "/classes", label: "Classes" },
  { href: "/reviews", label: "Reviews" },
  { href: "/events", label: "Events" },
  { href: "/personal-training", label: "Personal Training" },
  { href: "/spa", label: "Spa" },
  { href: "/gut-reset", label: "Gut Reset" },
  { href: "/cafe", label: "Café" },
  { href: "/amenities", label: "Amenities" },
  { href: "/class-passes", label: "Class Passes" },
  { href: "/guest-pass", label: "Guest Pass" },
  { href: "/shop", label: "Storm Shop" },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";
  const { user, signOut } = useAuth();

  // Track scroll position for header styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
  };

  const navBackground = isHome
    ? isScrolled
      ? "bg-background/95 backdrop-blur-md border-b border-border shadow-soft"
      : "bg-transparent"
    : "bg-background/95 backdrop-blur-md border-b border-border";

  const linkColor = isHome && !isScrolled
    ? "text-primary-foreground/90 hover:text-gold-light"
    : "text-foreground hover:text-accent";

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 safe-area-inset ${navBackground}`}>
      <div className="container mx-auto container-padding">
        <div className="flex items-center justify-between h-20 sm:h-24">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0 -ml-2 sm:-ml-4 transition-transform duration-300 hover:scale-105 touch-feedback">
            <img
              alt="Storm Wellness Club"
              className="h-20 sm:h-28 w-auto"
              src="/lovable-uploads/da2bfb84-b4c3-4698-8873-616dc85799d4.png"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-6 xl:gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`nav-link ${linkColor} ${
                  location.pathname === link.href ? "text-accent" : ""
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA & Account Button */}
          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={isHome && !isScrolled ? "hero-outline" : "outline"}
                    size="sm"
                    className="gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    My Portal
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem className="text-muted-foreground text-xs">
                    {user.email}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/member" className="cursor-pointer">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      My Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/member/profile" className="cursor-pointer">
                      <User className="w-4 h-4 mr-2" />
                      My Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/member/bookings" className="cursor-pointer">
                      <CalendarDays className="w-4 h-4 mr-2" />
                      My Bookings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/member/credits" className="cursor-pointer">
                      <Ticket className="w-4 h-4 mr-2" />
                      My Credits
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/member/membership" className="cursor-pointer">
                      <CreditCard className="w-4 h-4 mr-2" />
                      My Membership
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/member/payment-methods" className="cursor-pointer">
                      <Wallet className="w-4 h-4 mr-2" />
                      Payment Methods
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/member/waivers" className="cursor-pointer">
                      <FileText className="w-4 h-4 mr-2" />
                      Waivers
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/apply" className="cursor-pointer">
                      Membership Application
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant={isHome && !isScrolled ? "hero-outline" : "outline"} size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/apply">
                  <Button variant={isHome && !isScrolled ? "hero" : "default"} size="sm">
                    Apply for Membership
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 touch-target flex items-center justify-center transition-colors rounded-sm hover:bg-accent/10 touch-feedback"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <X className={`h-6 w-6 ${isHome && !isScrolled ? "text-primary-foreground" : "text-foreground"}`} />
            ) : (
              <Menu className={`h-6 w-6 ${isHome && !isScrolled ? "text-primary-foreground" : "text-foreground"}`} />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        <div
          className={`lg:hidden fixed top-16 sm:top-20 left-0 right-0 bg-background border-b border-border shadow-elevated transition-all duration-300 max-h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-5rem)] overflow-y-auto ${
            isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
          }`}
        >
          <div className="container container-padding py-4 sm:py-6 flex flex-col gap-1 safe-area-bottom">
            {navLinks.map((link, index) => (
              <Link
                key={link.href}
                to={link.href}
                className={`text-sm uppercase tracking-widest font-medium py-3 px-2 rounded-sm transition-all hover:bg-accent/10 hover:text-accent touch-feedback ${
                  location.pathname === link.href ? "text-accent bg-accent/5" : "text-foreground"
                }`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {link.label}
              </Link>
            ))}

            <div className="border-t border-border pt-4 mt-2 space-y-2">
              {user ? (
                <>
                  <p className="text-muted-foreground text-xs mb-3 px-2">{user.email}</p>
                  <Link to="/member" className="block">
                    <Button variant="default" className="w-full justify-start touch-target" size="lg">
                      <LayoutDashboard className="w-5 h-5 mr-3" />
                      My Portal
                    </Button>
                  </Link>
                  <Link to="/member/bookings" className="block">
                    <Button variant="outline" className="w-full justify-start touch-target" size="lg">
                      <CalendarDays className="w-5 h-5 mr-3" />
                      My Bookings
                    </Button>
                  </Link>
                  <Link to="/member/credits" className="block">
                    <Button variant="outline" className="w-full justify-start touch-target" size="lg">
                      <Ticket className="w-5 h-5 mr-3" />
                      My Credits
                    </Button>
                  </Link>
                  <Link to="/member/payment-methods" className="block">
                    <Button variant="outline" className="w-full justify-start touch-target" size="lg">
                      <Wallet className="w-5 h-5 mr-3" />
                      Payment Methods
                    </Button>
                  </Link>
                  <Link to="/apply" className="block">
                    <Button variant="outline" className="w-full justify-start touch-target" size="lg">
                      Membership Application
                    </Button>
                  </Link>
                  <Button variant="destructive" className="w-full justify-start touch-target" size="lg" onClick={handleSignOut}>
                    <LogOut className="w-5 h-5 mr-3" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link to="/auth" className="block">
                    <Button variant="outline" className="w-full touch-target" size="lg">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/apply" className="block">
                    <Button variant="default" className="w-full touch-target" size="lg">
                      Apply for Membership
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
