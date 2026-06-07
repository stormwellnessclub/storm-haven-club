import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Check } from "lucide-react";
import {
  SMS_DISCLOSURE_TEXT,
  SMS_DISCLOSURE_VERSION,
} from "@/components/SmsConsentCheckbox";

/**
 * Public homepage SMS lead capture.
 * Writes to public.sms_marketing_leads (anon INSERT allowed).
 */
export function SmsSignupSection() {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const normalizePhone = (raw: string) => raw.replace(/[^\d+]/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizePhone(phone);
    if (clean.length < 10) {
      toast.error("Please enter a valid phone number.");
      return;
    }
    if (!consent) {
      toast.error("Please agree to receive text messages.");
      return;
    }

    setSubmitting(true);
    const { error } = await (supabase.from("sms_marketing_leads") as any).insert({
      phone: clean,
      email: email.trim() || null,
      source: "homepage",
      consent_given: true,
      consent_version: SMS_DISCLOSURE_VERSION,
      user_agent: navigator.userAgent,
    });
    setSubmitting(false);

    if (error) {
      toast.error(`Could not subscribe: ${error.message}`);
      return;
    }

    setDone(true);
    toast.success("You're on the list. Check your phone shortly.");
  };

  return (
    <section className="relative py-20 bg-secondary/30 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <p className="text-accent text-xs uppercase tracking-widest mb-3 font-medium">
            Stay Connected
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl mb-4 text-foreground">
            Never miss a class drop.
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Get text alerts for new class releases, special events, member-only
            offers, and time-sensitive announcements from Storm Wellness Club.
          </p>
        </div>

        {done ? (
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-6 text-center">
            <Check className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="font-medium">You're all set.</p>
            <p className="text-sm text-muted-foreground mt-1">
              We'll text you when there's something worth knowing.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sms-phone" className="text-xs">
                  Mobile number *
                </Label>
                <Input
                  id="sms-phone"
                  type="tel"
                  inputMode="tel"
                  required
                  placeholder="(123) 456-7890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="sms-email" className="text-xs">
                  Email (optional)
                </Label>
                <Input
                  id="sms-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-border/60 bg-background/60 p-3">
              <Checkbox
                id="sms-marketing-consent"
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="sms-marketing-consent"
                className="text-xs leading-relaxed font-normal cursor-pointer"
              >
                {SMS_DISCLOSURE_TEXT}
              </Label>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
              <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto">
                <MessageSquare className="h-4 w-4 mr-2" />
                {submitting ? "Subscribing..." : "Text me alerts"}
              </Button>
              <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto">
                <Link to="/apply">Or apply for membership</Link>
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
