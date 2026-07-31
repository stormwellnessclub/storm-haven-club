import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Public confirmation page shown after someone saves a card via an
 * admin-generated Stripe card-setup link. Intentionally requires no login.
 */
export default function CardAdded() {
  const params = new URLSearchParams(window.location.search);
  const cancelled = params.get("status") === "cancelled";

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 px-6 py-16">
      <SEOHead
        title={cancelled ? "Card setup cancelled" : "Card saved"}
        description="Securely save a payment method on file with Storm Wellness Club."
        path="/card-added"
      />
      <Card className="w-full max-w-md">
        <CardContent className="pt-10 pb-8 text-center space-y-4">
          {cancelled ? (
            <>
              <h1 className="font-serif text-2xl">Card setup cancelled</h1>
              <p className="text-muted-foreground text-sm">
                No card was saved. You can reopen the link we sent you any time, or ask our
                front desk for a new one.
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-12 w-12 mx-auto text-accent" />
              <h1 className="font-serif text-2xl">Card saved</h1>
              <p className="text-muted-foreground text-sm">
                Thank you — your payment method is securely on file with Storm Wellness Club.
                You can close this page. Your card will only be charged for services you book
                or purchase.
              </p>
            </>
          )}
          <Button asChild variant="outline" className="mt-2">
            <Link to="/">Return to Storm Wellness Club</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
