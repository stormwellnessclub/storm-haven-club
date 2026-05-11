import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MemberLayout } from "@/components/member/MemberLayout";
import { ScheduleBrowser } from "@/components/booking/ScheduleBrowser";
import { CreditsStrip } from "@/components/booking/CreditsStrip";
import { BuyPassesDrawer } from "@/components/booking/BuyPassesDrawer";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Book Class — one-stop page where members & non-members can:
 *   • see their current class balance (member credits + class passes)
 *   • buy more passes via inline drawer (no leaving the page)
 *   • browse the weekly schedule and book
 */
export default function MemberBookClass() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Handle return from Stripe checkout
  useEffect(() => {
    const purchase = searchParams.get("purchase");
    const sessionId = searchParams.get("session_id");
    if (purchase === "success" || sessionId) {
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      if (sessionId) {
        supabase.functions
          .invoke("class-pass-confirm", { body: { session_id: sessionId } })
          .then(({ data }: any) => {
            if (data?.success && data?.paid) {
              toast.success("Class pass purchased! Your balance has been updated.");
            } else {
              toast.success("Class pass purchased!");
            }
          })
          .catch(() => toast.success("Class pass purchased!"));
      } else {
        toast.success("Class pass purchased! Your balance has been updated.");
      }
      setSearchParams({}, { replace: true });
    } else if (purchase === "cancelled") {
      toast.info("Purchase cancelled — you can pick a pass anytime.");
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MemberLayout title="Book a class">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/member/book">
              <ChevronLeft className="h-4 w-4 mr-1" /> Book
            </Link>
          </Button>
          <CancellationPolicyLink />
        </div>

        <CreditsStrip onBuyMore={() => setDrawerOpen(true)} />

        <ScheduleBrowser embedded authRedirect="/member/book/class" />
      </div>

      <BuyPassesDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        returnPath="/member/book/class"
      />
    </MemberLayout>
  );
}
