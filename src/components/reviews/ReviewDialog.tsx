import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "./StarRating";
import { useSubmitReview, useUpdateReview } from "@/hooks/useClassReviews";

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  classTypeId: string;
  sessionId: string;
  className?: string;
  existingReview?: {
    id: string;
    rating: number;
    review_text: string | null;
  } | null;
}

export function ReviewDialog({
  open, onOpenChange, bookingId, classTypeId, sessionId,
  className: classTypeName, existingReview,
}: ReviewDialogProps) {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [text, setText] = useState(existingReview?.review_text || "");
  const submitReview = useSubmitReview();
  const updateReview = useUpdateReview();
  const isEditing = !!existingReview;
  const isPending = submitReview.isPending || updateReview.isPending;

  const handleSubmit = () => {
    if (rating === 0) return;
    if (isEditing) {
      updateReview.mutate(
        { reviewId: existingReview!.id, rating, reviewText: text },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      submitReview.mutate(
        { bookingId, classTypeId, sessionId, rating, reviewText: text },
        { onSuccess: () => onOpenChange(false) }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Review" : "Leave a Review"}</DialogTitle>
          <DialogDescription>
            {classTypeName ? `How was ${classTypeName}?` : "Rate your experience"}
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
            placeholder="Share your experience (optional)..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={rating === 0 || isPending}>
            {isPending ? "Saving..." : isEditing ? "Update" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
