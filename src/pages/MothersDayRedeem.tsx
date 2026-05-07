import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Heart, Copy, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";


export default function MothersDayRedeem() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [code, setCode] = useState(params.get("code") || "");
  const [loading, setLoading] = useState(false);
  const [voucher, setVoucher] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (c: string) => {
    setLoading(true);
    setError(null);
    setVoucher(null);
    try {
      const { data, error } = await supabase.rpc("lookup_mothers_day_voucher", { p_code: c.trim() });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        setError(result?.error || "Voucher not found");
      } else {
        setVoucher(result);
      }
    } catch (e: any) {
      setError(e.message || "Could not look up voucher");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.get("code")) lookup(params.get("code")!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <SEOHead title="Redeem your Mother's Day Gift" description="Redeem your Mother's Day Special voucher at Storm Wellness Club." path="/mothers-day/redeem" />
      <section className="min-h-[80vh] py-20" style={{ background: "#ece2d2" }}>
        <div className="container mx-auto px-6 max-w-xl">
          <div className="text-center mb-8">
            <Heart className="w-10 h-10 mx-auto mb-3" style={{ color: "#a17e3a" }} />
            <h1 className="font-serif text-4xl mb-2" style={{ color: "#a17e3a" }}>Redeem Your Gift</h1>
            <p style={{ color: "#6b5a3b" }}>Enter your Mother's Day voucher code to get started.</p>
          </div>

          <Card className="p-6 space-y-4" style={{ borderColor: "#c9a86a" }}>
            <div className="flex gap-2">
              <Input
                placeholder="MOM-XXXXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono tracking-widest"
              />
              <Button
                onClick={() => lookup(code)}
                disabled={!code.trim() || loading}
                style={{ background: "#a17e3a", color: "#fff" }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Look up"}
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {voucher && (
              <div className="space-y-4 pt-3 border-t">
                <div>
                  <div className="text-xs tracking-[3px]" style={{ color: "#a17e3a" }}>YOUR GIFT</div>
                  <div className="font-serif text-xl mt-1" style={{ color: "#1c170f" }}>
                    {voucher.massage_choice} · {voucher.massage_duration} min
                  </div>
                  <div className="text-sm" style={{ color: "#6b5a3b" }}>
                    + Wet Spa Access · Sauna · Steam · Salt Room
                  </div>
                </div>

                <div className="p-3 rounded flex items-center justify-between" style={{ background: "#fff", border: "1px dashed #c9a86a" }}>
                  <div>
                    <div className="text-[10px] tracking-[3px]" style={{ color: "#a17e3a" }}>CODE</div>
                    <div className="font-mono text-lg tracking-widest">{voucher.code || code}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(voucher.code || code); toast.success("Copied"); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>

                <div className="text-sm" style={{ color: "#6b5a3b" }}>
                  Status: <strong>{voucher.status}</strong>
                  {voucher.expires_at && <> · Expires {format(new Date(voucher.expires_at), "MMM d, yyyy")}</>}
                </div>

                <p className="text-xs italic" style={{ color: "#6b5a3b" }}>
                  Non-transferable. Valid only for the named recipient.
                </p>

                {user && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: "#2d6a4f" }}>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Linked to your account ({user.email})</span>
                  </div>
                )}

                {voucher.status === "active" && (
                  <div className="pt-2 border-t" style={{ borderColor: "#c9a86a" }}>
                    <WalletButtons code={voucher.code || code} />
                  </div>
                )}

                {voucher.status === "active" ? (
                  <div className="space-y-3 pt-2">
                    {user ? (
                      <Button className="w-full" onClick={() => navigate(`/spa?category=Massage&voucher=${encodeURIComponent(voucher.code || code)}`)} style={{ background: "#a17e3a", color: "#fff" }}>
                        Book your massage <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    ) : (
                      <>
                        <Button className="w-full" asChild style={{ background: "#a17e3a", color: "#fff" }}>
                          <Link to={`/auth?redirect=/mothers-day/redeem?code=${encodeURIComponent(voucher.code || code)}`}>
                            Sign in to book online
                          </Link>
                        </Button>
                        <p className="text-xs text-center" style={{ color: "#6b5a3b" }}>
                          Or call us / visit the front desk and mention your code — we'll book it for you.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-sm italic" style={{ color: "#6b5a3b" }}>
                    This voucher is currently <strong>{voucher.status}</strong>. Please call us if you have questions.
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      </section>
    </Layout>
  );
}
