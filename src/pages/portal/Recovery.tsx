import { useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const recoveryServices = [
  {
    name: "Red Light Therapy",
    description: "Full-body red light therapy session for recovery, skin health, and inflammation reduction.",
    duration: "20 min",
    price: "$28",
    serviceKey: "rlt20",
  },
  {
    name: "Dry Cryo",
    description: "Whole-body cryotherapy session to reduce muscle soreness and boost recovery.",
    duration: "3 min",
    price: "$45",
    serviceKey: "cryo",
  },
];

export default function PortalRecovery() {
  const [loadingService, setLoadingService] = useState<string | null>(null);

  const handleBookSession = async (serviceKey: string) => {
    setLoadingService(serviceKey);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { action: "create_recovery_checkout", serviceName: serviceKey },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("No checkout URL returned");

      window.location.href = data.url;
    } catch (err) {
      console.error("Recovery checkout error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
      setLoadingService(null);
    }
  };

  return (
    <PortalLayout title="Recovery Booking">
      <div className="max-w-3xl space-y-6">
        <div>
          <h2 className="heading-section">Recovery Services</h2>
          <p className="text-muted-foreground mt-1">
            Book a recovery session. Payment is charged per session.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {recoveryServices.map((service) => (
            <Card key={service.serviceKey}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-accent" />
                  {service.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{service.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{service.duration}</span>
                  <span className="font-semibold">{service.price}</span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleBookSession(service.serviceKey)}
                  disabled={loadingService === service.serviceKey}
                >
                  {loadingService === service.serviceKey ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                  ) : (
                    "Book Session"
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
