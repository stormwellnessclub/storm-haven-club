import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/storm-logo-gold.png";

const navLinks = [
  { href: "/classes", label: "Classes" },
  { href: "/spa", label: "Spa" },
  { href: "/cafe", label: "Café" },
  { href: "/amenities", label: "Amenities" },
  { href: "/kids-care", label: "Kids Care" },
  { href: "/class-passes", label: "Class Passes" },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isHome ? "bg-transparent" : "bg-background/95 backdrop-blur-md border-b border-border"
    }`}>
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <img 
              src={logo} 
              alt="Storm Wellness Club" 
              className="h-16 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`text-xs uppercase tracking-widest font-medium transition-colors hover:text-accent ${
                  isHome ? "text-primary-foreground/90 hover:text-gold-light" : "text-foreground"
                } ${location.pathname === link.href ? "text-accent" : ""}`}
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
                  <Button variant={isHome ? "hero-outline" : "outline"} size="sm" className="gap-2">
                    <User className="w-4 h-4" />
                    Account
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="text-muted-foreground text-xs">
                    {user.email}
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
                  <Button variant={isHome ? "hero-outline" : "outline"} size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/apply">
                  <Button variant={isHome ? "hero" : "default"} size="sm">
                    Apply for Membership
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <X className={`h-6 w-6 ${isHome ? "text-primary-foreground" : "text-foreground"}`} />
            ) : (
              <Menu className={`h-6 w-6 ${isHome ? "text-primary-foreground" : "text-foreground"}`} />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="lg:hidden absolute top-20 left-0 right-0 bg-background/98 backdrop-blur-md border-b border-border animate-slide-in">
            <div className="container px-6 py-6 flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`text-sm uppercase tracking-widest font-medium py-2 transition-colors hover:text-accent ${
                    location.pathname === link.href ? "text-accent" : "text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              
              <div className="border-t border-border pt-4 mt-2">
                {user ? (
                  <>
                    <p className="text-muted-foreground text-xs mb-3">{user.email}</p>
                    <Link to="/apply" onClick={() => setIsOpen(false)}>
                      <Button variant="outline" className="w-full mb-2">
                        Membership Application
                      </Button>
                    </Link>
                    <Button 
                      variant="destructive" 
                      className="w-full"
                      onClick={() => {
                        handleSignOut();
                        setIsOpen(false);
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/auth" onClick={() => setIsOpen(false)}>
                      <Button variant="outline" className="w-full mb-2">
                        Sign In
                      </Button>
                    </Link>
                    <Link to="/apply" onClick={() => setIsOpen(false)}>
                      <Button variant="default" className="w-full">
                        Apply for Membership
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
