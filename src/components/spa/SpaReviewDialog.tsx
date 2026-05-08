import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/reviews/StarRating";
import { useSubmitSpaReview } from "@/hooks/useSpaReviews";

interface SpaReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  serviceId: string;
  therapistId?: string | null;
  serviceName?: string;
  therapistName?: string | null;
}

export function SpaReviewDialog({
  open, onOpenChange, appointmentId, serviceId, therapistId, serviceName, therapistName,
}: SpaReviewDialogProps) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const submit = useSubmitSpaReview();

  const handleSubmit = () => {
    if (rating === 0) return;
    submit.mutate(
      { appointmentId, serviceId, therapistId, rating, reviewText: text },
      { onSuccess: () => {
          setRating(0); setText("");
          onOpenChange(false);
        } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate Your Spa Experience</DialogTitle>
          <DialogDescription>
            {serviceName ? `How was your ${serviceName}` : "How was your treatment"}
            {therapistName ? ` with ${therapistName}` : ""}?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex flex-col items-center gap-2">
            <StarRating rating={rating} onRate={setRating} size="lg" />
            <span className="text-sm text-muted-foreground">
              {rating === 0 ? "Tap a star to rate" : `${rating} / 5`}
            </span>
          </div>
          <Textarea
            placeholder="Share what stood out (optional)..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={1000}
          />
          <p className="text-[11px] text-muted-foreground text-center">
            Your name will appear publicly as your first name and last initial only (e.g. "Sarah M.").
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={rating === 0 || submit.isPending}>
            {submit.isPending ? "Saving..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
