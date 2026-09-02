import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CreditCard, RefreshCw, ShieldCheck, ShieldX, Package, Calendar as CalendarIcon2, Loader2, Ticket, Plus, DollarSign, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { GUEST_PASS_COLUMNS } from "@/lib/guestPassStatus";

const GUEST_PASS_PRICE = 60;

interface NonMemberAccount {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  waiver_signed: boolean | null;
  stripe_customer_id: string | null;
  created_at: string;
  activePasses: number;
  totalPasses: number;
}

interface Props {
  account: NonMemberAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NonMemberDetailSheet({ account, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Guest pass sale form state
  const [gpQuantity, setGpQuantity] = useState(1);
  const [gpApplyDiscount, setGpApplyDiscount] = useState(false);
  const [gpCustomPrice, setGpCustomPrice] = useState<number>(GUEST_PASS_PRICE);
  const [gpExpirationDate, setGpExpirationDate] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [gpIsProcessing, setGpIsProcessing] = useState(false);

  // Fetch guest passes for this user (by email match)
  const { data: guestPasses, isLoading: guestPassesLoading } = useQuery({
    queryKey: ["admin-nonmember-guest-passes", account?.email],
    enabled: !!account?.email && open,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("guest_passes" as any)
        .select(GUEST_PASS_COLUMNS)
        .ilike("guest_email", account!.email!)
        .order("purchased_at", { ascending: false }) as any);
      if (error) throw error;
      return data;
    },
  });

  // Fetch class passes for this user
  const { data: passes, isLoading: passesLoading } = useQuery({
    queryKey: ["admin-nonmember-passes", account?.user_id],
    enabled: !!account?.user_id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_passes")
        .select("*")
        .eq("user_id", account!.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch bookings for this user
  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["admin-nonmember-bookings", account?.user_id],
    enabled: !!account?.user_id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_bookings")
        .select("*, class_sessions(session_date, start_time, class_types(name))")
        .eq("user_id", account!.user_id)
        .order("booked_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Refresh card from Stripe
  const refreshCardMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "admin_refresh_nonmember_card",
          userId: account!.user_id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Card info refreshed from Stripe");
      queryClient.invalidateQueries({ queryKey: ["admin-non-member-accounts"] });
    },
    onError: (err: Error) => {
      toast.error(`Failed to refresh: ${err.message}`);
    },
  });

  const handleSellGuestPass = async () => {
    if (!account || !user) return;
    const guestName = [account.first_name, account.last_name].filter(Boolean).join(" ") || "Guest";
    setGpIsProcessing(true);
    try {
      const origin = window.location.origin;
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_guest_pass_checkout",
          guestName,
          guestEmail: account.email || undefined,
          phoneNumber: account.phone || undefined,
          quantity: gpQuantity,
          customPrice: gpApplyDiscount ? gpCustomPrice : undefined,
          expiresAt: gpExpirationDate ? gpExpirationDate.toISOString() : undefined,
          successUrl: `${origin}/admin/non-member-accounts?purchase=success`,
          cancelUrl: `${origin}/admin/non-member-accounts?purchase=cancelled`,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error: any) {
      console.error("Error creating guest pass checkout:", error);
      toast.error(error?.message || "Failed to create guest pass checkout");
    } finally {
      setGpIsProcessing(false);
    }
  };

  const resetGuestPassForm = () => {
    setGpQuantity(1);
    setGpApplyDiscount(false);
    setGpCustomPrice(GUEST_PASS_PRICE);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setGpExpirationDate(d);
  };

  if (!account) return null;

  const fullName = [account.first_name, account.last_name].filter(Boolean).join(" ") || "Unknown";
  const effectivePrice = gpApplyDiscount ? gpCustomPrice : GUEST_PASS_PRICE;
  const gpSubtotal = effectivePrice * gpQuantity;
  const gpEstFee = gpSubtotal * 0.029 + 0.30;
  const gpEstTotal = gpSubtotal + gpEstFee;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">{fullName}</SheetTitle>
          <p className="text-sm text-muted-foreground">{account.email}</p>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Profile Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span>{account.phone || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Joined</span>
                <span>{format(new Date(account.created_at), "MMM d, yyyy")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Waiver</span>
                {account.waiver_signed ? (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    <ShieldCheck className="h-3 w-3 mr-1" /> Signed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                    <ShieldX className="h-3 w-3 mr-1" /> Missing
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card on File */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Card on File</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refreshCardMutation.mutate()}
                  disabled={refreshCardMutation.isPending}
                >
                  {refreshCardMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-1 text-xs">Refresh</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {account.card_last4 ? (
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {account.card_brand || "Card"} •••• {account.card_last4}
                    </p>
                    {account.card_exp_month && account.card_exp_year && (
                      <p className="text-xs text-muted-foreground">
                        Expires {String(account.card_exp_month).padStart(2, "0")}/{account.card_exp_year}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No card on file</p>
              )}
            </CardContent>
          </Card>

          {/* Sell Guest Pass */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                Sell Guest Pass
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-muted rounded-md text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Guest Pass</span>
                  <span className="font-semibold">${GUEST_PASS_PRICE}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Gym & amenities access
                </p>
              </div>

              {/* Quantity */}
              <div className="space-y-1">
                <Label className="text-xs">Quantity</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={gpQuantity <= 1} onClick={() => setGpQuantity((q) => Math.max(1, q - 1))}>
                    −
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={gpQuantity}
                    onChange={(e) => setGpQuantity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    className="w-14 text-center h-8"
                  />
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={gpQuantity >= 10} onClick={() => setGpQuantity((q) => Math.min(10, q + 1))}>
                    +
                  </Button>
                </div>
              </div>

              {/* Discount */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="nm-discount"
                    checked={gpApplyDiscount}
                    onCheckedChange={(checked) => {
                      setGpApplyDiscount(!!checked);
                      if (!checked) setGpCustomPrice(GUEST_PASS_PRICE);
                    }}
                  />
                  <Label htmlFor="nm-discount" className="text-xs font-normal cursor-pointer">
                    Apply discount
                  </Label>
                </div>
                {gpApplyDiscount && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={gpCustomPrice}
                      onChange={(e) => setGpCustomPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-20 h-8"
                      placeholder="Price"
                    />
                    <span className="text-xs text-muted-foreground">per pass</span>
                  </div>
                )}
              </div>

              {/* Expiration */}
              <div className="space-y-1">
                <Label className="text-xs">Expiration Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("w-full justify-start text-left font-normal h-8", !gpExpirationDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {gpExpirationDate ? format(gpExpirationDate, "PPP") : "Select expiration"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={gpExpirationDate}
                      onSelect={setGpExpirationDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Price breakdown */}
              <div className="p-3 rounded-md bg-muted/50 text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${gpSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Processing fee</span>
                  <span>~${gpEstFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium border-t pt-1">
                  <span>Est. Total</span>
                  <span>${gpEstTotal.toFixed(2)}</span>
                </div>
              </div>

              <Button className="w-full" size="sm" disabled={gpIsProcessing} onClick={handleSellGuestPass}>
                {gpIsProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    {gpQuantity > 1 ? `Create ${gpQuantity} Passes & Checkout` : "Create & Checkout"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Class Passes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Class Passes ({passes?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {passesLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : !passes?.length ? (
                <p className="text-sm text-muted-foreground">No class passes</p>
              ) : (
                <div className="space-y-3">
                  {passes.map((pass: any) => (
                    <div key={pass.id} className="flex items-center justify-between p-3 rounded-sm border border-border bg-background">
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {pass.category?.replace("_", " ")} — {pass.pass_type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Expires {format(new Date(pass.expires_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={pass.status === "active" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {pass.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {pass.classes_remaining}/{pass.classes_total} left
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Booking History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon2 className="h-4 w-4" />
                Recent Bookings ({bookings?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bookingsLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : !bookings?.length ? (
                <p className="text-sm text-muted-foreground">No bookings yet</p>
              ) : (
                <div className="space-y-2">
                  {bookings.map((booking: any) => (
                    <div key={booking.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium">
                          {booking.class_sessions?.class_types?.name || "Class"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {booking.class_sessions?.session_date
                            ? format(new Date(booking.class_sessions.session_date), "MMM d, yyyy")
                            : "—"}
                        </p>
                      </div>
                      <Badge
                        variant={booking.status === "confirmed" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {booking.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Guest Passes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                Guest Passes ({guestPasses?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {guestPassesLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : !guestPasses?.length ? (
                <p className="text-sm text-muted-foreground">No guest passes</p>
              ) : (
                <div className="space-y-2">
                  {guestPasses.map((gp: any) => (
                    <div key={gp.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium">{gp.guest_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {gp.valid_date ? format(new Date(gp.valid_date), "MMM d, yyyy") : gp.purchased_at ? format(new Date(gp.purchased_at), "MMM d, yyyy") : "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={gp.status === "active" ? "default" : (gp.status === "exhausted" || gp.status === "used") ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {(gp.status === "exhausted" || gp.status === "used") ? "Used" : gp.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">${gp.price_paid}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
