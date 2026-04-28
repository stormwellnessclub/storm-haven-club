import { useState } from "react";
import { KioskShell } from "@/components/kiosk/KioskShell";
import { BareAdminLayoutProvider } from "@/components/admin/BareAdminLayoutContext";
import { Button } from "@/components/ui/button";
import CafePOS from "@/pages/admin/CafePOS";
import CafeMenuManager from "@/pages/admin/CafeMenuManager";

type Tab = "orders" | "menu";

export default function KioskCafe() {
  const [tab, setTab] = useState<Tab>("orders");

  return (
    <KioskShell label="Cafe • Orders & POS" mode="cafe">
      <div className="border-b bg-card">
        <div className="px-4 py-2 flex items-center gap-2">
          <Button
            size="sm"
            variant={tab === "orders" ? "default" : "outline"}
            onClick={() => setTab("orders")}
          >
            Orders & POS
          </Button>
          <Button
            size="sm"
            variant={tab === "menu" ? "default" : "outline"}
            onClick={() => setTab("menu")}
          >
            Menu Management
          </Button>
        </div>
      </div>

      <BareAdminLayoutProvider>
        {tab === "orders" ? <CafePOS /> : <CafeMenuManager />}
      </BareAdminLayoutProvider>
    </KioskShell>
  );
}
