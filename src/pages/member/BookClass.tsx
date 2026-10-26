import { useState } from "react";
import { Link } from "react-router-dom";
import { MemberLayout } from "@/components/member/MemberLayout";
import { ScheduleBrowser } from "@/components/booking/ScheduleBrowser";
import { CreditsStrip } from "@/components/booking/CreditsStrip";
import { BuyPassesDrawer } from "@/components/booking/BuyPassesDrawer";
import { Button } from "@/components/ui/button";
import { CancellationPolicyLink } from "@/components/booking/CancellationPolicyText";
import { ChevronLeft } from "lucide-react";

/**
 * Book Class — one-stop page where members & non-members can:
 *   • see their current class balance (member credits + class passes)
 *   • buy more passes via inline drawer (no leaving the page)
 *   • browse the weekly schedule and book
 */
export default function MemberBookClass() {
  const [drawerOpen, setDrawerOpen] = useState(false);

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
