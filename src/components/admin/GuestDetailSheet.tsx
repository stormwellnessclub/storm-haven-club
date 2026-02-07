import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ExternalLink, User, Mail, Phone, Calendar, Users, Sparkles, FileText } from "lucide-react";

interface GuestPass {
  id: string;
  guest_name: string;
  guest_email: string | null;
  phone_number?: string | null;
  price_paid: number;
  status: 'active' | 'exhausted' | 'expired';
  purchased_at: string;
  expires_at: string;
  used_at: string | null;
  valid_date?: string | null;
  member_referral?: string | null;
  visit_interests?: string[] | null;
  visit_notes?: string | null;
  add_ons?: Array<{ id: string; label: string; price: number }> | null;
  stripe_payment_id?: string | null;
}

interface GuestDetailSheetProps {
  guest: GuestPass | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INTEREST_LABELS: Record<string, string> = {
  movement: "Movement & Training",
  recovery: "Recovery Therapies",
  spa: "Spa Amenities",
  exploring: "Just exploring the space",
};

export function GuestDetailSheet({ guest, open, onOpenChange }: GuestDetailSheetProps) {
  if (!guest) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'exhausted':
        return <Badge variant="secondary">Used</Badge>;
      case 'expired':
        return <Badge variant="outline">Expired</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const calculateAddonsTotal = () => {
    if (!guest.add_ons || guest.add_ons.length === 0) return 0;
    return guest.add_ons.reduce((sum, addon) => sum + (addon.price || 0), 0);
  };

  const addonsTotal = calculateAddonsTotal();
  const basePrice = guest.price_paid - addonsTotal;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {guest.guest_name}
            </SheetTitle>
            {getStatusBadge(guest.status)}
          </div>
          <SheetDescription>
            Guest pass details and preferences
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Contact Information */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Contact Information</h4>
            <div className="space-y-2">
              {guest.guest_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${guest.guest_email}`} className="hover:underline">
                    {guest.guest_email}
                  </a>
                </div>
              )}
              {guest.phone_number && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${guest.phone_number}`} className="hover:underline">
                    {guest.phone_number}
                  </a>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Visit Details */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Visit Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {guest.valid_date 
                    ? `Valid for: ${format(new Date(guest.valid_date), "MMMM d, yyyy")}`
                    : `Purchased: ${format(new Date(guest.purchased_at), "MMMM d, yyyy")}`
                  }
                </span>
              </div>
              <div className="text-muted-foreground">
                Expires: {format(new Date(guest.expires_at), "MMM d, yyyy h:mm a")}
              </div>
              {guest.used_at && (
                <div className="text-muted-foreground">
                  Used: {format(new Date(guest.used_at), "MMM d, yyyy h:mm a")}
                </div>
              )}
              {guest.member_referral && (
                <div className="flex items-center gap-2 mt-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Guest of: {guest.member_referral}</span>
                </div>
              )}
            </div>
          </div>

          {/* Visit Interests */}
          {guest.visit_interests && guest.visit_interests.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Visit Interests</h4>
                <div className="flex flex-wrap gap-2">
                  {guest.visit_interests.map((interest) => (
                    <Badge key={interest} variant="outline" className="text-xs">
                      {INTEREST_LABELS[interest] || interest}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Visit Notes */}
          {guest.visit_notes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Guest Notes
                </h4>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">
                  {guest.visit_notes}
                </p>
              </div>
            </>
          )}

          {/* Add-ons */}
          {guest.add_ons && guest.add_ons.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Purchased Add-ons
                </h4>
                <div className="space-y-2">
                  {guest.add_ons.map((addon) => (
                    <div key={addon.id} className="flex justify-between text-sm">
                      <span>{addon.label}</span>
                      <span className="font-medium">${addon.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Payment Summary */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Payment Summary</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Guest Pass</span>
                <span>${basePrice.toFixed(2)}</span>
              </div>
              {addonsTotal > 0 && (
                <div className="flex justify-between">
                  <span>Add-ons</span>
                  <span>${addonsTotal.toFixed(2)}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-medium">
                <span>Total Paid</span>
                <span>${guest.price_paid.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {guest.stripe_payment_id && (
            <>
              <Separator />
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  asChild
                >
                  <a
                    href={`https://dashboard.stripe.com/payments/${guest.stripe_payment_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View in Stripe
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
