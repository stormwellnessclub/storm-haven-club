import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CloudRain, Snowflake, Sun, Pencil, Loader2, Send } from "lucide-react";
import { useCreateConversation } from "@/hooks/useEmailConversations";
import { useUserCredits } from "@/hooks/useUserCredits";
import { useToast } from "@/hooks/use-toast";

interface ConciergeService {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  subject: string;
  creditType?: string;
}

const conciergeServices: ConciergeService[] = [
  {
    id: "steam-room",
    title: "Steam Room",
    description: "Please let us know 20-30 minutes before you'd like to use the steam room so we can prep it for you.",
    icon: <CloudRain className="h-6 w-6" />,
    subject: "Concierge: Steam Room Request",
  },
  {
    id: "ice-bed",
    title: "Ice Bed (ZeroBody Cryo)",
    description: "Available for Platinum and Diamond members via credits. If you don't have credits, you can purchase an ice bed pass.",
    icon: <Snowflake className="h-6 w-6" />,
    subject: "Concierge: Ice Bed Request",
    creditType: "dry_cryo",
  },
  {
    id: "red-light",
    title: "Red Light Therapy",
    description: "Available for Gold, Platinum, and Diamond members via credits. If you don't have credits, you can purchase a session pass.",
    icon: <Sun className="h-6 w-6" />,
    subject: "Concierge: Red Light Therapy Request",
    creditType: "red_light",
  },
];

export function ClubConciergeTab() {
  const { toast } = useToast();
  const createConversation = useCreateConversation();
  const { data: credits } = useUserCredits();

  const [selectedService, setSelectedService] = useState<ConciergeService | null>(null);
  const [notes, setNotes] = useState("");
  const [isOtherOpen, setIsOtherOpen] = useState(false);
  const [otherSubject, setOtherSubject] = useState("");
  const [otherMessage, setOtherMessage] = useState("");

  const getCreditInfo = (creditType?: string) => {
    if (!creditType || !credits) return null;
    const creditMap: Record<string, any> = {
      dry_cryo: credits.dryCredits,
      red_light: credits.redLightCredits,
    };
    const credit = creditMap[creditType];
    return credit && credit.credits_remaining > 0
      ? { remaining: credit.credits_remaining }
      : null;
  };

  const handleServiceRequest = async (service: ConciergeService) => {
    const message = notes.trim()
      ? `${service.description}\n\nAdditional notes: ${notes}`
      : service.description;

    try {
      await createConversation.mutateAsync({
        subject: service.subject,
        message,
        category: 'concierge',
      } as any);
      toast({
        title: "Request sent",
        description: "Our concierge team will respond shortly.",
      });
      setSelectedService(null);
      setNotes("");
    } catch {
      toast({
        title: "Error",
        description: "Failed to send request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleOtherRequest = async () => {
    if (!otherSubject.trim() || !otherMessage.trim()) {
      toast({
        title: "Error",
        description: "Please enter a subject and message.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createConversation.mutateAsync({
        subject: `Concierge: ${otherSubject.trim()}`,
        message: otherMessage.trim(),
        category: 'concierge',
      } as any);
      toast({
        title: "Request sent",
        description: "Our concierge team will respond shortly.",
      });
      setIsOtherOpen(false);
      setOtherSubject("");
      setOtherMessage("");
    } catch {
      toast({
        title: "Error",
        description: "Failed to send request. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Club Concierge</h2>
        <p className="text-sm text-muted-foreground">
          Request services from our concierge team
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {conciergeServices.map((service) => {
          const creditInfo = getCreditInfo(service.creditType);
          return (
            <Card key={service.id} variant="interactive">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {service.icon}
                  </div>
                  {service.creditType && (
                    <Badge variant={creditInfo ? "default" : "secondary"}>
                      {creditInfo
                        ? `${creditInfo.remaining} credit(s)`
                        : "No credits"}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base">{service.title}</CardTitle>
                <CardDescription>{service.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  className="w-full"
                  onClick={() => setSelectedService(service)}
                >
                  Request
                </Button>
              </CardContent>
            </Card>
          );
        })}

        {/* Other / Custom Request */}
        <Card variant="interactive">
          <CardHeader className="pb-3">
            <div className="p-2 rounded-lg bg-muted text-muted-foreground w-fit">
              <Pencil className="h-6 w-6" />
            </div>
            <CardTitle className="text-base">Other</CardTitle>
            <CardDescription>
              Have a different request? Write your own custom concierge message.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsOtherOpen(true)}
            >
              Write Request
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Service Request Dialog */}
      <Dialog open={!!selectedService} onOpenChange={(open) => !open && setSelectedService(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedService?.title}</DialogTitle>
            <DialogDescription>{selectedService?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Additional notes (optional)</Label>
              <Textarea
                placeholder="Any specific details or timing preferences..."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => selectedService && handleServiceRequest(selectedService)}
              disabled={createConversation.isPending}
            >
              {createConversation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" />Send Request</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Other Request Dialog */}
      <Dialog open={isOtherOpen} onOpenChange={setIsOtherOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Custom Concierge Request</DialogTitle>
            <DialogDescription>
              Describe what you need and our team will assist you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="other-subject">Subject</Label>
              <Input
                id="other-subject"
                placeholder="What do you need help with?"
                value={otherSubject}
                onChange={(e) => setOtherSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="other-message">Message</Label>
              <Textarea
                id="other-message"
                placeholder="Describe your request..."
                rows={4}
                value={otherMessage}
                onChange={(e) => setOtherMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleOtherRequest}
              disabled={createConversation.isPending}
            >
              {createConversation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" />Send Request</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
