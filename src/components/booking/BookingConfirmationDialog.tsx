import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Calendar, Clock, MapPin, User, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { CANCELLATION_POLICY_TEXT } from "./CancellationPolicyText";

export interface BookingConfirmationDetails {
  className: string;
  date: string;
  time: string;
  room?: string | null;
  instructor?: string | null;
  remainingCreditsLabel?: string | null; // e.g. "3 class credits remaining" or "Unlimited"
  bookingsUrl: string; // "/member/bookings" or "/portal/bookings"
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: BookingConfirmationDetails | null;
}

export function BookingConfirmationDialog({ open, onOpenChange, details }: Props) {
  if (!details) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <DialogTitle className="text-center">You're booked!</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 bg-muted/40 rounded-lg p-4 text-sm">
          <p className="font-semibold text-base text-center">{details.className}</p>
          <div className="space-y-2 text-muted-foreground">
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span>{details.date}</span></div>
            <div className="flex items-center gap-2"><Clock className="h-4 w-4" /><span>{details.time}</span></div>
            {details.room && (
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /><span>{details.room}</span></div>
            )}
            {details.instructor && (
              <div className="flex items-center gap-2"><User className="h-4 w-4" /><span>{details.instructor}</span></div>
            )}
          </div>
        </div>

        {details.remainingCreditsLabel && (
          <div className="flex items-center gap-2 text-sm bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>{details.remainingCreditsLabel}</span>
          </div>
        )}

        <div className="text-xs text-muted-foreground border-t pt-3">
          <p className="font-medium text-foreground mb-1">Cancellation policy</p>
          <p>{CANCELLATION_POLICY_TEXT}</p>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Done
          </Button>
          <Button asChild className="flex-1">
            <Link to={details.bookingsUrl} onClick={() => onOpenChange(false)}>
              View my bookings
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
