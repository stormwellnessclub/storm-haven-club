import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { usePendingSpaReviews } from "@/hooks/useSpaReviews";
import { SpaReviewDialog } from "@/components/spa/SpaReviewDialog";
import { format, parseISO } from "date-fns";

/**
 * Banner that prompts members/non-members to leave a review for any
 * completed spa appointments without a review yet. Click opens a list;
 * picking one opens the SpaReviewDialog.
 */
export function LeaveSpaReviewBanner() {
  const { data: pending = [] } = usePendingSpaReviews();
  const [listOpen, setListOpen] = useState(false);
  const [selected, setSelected] = useState<typeof pending[number] | null>(null);

  if (!pending.length) return null;

  return (
    <>
      <div
        className="relative overflow-hidden rounded-md border border-[hsl(var(--gold)/0.25)] shadow-[var(--shadow-elevated)]"
        style={{ backgroundImage: "var(--gradient-dark)" }}
      >
        <div className="relative flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:gap-6 md:p-7">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-[hsl(var(--gold-light))]" aria-hidden />
              <span className="text-[11px] uppercase tracking-[0.2em] font-medium text-[hsl(var(--gold-light))]">
                Spa reflection
              </span>
            </div>
            <h3 className="font-serif text-2xl leading-tight tracking-tight text-[hsl(var(--cream))]">
              {pending.length === 1
                ? "Rate your recent spa treatment"
                : `${pending.length} spa treatments waiting for a review`}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--cream)/0.78)] max-w-2xl">
              Share what stood out — your name appears publicly only as your first name and last initial.
            </p>
          </div>
          <div className="shrink-0">
            <Button
              size="lg"
              onClick={() => {
                if (pending.length === 1) {
                  setSelected(pending[0]);
                } else {
                  setListOpen(true);
                }
              }}
              className="bg-[hsl(var(--cream))] text-[hsl(var(--charcoal))] hover:bg-[hsl(var(--cream))]/90 border border-[hsl(var(--cream))] rounded-md px-6 h-11"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Leave a Review
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose a treatment to review</DialogTitle>
            <DialogDescription>
              Select the appointment you'd like to share feedback on.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {pending.map((p) => (
              <button
                key={p.appointment_id}
                type="button"
                className="w-full text-left border border-border rounded-md p-3 hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setSelected(p);
                  setListOpen(false);
                }}
              >
                <p className="font-medium text-sm">{p.service_name}</p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(p.appointment_date), "MMM d, yyyy")}
                  {p.therapist_name ? ` · ${p.therapist_name}` : ""}
                </p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {selected && selected.service_id && (
        <SpaReviewDialog
          open={!!selected}
          onOpenChange={(open) => { if (!open) setSelected(null); }}
          appointmentId={selected.appointment_id}
          serviceId={selected.service_id}
          therapistId={selected.therapist_id}
          serviceName={selected.service_name}
          therapistName={selected.therapist_name}
        />
      )}
    </>
  );
}
