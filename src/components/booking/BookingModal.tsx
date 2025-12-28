import { ClassSession } from "@/hooks/useClassSessions";
import { useBookClass } from "@/hooks/useBooking";
import { useAvailableCreditsForCategory } from "@/hooks/useUserCredits";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Clock,
  MapPin,
  User,
  Flame,
  Calendar,
  CreditCard,
  Ticket,
  AlertCircle,
} from "lucide-react";
import { format, parse, parseISO } from "date-fns";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface BookingModalProps {
  session: ClassSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BookingModal({ session, open, onOpenChange }: BookingModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState<"credits" | "pass" | "cash">("credits");
  const [selectedPassId, setSelectedPassId] = useState<string | null>(null);

  const bookClass = useBookClass();
  const { data: creditsData, isLoading: creditsLoading } = useAvailableCreditsForCategory(
    session?.class_type.category || "other"
  );

  if (!session) return null;

  const startTime = parse(session.start_time, "HH:mm:ss", new Date());
  const sessionDate = parseISO(session.session_date);
  const spotsRemaining = session.max_capacity - session.current_enrollment;

  const handleBook = async () => {
    if (!user) {
      navigate("/auth");
      onOpenChange(false);
      return;
    }

    await bookClass.mutateAsync({
      sessionId: session.id,
      paymentMethod,
      passId: selectedPassId || undefined,
    });

    onOpenChange(false);
  };

  const canUseMemberCredits = creditsData?.hasMemberCredits;
  const canUsePass = creditsData?.availablePasses && creditsData.availablePasses.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {session.class_type.name}
            {session.class_type.is_heated && (
              <Badge variant="destructive" className="text-xs">
                <Flame className="h-3 w-3 mr-1" />
                Hot
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Book your spot in this class
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Class Details */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(sessionDate, "EEEE, MMMM d, yyyy")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {format(startTime, "h:mm a")} ({session.class_type.duration_minutes} min)
              </span>
            </div>
            {session.instructor && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>
                  {session.instructor.first_name} {session.instructor.last_name}
                </span>
              </div>
            )}
            {session.room && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{session.room}</span>
              </div>
            )}
            <div className="text-sm font-medium">
              {spotsRemaining} spot{spotsRemaining !== 1 ? "s" : ""} remaining
            </div>
          </div>

          {/* Cancellation Policy */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Free cancellation up to 24 hours before class. Late cancellations
              will forfeit your credit or pass.
            </AlertDescription>
          </Alert>

          {/* Payment Method Selection */}
          {user && !creditsLoading && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Payment Method</Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) => {
                  setPaymentMethod(v as "credits" | "pass" | "cash");
                  setSelectedPassId(null);
                }}
                className="space-y-2"
              >
                {canUseMemberCredits && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="credits" id="credits" />
                    <Label htmlFor="credits" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span>Diamond Member Credit</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {creditsData?.memberCreditsRemaining} credits remaining this month
                      </p>
                    </Label>
                  </div>
                )}

                {canUsePass &&
                  creditsData?.availablePasses.map((pass) => (
                    <div
                      key={pass.id}
                      className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <RadioGroupItem
                        value="pass"
                        id={`pass-${pass.id}`}
                        onClick={() => {
                          setPaymentMethod("pass");
                          setSelectedPassId(pass.id);
                        }}
                      />
                      <Label htmlFor={`pass-${pass.id}`} className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-primary" />
                          <span>{pass.pass_type}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {pass.classes_remaining} of {pass.classes_total} classes remaining
                        </p>
                      </Label>
                    </div>
                  ))}

                <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="cash" id="cash" />
                  <Label htmlFor="cash" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span>Pay at front desk</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Single class rate applies
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {!user && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please sign in or create an account to book this class.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleBook}
            disabled={bookClass.isPending}
          >
            {bookClass.isPending
              ? "Booking..."
              : !user
              ? "Sign In to Book"
              : "Confirm Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
