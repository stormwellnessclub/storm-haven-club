import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function GutResetSuccess() {
  const [params] = useSearchParams();
  const stripeSessionId = params.get("session_id");
  const [state, setState] = useState<"loading" | "paid" | "error">("loading");
  const [option, setOption] = useState<string | null>(null);

  useEffect(() => {
    if (!stripeSessionId) {
      setState("error");
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("gut-reset-verify-payment", {
          body: { stripe_session_id: stripeSessionId },
        });
        if (error || data?.error) throw new Error(error?.message || data?.error);
        if (data?.status === "paid") {
          setOption(data.option);
          setState("paid");
        } else {
          setState("error");
        }
      } catch {
        setState("error");
      }
    })();
  }, [stripeSessionId]);

  return (
    <Layout>
      <SEOHead title="Reservation Confirmed | Storm Wellness Club" canonical="/gut-reset/success" />
      <section className="py-24">
        <div className="container mx-auto px-6 max-w-xl">
          <Card className="p-10 text-center">
            {state === "loading" && (
              <>
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Confirming your payment…</p>
              </>
            )}
            {state === "paid" && (
              <>
                <CheckCircle2 className="h-14 w-14 mx-auto mb-4 text-emerald-600" />
                <h1 className="font-serif text-3xl mb-3">You're in!</h1>
                <p className="text-muted-foreground mb-6">
                  Your spot in the {option === "3day" ? "3-Day" : "5-Day"} Gut Reset is reserved.
                  We'll be in touch with pickup details and any prep instructions before your start date.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button asChild>
                    <Link to="/gut-reset">Back to Gut Reset</Link>
                  </Button>
                </div>
              </>
            )}
            {state === "error" && (
              <>
                <XCircle className="h-14 w-14 mx-auto mb-4 text-destructive" />
                <h1 className="font-serif text-2xl mb-3">We couldn't confirm your payment</h1>
                <p className="text-muted-foreground mb-6">
                  If you were charged, please contact us and we'll resolve it right away.
                </p>
                <Button asChild variant="outline">
                  <Link to="/gut-reset">Back to Gut Reset</Link>
                </Button>
              </>
            )}
          </Card>
        </div>
      </section>
    </Layout>
  );
}
