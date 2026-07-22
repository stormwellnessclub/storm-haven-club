import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface GuestCheckoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the user is authenticated (signed up or signed in). Resume purchase here. */
  onAuthenticated: () => void;
  /** Optional heading override. */
  title?: string;
  description?: string;
}

/**
 * Inline account creation / sign-in sheet used to unblock guests who click
 * "Buy" on /class-passes without an account. After a successful signup or
 * login, we call onAuthenticated() so the caller can immediately resume
 * the pending purchase — no page reload, no leaving the checkout flow.
 */
export function GuestCheckoutSheet({
  open,
  onOpenChange,
  onAuthenticated,
  title = "Create your account to check out",
  description = "You need a free account so your class pass can be saved to you. Takes 20 seconds.",
}: GuestCheckoutSheetProps) {
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [busy, setBusy] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !phone.trim()) {
          toast.error("Please fill in every field.");
          setBusy(false);
          return;
        }
        const { error } = await signUp(email.trim(), password, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
        });
        if (error) {
          // If the account already exists, guide them to sign in.
          if (/already|registered|exists/i.test(error.message || "")) {
            toast.info("Looks like you already have an account. Please sign in.");
            setMode("signin");
          } else {
            toast.error(error.message || "Could not create account.");
          }
          setBusy(false);
          return;
        }
        toast.success("Account created — continuing to checkout…");
        onOpenChange(false);
        // Give AuthContext a tick to hydrate the new user before we invoke edge fns
        setTimeout(() => onAuthenticated(), 400);
      } else {
        if (!email.trim() || !password) {
          toast.error("Enter your email and password.");
          setBusy(false);
          return;
        }
        const { error } = await signIn(email.trim(), password);
        if (error) {
          toast.error(error.message || "Sign-in failed.");
          setBusy(false);
          return;
        }
        toast.success("Welcome back — continuing to checkout…");
        onOpenChange(false);
        setTimeout(() => onAuthenticated(), 400);
      }
    } finally {
      // busy stays true until sheet closes to avoid double-submit
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto sm:max-w-md sm:mx-auto sm:rounded-t-xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-serif text-2xl">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          {mode === "signup" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="gc-first">First name</Label>
                  <Input id="gc-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                </div>
                <div>
                  <Label htmlFor="gc-last">Last name</Label>
                  <Input id="gc-last" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                </div>
              </div>
              <div>
                <Label htmlFor="gc-phone">Mobile phone</Label>
                <Input id="gc-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="(313) 555-0100" />
              </div>
            </>
          )}
          <div>
            <Label htmlFor="gc-email">Email</Label>
            <Input id="gc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="gc-pass">Password</Label>
            <Input
              id="gc-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
            />
          </div>

          <Button type="submit" className="w-full h-11 mt-2" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signup" ? "Create account & continue" : "Sign in & continue"}
          </Button>

          <div className="text-center text-xs text-muted-foreground pt-1">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button type="button" className="text-gold underline" onClick={() => setMode("signin")}>
                  Sign in
                </button>
              </>
            ) : (
              <>
                New here?{" "}
                <button type="button" className="text-gold underline" onClick={() => setMode("signup")}>
                  Create an account
                </button>
              </>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground pt-2 text-center">
            After your account is ready you'll sign the standard class waiver and go straight to secure Stripe checkout.
          </p>
        </form>
      </SheetContent>
    </Sheet>
  );
}
