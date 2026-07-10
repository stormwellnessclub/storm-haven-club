import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Gift, Check, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";

const GOLD = "#a17e3a";
const TAN = "#c9a86a";
const BG = "#ece2d2";
const TEXT = "#6b5a3b";

type LookupResult = {
  found: boolean;
  pass_id?: string;
  classes_remaining?: number;
  classes_total?: number;
  expires_at?: string;
  gift_buyer_name?: string;
  claimed?: boolean;
  status?: string;
};

export default function MothersDayPackRedeem() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const emailParam = (params.get("email") || "").trim().toLowerCase();

  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!emailParam) { setLoading(false); return; }
      try {
        const { data } = await supabase.functions.invoke("mothers-day-pack-lookup", {
          body: { email: emailParam },
        });
        if (mounted) setLookup(data || { found: false });
      } catch {
        if (mounted) setLookup({ found: false });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [emailParam]);

  const userEmail = (user?.email || "").trim().toLowerCase();
  const emailMatches = userEmail && emailParam && userEmail === emailParam;

  const handleClaim = async () => {
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(`/mothers-day-pack-redeem?email=${emailParam}`)}&prefill_email=${encodeURIComponent(emailParam)}`);
      return;
    }
    if (!emailMatches) {
      toast.error("Please sign in with the email address the gift was sent to.");
      return;
    }
    setClaiming(true);
    try {
      const { data, error } = await supabase.rpc("claim_mothers_day_pack", { _email: emailParam });
      if (error) throw error;
      const count = Array.isArray(data) ? data[0]?.claimed_count : (data as any)?.claimed_count;
      if (count && count > 0) {
        setClaimed(true);
        toast.success("Your gift has been claimed!");
      } else {
        // Likely already claimed — treat as success
        setClaimed(true);
      }
    } catch (e: any) {
      toast.error(e.message || "Could not claim gift");
    } finally {
      setClaiming(false);
    }
  };

  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";

  return (
    <>
      <SEOHead
        title="Claim Your Mother's Day Gift"
        description="Redeem your Mother's Day Class Pack at Storm Wellness Club in Livonia, MI — Reformer Pilates, cycling, and yoga classes."
        path="/mothers-day-pack-redeem"
      />
      <div style={{ background: BG, minHeight: "100vh" }} className="py-16 px-6">
        <div className="max-w-xl mx-auto">
          <Card className="p-10" style={{ background: "#fff", borderColor: TAN, borderWidth: 2 }}>
            {loading || authLoading ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: GOLD }} />
                <p style={{ color: TEXT }}>Looking up your gift…</p>
              </div>
            ) : !emailParam ? (
              <div className="text-center">
                <Gift className="w-10 h-10 mx-auto mb-3" style={{ color: GOLD }} />
                <h1 className="font-serif text-3xl mb-3" style={{ color: GOLD }}>Claim Your Gift</h1>
                <p style={{ color: TEXT }} className="mb-6">
                  Open the redemption link from your gift email to claim your Mother's Day Class Pack.
                </p>
                <Button asChild style={{ background: GOLD }}>
                  <Link to="/">Back to home</Link>
                </Button>
              </div>
            ) : !lookup?.found ? (
              <div className="text-center">
                <Heart className="w-10 h-10 mx-auto mb-3" style={{ color: GOLD }} />
                <h1 className="font-serif text-3xl mb-3" style={{ color: GOLD }}>We couldn't find a gift</h1>
                <p style={{ color: TEXT }} className="mb-2">
                  No Mother's Day Class Pack is on file for <strong>{emailParam}</strong>.
                </p>
                <p style={{ color: TEXT }} className="text-sm mb-6">
                  Double-check the email address or contact us if you need help.
                </p>
                <Button asChild variant="outline" style={{ borderColor: TAN, color: GOLD }}>
                  <Link to="/class-passes">View Class Passes</Link>
                </Button>
              </div>
            ) : claimed || (lookup.claimed && emailMatches) ? (
              <div className="text-center">
                <Check className="w-10 h-10 mx-auto mb-3" style={{ color: GOLD }} />
                <h1 className="font-serif text-3xl mb-3" style={{ color: GOLD }}>Your pass is ready</h1>
                <p style={{ color: TEXT }} className="mb-2">
                  {lookup.classes_remaining} of {lookup.classes_total} classes remaining.
                </p>
                <p style={{ color: TEXT }} className="text-sm mb-6">
                  Valid through {fmtDate(lookup.expires_at)}.
                </p>
                <Button asChild size="lg" style={{ background: GOLD }}>
                  <Link to="/schedule">Book a Class</Link>
                </Button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-xs tracking-[0.4em] mb-2" style={{ color: GOLD }}>
                  A GIFT FROM {(lookup.gift_buyer_name || "A FRIEND").toUpperCase()}
                </p>
                <h1 className="font-serif text-3xl mb-3" style={{ color: GOLD }}>
                  Happy Mother's Day!
                </h1>
                <p style={{ color: TEXT }} className="mb-2">
                  You've been gifted a <strong>10-Class Pack</strong> at Storm Wellness Club —
                  Reformer Pilates, Cycling and other studio classes.
                </p>
                <p style={{ color: TEXT }} className="text-sm mb-6">
                  Valid through <strong>{fmtDate(lookup.expires_at)}</strong>.
                </p>

                {!user ? (
                  <>
                    <Button onClick={handleClaim} size="lg" className="w-full" style={{ background: GOLD }}>
                      Create account & claim
                    </Button>
                    <p className="text-xs mt-3" style={{ color: TEXT }}>
                      Use <strong>{emailParam}</strong> when you sign up — your pass will link automatically.
                    </p>
                  </>
                ) : !emailMatches ? (
                  <>
                    <p className="text-sm mb-4" style={{ color: TEXT }}>
                      You're signed in as <strong>{userEmail}</strong>. This gift was sent to{" "}
                      <strong>{emailParam}</strong>. Sign out and sign in (or sign up) with that email to claim.
                    </p>
                    <Button
                      onClick={async () => {
                        await supabase.auth.signOut({ scope: "local" });
                        navigate(`/auth?redirect=${encodeURIComponent(`/mothers-day-pack-redeem?email=${emailParam}`)}&prefill_email=${encodeURIComponent(emailParam)}`);
                      }}
                      style={{ background: GOLD }}
                    >
                      Sign out & continue
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleClaim} disabled={claiming} size="lg" className="w-full" style={{ background: GOLD }}>
                    {claiming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Claim my gift
                  </Button>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
