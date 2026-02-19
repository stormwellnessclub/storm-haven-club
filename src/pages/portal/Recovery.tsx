import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

const recoveryServices = [
  {
    name: "Red Light Therapy",
    description: "Full-body red light therapy session for recovery, skin health, and inflammation reduction.",
    duration: "20 min",
    price: "$35",
  },
  {
    name: "Dry Cryo",
    description: "Whole-body cryotherapy session to reduce muscle soreness and boost recovery.",
    duration: "3 min",
    price: "$45",
  },
];

export default function PortalRecovery() {
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
            <Card key={service.name}>
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
                <Button className="w-full">Book Session</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
