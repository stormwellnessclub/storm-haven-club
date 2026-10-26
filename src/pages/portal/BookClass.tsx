import { useState } from "react";
import { Link } from "react-router-dom";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { ScheduleBrowser } from "@/components/booking/ScheduleBrowser";
import { CreditsStrip } from "@/components/booking/CreditsStrip";
import { BuyPassesDrawer } from "@/components/booking/BuyPassesDrawer";
import { Button } from "@/components/ui/button";
import { CancellationPolicyLink } from "@/components/booking/CancellationPolicyText";
import { ChevronLeft } from "lucide-react";

export default function PortalBookClass() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <PortalLayout title="Book a class">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/portal/book">
              <ChevronLeft className="h-4 w-4 mr-1" /> Book
            </Link>
          </Button>
          <CancellationPolicyLink />
        </div>

        <CreditsStrip onBuyMore={() => setDrawerOpen(true)} detailsPath="/portal/passes" />

        <ScheduleBrowser embedded authRedirect="/portal/book/class" />
      </div>

      <BuyPassesDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        returnPath="/portal/book/class"
      />
    </PortalLayout>
  );
}
