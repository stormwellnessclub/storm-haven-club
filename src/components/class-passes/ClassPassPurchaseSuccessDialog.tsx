import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Calendar } from "lucide-react";
import { Link } from "react-router-dom";

interface ClassPassPurchaseSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pass: {
    pass_type?: string;
    classes_total?: number;
    classes_remaining?: number;
    expires_at?: string;
    price_paid?: number;
  } | null;
}

export function ClassPassPurchaseSuccessDialog({ open, onOpenChange, pass }: ClassPassPurchaseSuccessDialogProps) {
  const label = pass?.pass_type === "10-pack" ? "10-Class Pack" : "Single Class";
  const expires = pass?.expires_at ? new Date(pass.expires_at).toLocaleDateString() : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-gold/15 flex items-center justify-center">
            <Check className="w-6 h-6 text-gold" />
          </div>
          <DialogTitle className="text-center font-serif text-2xl">Your pass is ready!</DialogTitle>
          <DialogDescription className="text-center">
            Thank you for your purchase. A confirmation email is on its way.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span className="font-medium">{label}</span></div>
          {pass?.classes_total != null && (
            <div className="flex justify-between"><span className="text-muted-foreground">Classes</span><span className="font-medium">{pass.classes_remaining ?? pass.classes_total} of {pass.classes_total}</span></div>
          )}
          <div className="flex justify-between"><span className="text-muted-foreground">Expires</span><span className="font-medium">{expires}</span></div>
          {pass?.price_paid != null && (
            <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="font-medium">${pass.price_paid.toFixed(2)}</span></div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <Button asChild variant="gold" className="flex-1">
            <Link to="/schedule"><Calendar className="w-4 h-4 mr-2" />Book a Class</Link>
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
