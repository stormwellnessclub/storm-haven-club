import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star, CheckCircle2, Loader2 } from "lucide-react";
import stormLogo from "@/assets/storm-logo-gold.png";

export default function GuestFeedback() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Invalid feedback link. Please use the link from your email.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setIsSubmitting(true);
    try {
      // Look up guest pass to populate name/email on feedback
      const guestPassId = token?.startsWith('fb-') ? token.slice(3) : null;
      let guestName: string | null = null;
      let guestEmail: string | null = null;

      if (guestPassId) {
        const { data: passData } = await (supabase
          .from("guest_passes" as any)
          .select("guest_name, guest_email")
          .eq("id", guestPassId)
          .maybeSingle() as any);
        if (passData) {
          guestName = passData.guest_name;
          guestEmail = passData.guest_email;
        }
      }

      const { error } = await (supabase
        .from("guest_feedback" as any)
        .insert({
          feedback_token: token,
          guest_pass_id: guestPassId,
          guest_name: guestName,
          guest_email: guestEmail,
          rating,
          comment: comment.trim() || null,
        }) as any);

      if (error) {
        if (error.code === "23505") {
          toast.error("You've already submitted feedback. Thank you!");
          setSubmitted(true);
        } else {
          throw error;
        }
      } else {
        setSubmitted(true);
        toast.success("Thank you for your feedback!");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <img src={stormLogo} alt="Storm Wellness Club" className="h-16 mx-auto" />
            <CheckCircle2 className="h-12 w-12 mx-auto text-accent" />
            <h2 className="text-xl font-semibold">Thank You!</h2>
            <p className="text-muted-foreground">
              Your feedback helps us create a better experience for everyone.
            </p>
            <div className="pt-4">
              <Button variant="outline" asChild>
                <a href="/guest-pass">Book Another Visit</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center space-y-4">
          <img src={stormLogo} alt="Storm Wellness Club" className="h-14 mx-auto" />
          <CardTitle className="text-xl">How Was Your Visit?</CardTitle>
          <p className="text-sm text-muted-foreground">
            We'd love to hear about your experience at Storm Wellness Club.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Star Rating */}
          <div className="text-center space-y-2">
            <p className="text-sm font-medium">Rate your experience</p>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHoveredRating(value)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={`h-10 w-10 transition-colors ${
                      value <= (hoveredRating || rating)
                        ? "fill-accent text-accent"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-muted-foreground">
                {rating === 1 && "Poor"}
                {rating === 2 && "Below Average"}
                {rating === 3 && "Average"}
                {rating === 4 && "Great"}
                {rating === 5 && "Exceptional"}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Comments (optional)</p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What stood out? What could we improve?"
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">{comment.length}/1000</p>
          </div>

          <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0} className="w-full">
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Submit Feedback
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
