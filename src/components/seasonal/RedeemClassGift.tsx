import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chapter } from "@/components/editorial/Editorial";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Result = { success: boolean; error?: string; offer?: string; classes?: number; expires_at?: string; day_pass?: boolean };

/** Recipients of a Seasonal Edit class gift enter their code here; the classes go straight to their account. */
export function RedeemClassGift() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const c = params.get("redeem");
    if (c) setCode(c.toUpperCase());
  }, [params]);

  const back = `/seasonal-edit${code ? `?redeem=${encodeURIComponent(code)}` : ""}#redeem`;

  async function redeem() {
    if (!code.trim()) return;
    setBusy(true);
    setResult(null);
    const { data, error } = await supabase.rpc("redeem_class_gift_card" as never, { _code: code.trim() } as never);
    setBusy(false);
    setResult(error ? { success: false, error: error.message } : (data as unknown as Result));
  }

  return (
    <section id="redeem" className="container py-14 md:py-20 max-w-3xl scroll-mt-24 border-t border-border">
      <Chapter n="—" label="Received a class gift?" />
      <h2 className="font-serif text-3xl md:text-4xl mt-4">Redeem your classes</h2>
      <p className="mt-4 text-muted-foreground">Enter the code from your gift email. The classes are added to your account, and their validity starts today.</p>
      {result?.success ? (
        <div className="mt-6 border border-border p-5">
          <p className="font-medium">{result.offer} is in your account.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.classes} classes{result.day_pass ? " and your club day pass" : ""}, valid through{" "}
            {result.expires_at ? new Date(result.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Detroit" }) : ""}.
          </p>
          <Button asChild className="mt-4"><Link to="/schedule">Book a class</Link></Button>
        </div>
      ) : !user ? (
        <p className="mt-6 text-sm text-muted-foreground">
          <Link to={`/auth?redirect=${encodeURIComponent(back)}`} className="underline underline-offset-4 text-foreground">Sign in</Link> or{" "}
          <Link to={`/auth?mode=signup&redirect=${encodeURIComponent(back)}`} className="underline underline-offset-4 text-foreground">make an account</Link> to redeem your gift.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Gift code" aria-label="Gift code" className="font-mono tracking-widest sm:max-w-xs" />
          <Button onClick={redeem} disabled={busy || !code.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Redeem"}</Button>
        </div>
      )}
      {result && !result.success && <p className="mt-3 text-sm text-destructive">{result.error}</p>}
    </section>
  );
}
