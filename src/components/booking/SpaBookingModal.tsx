import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useSpaBookAppointment, useCheckSpaAvailability } from "@/hooks/useSpaBooking";
import { useUserMembership } from "@/hooks/useUserMembership";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addDays, addMonths, parse, addMinutes } from "date-fns";
import { CalendarIcon, Clock, CreditCard, User, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SpaService {
  id: number;
  name: string;
  description: string;
  duration: string;
  cleanupTime: string;
  price: number;
  memberPrice?: number;
  category: string;
}

interface SpaBookingModalProps {
  service: SpaService | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30",
];

export function SpaBookingModal({ service, open, onOpenChange }: SpaBookingModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: membership } = useUserMembership();
  const bookAppointment = useSpaBookAppointment();
  const checkAvailability = useCheckSpaAvailability();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [memberNotes, setMemberNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "member_account">("card");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<any[]>([]);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<Set<string>>(new Set());

  // Fetch saved payment methods
  useEffect(() => {
    if (user && open && paymentMethod === "card") {
      supabase.functions.invoke("stripe-payment", {
        body: { action: "list_payment_methods" },
      }).then(({ data, error }) => {
        if (!error && data?.paymentMethods) {
          setSavedPaymentMethods(data.paymentMethods);
          if (data.paymentMethods.length > 0) {
            setSelectedPaymentMethodId(data.paymentMethods[0].id);
          }
        }
      });
    }
  }, [user, open, paymentMethod]);

  // Check availability when date/time changes
  useEffect(() => {
    if (selectedDate && service) {
      setIsCheckingAvailability(true);
      const durationMatch = service.duration.match(/(\d+)/);
      const durationMinutes = durationMatch ? parseInt(durationMatch[1]) : 60;

      // Check all time slots for this date
      Promise.all(
        TIME_SLOTS.map(async (time) => {
          try {
            const result = await checkAvailability.mutateAsync({
              appointmentDate: selectedDate,
              appointmentTime: time,
              durationMinutes,
            });
            return { time, available: result?.available || false };
          } catch {
            return { time, available: false };
          }
        })
      ).then((results) => {
        const available = new Set(
          results.filter((r) => r.available).map((r) => r.time)
        );
        setAvailableSlots(available);
        setIsCheckingAvailability(false);
      });
    }
  }, [selectedDate, service]);

  if (!service) return null;

  const durationMatch = service.duration.match(/(\d+)/);
  const durationMinutes = durationMatch ? parseInt(durationMatch[1]) : 60;
  const cleanupMatch = service.cleanupTime.match(/(\d+)/);
  const cleanupMinutes = cleanupMatch ? parseInt(cleanupMatch[1]) : 15;

  // Calculate member price
  let finalPrice = service.price;
  if (membership) {
    const tier = membership.membership_type?.toLowerCase() || "";
    let discount = 0;
    if (tier.includes("diamond")) discount = 0.12;
    else if (tier.includes("platinum")) discount = 0.10;
    else if (tier.includes("gold")) discount = 0.08;
    else if (tier.includes("silver")) discount = 0.05;

    if (discount > 0) {
      finalPrice = Math.round(service.price * (1 - discount) * 100) / 100;
    }
  }

  const handleBook = async () => {
    if (!user) {
      navigate("/auth");
      onOpenChange(false);
      return;
    }

    if (!selectedDate || !selectedTime) {
      toast.error("Please select a date and time");
      return;
    }

    if (paymentMethod === "card" && !selectedPaymentMethodId && savedPaymentMethods.length > 0) {
      toast.error("Please select a payment method");
      return;
    }

    try {
      let paymentIntentId: string | undefined;

      // Process payment if using card
      if (paymentMethod === "card" && selectedPaymentMethodId) {
        const { data: memberData } = await supabase
          .from("members")
          .select("id, stripe_customer_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!memberData?.stripe_customer_id) {
          throw new Error("No payment method on file. Please add a payment method first.");
        }

        const totalAmountCents = Math.round(finalPrice * 100);

        const { data: chargeData, error: chargeError } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "charge_saved_card",
            amount: totalAmountCents,
            description: `Spa Service: ${service.name}`,
            stripeCustomerId: memberData.stripe_customer_id,
            paymentMethodId: selectedPaymentMethodId,
          },
        });

        if (chargeError) throw chargeError;
        if (chargeData?.error) throw new Error(chargeData.error);

        paymentIntentId = chargeData?.paymentIntentId || chargeData?.id;
      }

      await bookAppointment.mutateAsync({
        serviceId: service.id,
        serviceName: service.name,
        serviceCategory: service.category,
        servicePrice: service.price,
        appointmentDate: selectedDate,
        appointmentTime: selectedTime,
        durationMinutes,
        cleanupMinutes,
        memberNotes: memberNotes || undefined,
        paymentMethod,
        paymentIntentId,
      });

      onOpenChange(false);
      setSelectedDate(undefined);
      setSelectedTime("");
      setMemberNotes("");
    } catch (error: any) {
      console.error("Booking error:", error);
      toast.error(error.message || "Failed to book appointment");
    }
  };

  const minDate = addDays(new Date(), 1);
  const maxDate = addMonths(new Date(), 3);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book {service.name}</DialogTitle>
          <DialogDescription>
            Select your preferred date and time for this {service.duration} service.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Service Details */}
          <div className="p-4 bg-secondary/50 rounded-md">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-semibold">{service.name}</h4>
                <p className="text-sm text-muted-foreground">{service.category}</p>
              </div>
              <div className="text-right">
                {membership && finalPrice < service.price ? (
                  <>
                    <p className="text-sm text-muted-foreground line-through">${service.price.toFixed(2)}</p>
                    <p className="text-lg font-semibold text-accent">${finalPrice.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Member Price</p>
                  </>
                ) : (
                  <p className="text-lg font-semibold">${service.price.toFixed(2)}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {service.duration}
              </span>
              <span className="text-xs">+ {service.cleanupTime} cleanup</span>
            </div>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Select Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < minDate || date > maxDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Selection */}
          {selectedDate && (
            <div className="space-y-2">
              <Label>Select Time</Label>
              {isCheckingAvailability ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-accent mr-2" />
                  <span className="text-sm text-muted-foreground">Checking availability...</span>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                  {TIME_SLOTS.map((time) => {
                    const isAvailable = availableSlots.has(time);
                    const isSelected = selectedTime === time;

                    return (
                      <button
                        key={time}
                        type="button"
                        onClick={() => isAvailable && setSelectedTime(time)}
                        disabled={!isAvailable}
                        className={cn(
                          "px-3 py-2 text-sm rounded-md border transition-colors",
                          isSelected && "bg-accent text-accent-foreground border-accent",
                          !isSelected && isAvailable && "hover:bg-secondary border-border",
                          !isAvailable && "opacity-50 cursor-not-allowed bg-muted"
                        )}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={(value: "card" | "member_account") => setPaymentMethod(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Credit/Debit Card
                  </div>
                </SelectItem>
                {membership && (
                  <SelectItem value="member_account">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Charge to Member Account
                    </div>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {paymentMethod === "card" && savedPaymentMethods.length > 0 && (
            <div className="space-y-2">
              <Label>Select Card</Label>
              <Select value={selectedPaymentMethodId || ""} onValueChange={setSelectedPaymentMethodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a card" />
                </SelectTrigger>
                <SelectContent>
                  {savedPaymentMethods.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>
                      {pm.card?.brand?.toUpperCase()} •••• {pm.card?.last4} (Expires {pm.card?.exp_month}/{pm.card?.exp_year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Member Notes */}
          <div className="space-y-2">
            <Label>Special Requests or Notes (Optional)</Label>
            <Textarea
              placeholder="Any preferences, concerns, or special requests..."
              value={memberNotes}
              onChange={(e) => setMemberNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Total */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Total</span>
              <span className="text-accent">${finalPrice.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleBook}
            disabled={
              !selectedDate ||
              !selectedTime ||
              bookAppointment.isPending ||
              isCheckingAvailability ||
              (paymentMethod === "card" && !selectedPaymentMethodId && savedPaymentMethods.length > 0)
            }
          >
            {bookAppointment.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Booking...
              </>
            ) : (
              `Book for $${finalPrice.toFixed(2)}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

