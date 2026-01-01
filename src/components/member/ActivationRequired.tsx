import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, addDays, isAfter, isBefore, startOfDay, endOfMonth } from "date-fns";
import { Calendar, Clock, CheckCircle, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import stormLogo from "@/assets/storm-logo-gold.png";

interface MemberData {
  id: string;
  member_id: string;
  membership_type: string;
  status: string;
  approved_at: string | null;
  activation_deadline: string | null;
  activated_at: string | null;
  first_name: string;
  last_name: string;
  email: string;
}

interface ActivationRequiredProps {
  memberData: MemberData;
}

export function ActivationRequired({ memberData }: ActivationRequiredProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const deadlineDate = memberData.activation_deadline 
    ? new Date(memberData.activation_deadline) 
    : addDays(new Date(), 7);
  
  const today = startOfDay(new Date());
  const daysRemaining = Math.max(0, Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  const activateMutation = useMutation({
    mutationFn: async (startDate: Date) => {
      const { error } = await supabase
        .from("members")
        .update({
          status: "active",
          membership_start_date: format(startDate, "yyyy-MM-dd"),
          activated_at: new Date().toISOString(),
        })
        .eq("id", memberData.id);

      if (error) throw error;

      // Create credits for Diamond members
      const isDiamond = memberData.membership_type.toLowerCase().includes("diamond");
      if (isDiamond && user) {
        const currentMonth = format(new Date(), "yyyy-MM");
        const monthEnd = endOfMonth(new Date());
        
        const { error: creditsError } = await supabase
          .from("class_credits")
          .insert({
            user_id: user.id,
            member_id: memberData.id,
            credits_total: 10,
            credits_remaining: 10,
            month_year: currentMonth,
            expires_at: monthEnd.toISOString(),
          });

        if (creditsError) {
          console.error("Failed to create credits:", creditsError);
          // Don't throw - activation succeeded, just log the error
        }
      }

      // Send activation confirmation email
      try {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "membership_activated",
            to: memberData.email,
            data: {
              name: memberData.first_name,
              startDate: format(startDate, "MMMM d, yyyy"),
              membershipType: memberData.membership_type,
            },
          },
        });
      } catch (emailError) {
        console.error("Failed to send activation email:", emailError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application-status"] });
      toast.success("Membership activated! Welcome to Storm Wellness Club.");
      setTimeout(() => {
        navigate("/member", { replace: true });
      }, 500);
    },
    onError: (error) => {
      console.error("Activation error:", error);
      toast.error("Failed to activate membership. Please try again.");
    },
  });

  const handleActivate = () => {
    if (!selectedDate) {
      toast.error("Please select a start date");
      return;
    }
    activateMutation.mutate(selectedDate);
  };

  // Date validation for calendar
  const isDateDisabled = (date: Date) => {
    const dateStart = startOfDay(date);
    return isBefore(dateStart, today) || isAfter(dateStart, deadlineDate);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <img src={stormLogo} alt="Storm Wellness Club" className="h-16 mx-auto" />
          </div>
          <div>
            <CardTitle className="text-2xl font-serif">Welcome, {memberData.first_name}</CardTitle>
            <CardDescription className="mt-2">
              Your membership application has been approved!
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Countdown Banner */}
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-accent mb-1">
              <Clock className="h-5 w-5" />
              <span className="font-semibold">{daysRemaining} days remaining</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Please select your start date by {format(deadlineDate, "MMMM d, yyyy")}
            </p>
          </div>

          {/* Instructions */}
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Choose when you'd like your membership to begin. Your billing will start on the date you select.
            </p>
            <p>
              If no date is selected by the deadline, your membership will automatically begin on {format(deadlineDate, "MMMM d, yyyy")}.
            </p>
          </div>

          {/* Date Picker */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Select Start Date</label>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Choose a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setIsCalendarOpen(false);
                  }}
                  disabled={isDateDisabled}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Membership Details */}
          <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Member ID</span>
              <span className="font-medium">{memberData.member_id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Membership Tier</span>
              <span className="font-medium">{memberData.membership_type}</span>
            </div>
            {selectedDate && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Start Date</span>
                <span className="font-medium text-accent">{format(selectedDate, "MMMM d, yyyy")}</span>
              </div>
            )}
          </div>

          {/* Activate Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleActivate}
            disabled={!selectedDate || activateMutation.isPending}
          >
            {activateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Activating...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Activate Membership
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By activating, you confirm that billing will begin on your selected start date.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}