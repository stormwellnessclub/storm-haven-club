import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CloudRain, Snowflake, Sun, Pencil, Loader2, Send, Clock } from "lucide-react";
import { useCreateConversation, useSendMessage } from "@/hooks/useEmailConversations";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useUserCredits } from "@/hooks/useUserCredits";
import { useToast } from "@/hooks/use-toast";
import { format, addMinutes, isBefore, parse } from "date-fns";
import { formatTime12h } from "@/lib/timeFormat";

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

function getMinTimeToday(): string {
  const min = addMinutes(new Date(), 20);
  return format(min, "HH:mm");
}

function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function ClubConciergeTab() {
  const { toast } = useToast();
  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();
  const { data: credits } = useUserCredits();

  const [selectedService, setSelectedService] = useState<ConciergeService | null>(null);
  const [notes, setNotes] = useState("");
  const [requestedDate, setRequestedDate] = useState<string>(todayISO());
  const [requestedTime, setRequestedTime] = useState("");
  const [isOtherOpen, setIsOtherOpen] = useState(false);
  const [otherSubject, setOtherSubject] = useState("");
  const [otherMessage, setOtherMessage] = useState("");
  const [timeError, setTimeError] = useState("");

  const isToday = requestedDate === todayISO();
  const minTime = useMemo(() => (isToday ? getMinTimeToday() : "06:00"), [isToday, selectedService]);

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

  const validateDateTime = (date: string, time: string): boolean => {
    if (!date) {
      setTimeError("Please pick a date.");
      return false;
    }
    if (!time) {
      setTimeError("Please pick a time.");
      return false;
    }
    const [hours, minutes] = time.split(":").map(Number);
    const [yy, mm, dd] = date.split("-").map(Number);
    const selectedDate = new Date(yy, mm - 1, dd, hours, minutes);
    if (date === todayISO()) {
      const minDate = addMinutes(new Date(), 20);
      if (isBefore(selectedDate, minDate)) {
        setTimeError("For today, please pick a time at least 20 minutes from now so we can prepare.");
        return false;
      }
    } else if (isBefore(selectedDate, new Date())) {
      setTimeError("Please pick a future date and time.");
      return false;
    }
    setTimeError("");
    return true;
  };

  const handleServiceRequest = async (service: ConciergeService) => {
    if (!validateDateTime(requestedDate, requestedTime)) return;

    const timeStr = formatTime12h(requestedTime);
    const dateStr = format(parse(requestedDate, "yyyy-MM-dd", new Date()), "EEE, MMM d");
    const whenStr = `${dateStr} at ${timeStr}`;

    const message = [
      `Requested for: ${whenStr}`,
      notes.trim() ? `Additional notes: ${notes}` : "",
    ].filter(Boolean).join("\n\n");

    try {
      const conversation = await createConversation.mutateAsync({
        subject: service.subject,
        message,
        category: 'concierge',
      } as any);

      // Courtesy auto-confirmation — never block the request if it fails
      try {
        await (supabase.rpc as any)("post_concierge_auto_reply", {
          p_conversation_id: conversation.id,
          p_message: `Thank you for your ${service.title} request! ✨\n\nPlease allow 20–30 minutes for our team to get everything ready for you. We'll have it prepared by your requested time of ${whenStr}.\n\nIf you need to make any changes, just reply to this message.`,
        });
        queryClient.invalidateQueries({ queryKey: ["email-messages", conversation.id] });
        queryClient.invalidateQueries({ queryKey: ["email-conversations"] });
      } catch (e) {
        console.warn("Concierge auto-reply failed (request still delivered):", e);
      }


      toast({
        title: "Request sent",
        description: `Your ${service.title} will be ready ${whenStr}. Please allow 20–30 minutes for prep.`,
      });
      setSelectedService(null);
      setNotes("");
      setRequestedTime("");
      setRequestedDate(todayISO());
      setTimeError("");
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

      <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/50">
        <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-800 dark:text-amber-300">Please allow 20–30 minutes</AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-400/80">
          Our concierge team needs time to prepare your request. You must select a time at least 20 minutes from now so everything is ready for you.
        </AlertDescription>
      </Alert>

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
                  onClick={() => {
                    setSelectedService(service);
                    setRequestedDate(todayISO());
                    setRequestedTime("");
                    setTimeError("");
                    setNotes("");
                  }}
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="request-date">
                  Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="request-date"
                  type="date"
                  min={todayISO()}
                  value={requestedDate}
                  onChange={(e) => {
                    setRequestedDate(e.target.value);
                    if (timeError) validateDateTime(e.target.value, requestedTime);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="request-time">
                  Time <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="request-time"
                  type="time"
                  min={minTime}
                  value={requestedTime}
                  onChange={(e) => {
                    setRequestedTime(e.target.value);
                    if (timeError) validateDateTime(requestedDate, e.target.value);
                  }}
                />
                {requestedTime && !timeError && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {formatTime12h(requestedTime)}
                  </p>
                )}
              </div>
            </div>
            {timeError && (
              <p className="text-xs text-destructive">{timeError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              For same-day requests, please pick a time at least 20 minutes from now so we can prep.
            </p>
            <div className="space-y-2">
              <Label>Additional notes (optional)</Label>
              <Textarea
                placeholder="Any specific details or preferences..."
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
