import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StarRating } from "@/components/reviews/StarRating";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSpaServices, useSpaTherapists } from "@/hooks/useSpaManagement";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";

interface PublicSpaReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialServiceId?: string | null;
}

export function PublicSpaReviewDialog({
  open, onOpenChange, initialServiceId,
}: PublicSpaReviewDialogProps) {
  const { user } = useAuth();
  const { data: profile } = useUserProfile();
  const { data: services = [] } = useSpaServices();
  const { data: therapists = [] } = useSpaTherapists();

  const [serviceId, setServiceId] = useState<string>(initialServiceId || "");
  const [therapistId, setTherapistId] = useState<string>("none");
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setServiceId(initialServiceId || "");
    setTherapistId("none");
    setRating(0);
    setText("");
    setHoneypot("");
    const first = (profile as any)?.first_name || "";
    const last = (profile as any)?.last_name || "";
    const composed = `${first} ${last}`.trim();
    setName(composed);
    setEmail((profile as any)?.email || user?.email || "");
  }, [open, initialServiceId, profile, user]);

  const activeServices = services.filter((s: any) => s.is_active);

  const handleSubmit = async () => {
    if (!serviceId) { toast.error("Choose a service."); return; }
    if (rating < 1) { toast.error("Please select a star rating."); return; }
    if (!name.trim()) { toast.error("Please enter your name."); return; }
    if (!email.trim()) { toast.error("Please enter your email."); return; }

    setSubmitting(true);
    const { data, error } = await (supabase.rpc as any)("submit_public_spa_review", {
      _service_id: serviceId,
      _therapist_id: therapistId === "none" ? null : therapistId,
      _rating: rating,
      _review_text: text || null,
      _display_name: name,
      _email: email,
      _honeypot: honeypot || null,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Could not submit review. Please try again.");
      return;
    }
    const res = data as { success: boolean; error?: string };
    if (!res?.success) {
      const msg =
        res?.error === "invalid_rating" ? "Please choose a rating between 1 and 5." :
        res?.error === "invalid_email" ? "Please enter a valid email." :
        res?.error === "missing_name" ? "Please enter your name." :
        res?.error === "missing_service" ? "Please pick a service." :
        "Could not submit review.";
      toast.error(msg);
      return;
    }
    toast.success("Thanks — your review is in for moderation.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share your spa experience</DialogTitle>
          <DialogDescription>
            Reviews are moderated before they appear. Only your first name and last initial show publicly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium block mb-1.5">Service</label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger><SelectValue placeholder="Choose a service" /></SelectTrigger>
              <SelectContent>
                {activeServices.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Therapist (optional)</label>
            <Select value={therapistId} onValueChange={setTherapistId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not sure / not listed</SelectItem>
                {therapists.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Your rating</label>
            <StarRating rating={rating} onRate={setRating} size="lg" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Your name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First Last"
                maxLength={80}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                maxLength={160}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">A few words (optional)</label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="What stood out?"
            />
          </div>

          {/* Honeypot — hidden from real users */}
          <div className="hidden" aria-hidden="true">
            <label>Leave this field empty</label>
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || rating < 1}>
            {submitting ? "Submitting..." : "Submit review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
