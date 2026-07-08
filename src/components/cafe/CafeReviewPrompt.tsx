import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreviewedCompletedOrders } from "@/hooks/useCafeReviews";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CafeReviewForm } from "./CafeReviewForm";

/** DoorDash-style post-pickup review nudge. Renders nothing for guests or when there's nothing to review. */
export function CafeReviewPrompt() {
  const { user } = useAuth();
  const { data: pending = [] } = useUnreviewedCompletedOrders(user?.id ?? null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [openTarget, setOpenTarget] = useState<{
    orderId: string;
    itemId: string;
    itemName: string;
  } | null>(null);

  const active = pending.find((p) => !dismissed.has(`${p.orderId}::${p.itemId}`));
  if (!active) return null;

  const defaultName =
    (user?.user_metadata as any)?.first_name ||
    user?.email?.split("@")[0] ||
    "";

  return (
    <>
      <div className="mb-6 border border-cafe-terracotta/50 bg-cafe-terracotta/10 rounded-lg px-4 py-3 flex items-center gap-3">
        <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-cafe-terracotta text-white shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-cafe-serif text-sm uppercase tracking-tight text-cafe-burgundy truncate">
            How was your {active.itemName}?
          </p>
          <p className="font-cafe-mono text-[10px] tracking-widest uppercase text-cafe-burgundy/60 mt-0.5">
            30 seconds — help another member pick
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setOpenTarget({
              orderId: active.orderId,
              itemId: active.itemId,
              itemName: active.itemName,
            })
          }
          className="bg-cafe-burgundy text-cafe-cream font-cafe-mono text-[10px] tracking-[0.2em] uppercase px-4 py-2 hover:opacity-90 whitespace-nowrap"
        >
          Rate it
        </button>
        <button
          type="button"
          onClick={() =>
            setDismissed((prev) => {
              const next = new Set(prev);
              next.add(`${active.orderId}::${active.itemId}`);
              return next;
            })
          }
          className="p-1 text-cafe-burgundy/50 hover:text-cafe-burgundy"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Dialog open={!!openTarget} onOpenChange={(open) => !open && setOpenTarget(null)}>
        <DialogContent className="bg-cafe-cream sm:max-w-md">
          {openTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="font-cafe-serif text-xl uppercase tracking-tight text-cafe-burgundy text-left">
                  Rate your {openTarget.itemName}
                </DialogTitle>
                <DialogDescription className="font-cafe-mono text-[10px] tracking-widest uppercase text-cafe-burgundy/60 text-left">
                  From your recent café order
                </DialogDescription>
              </DialogHeader>
              <CafeReviewForm
                menuItemId={openTarget.itemId}
                itemName={openTarget.itemName}
                orderId={openTarget.orderId}
                defaultDisplayName={defaultName}
                compact
                onCancel={() => setOpenTarget(null)}
                onSubmitted={() => setOpenTarget(null)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
