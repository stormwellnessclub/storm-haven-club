import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StarRating } from "@/components/reviews/StarRating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

type TokenInfo = {
  valid: boolean;
  already_used: boolean;
  expired: boolean;
  service_name: string | null;
  therapist_name: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  reviewer_name: string | null;
};

export default function SpaReview() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("get_spa_review_token_info", { _token: token });
      if (error) {
        console.error(error);
        setInfo({ valid: false, already_used: false, expired: false, service_name: null, therapist_name: null, appointment_date: null, appointment_time: null, reviewer_name: null });
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        setInfo(row as TokenInfo);
        if (row?.reviewer_name) setName(row.reviewer_name);
      }
      setLoading(false);
    })();
  }, [token]);

  const handleSubmit = async () => {
    if (!token || rating < 1) {
      toast.error("Please select a star rating.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("submit_spa_review_via_token", {
      _token: token,
      _rating: rating,
      _review_text: text || null,
      _display_name: name || null,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Could not submit review. Please try again.");
      return;
    }
    const res = data as { success: boolean; error?: string };
    if (!res?.success) {
      const msg =
        res?.error === "already_used" ? "This review has already been submitted." :
        res?.error === "expired" ? "This review link has expired." :
        res?.error === "invalid_token" ? "This review link is invalid." :
        res?.error === "invalid_rating" ? "Please choose a rating between 1 and 5." :
        "Could not submit review.";
      toast.error(msg);
      return;
    }
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <Link to="/" className="font-serif text-2xl tracking-wide">Storm Wellness Club</Link>
        </div>

        {loading ? (
          <Card><CardContent className="p-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>
        ) : !info?.valid ? (
          <StatusCard icon="error" title="Link not found" message="This review link is invalid or no longer available." />
        ) : info.expired ? (
          <StatusCard icon="error" title="Link expired" message="This review link is past its 90-day window. Thanks for thinking of us!" />
        ) : info.already_used || submitted ? (
          <StatusCard
            icon="success"
            title={submitted ? "Thank you" : "Already received"}
            message={submitted
              ? "Your reflection has been shared with our team. We're grateful you took the time."
              : "We've already received a review for this appointment. Thank you."}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Share your experience</CardTitle>
              <CardDescription>
                {info.service_name ? <>{info.service_name}</> : <>Your spa visit</>}
                {info.therapist_name ? <> · with {info.therapist_name}</> : null}
                {info.appointment_date ? <> · {format(parseISO(info.appointment_date), "MMMM d, yyyy")}</> : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="text-sm font-medium block mb-2">Your rating</label>
                <StarRating rating={rating} onRate={setRating} size="lg" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Your name (optional)</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="First name and last initial work great"
                  maxLength={80}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">A few words (optional)</label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  maxLength={1000}
                  placeholder="What stood out? Anything we could improve?"
                />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitting || rating < 1}
                className="w-full"
                size="lg"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit review
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Reviews are moderated. Only your first name + last initial will be shown publicly.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatusCard({ icon, title, message }: { icon: "success" | "error"; title: string; message: string }) {
  return (
    <Card>
      <CardContent className="p-10 text-center space-y-4">
        {icon === "success" ? (
          <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
        ) : (
          <XCircle className="h-12 w-12 mx-auto text-muted-foreground" />
        )}
        <h2 className="text-xl font-serif">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button asChild variant="outline">
          <Link to="/">Back to home</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
