import { useState, useEffect } from "react";
import {
  readKidsCareDraft,
  writeKidsCareDraft,
  clearKidsCareDraft,
} from "@/lib/bookingDraft";
import { useAuth } from "@/contexts/AuthContext";
import { usePhoneOnFile } from "@/hooks/usePhoneOnFile";
import { PhoneRequiredGate } from "@/components/booking/PhoneRequiredGate";

import { useNavigate } from "react-router-dom";
import { useBookKidsCare, useKidsCarePasses } from "@/hooks/useKidsCareBooking";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useKidsCareHoursForDate } from "@/hooks/useKidsCareHours";
import { useKidsCareChildren } from "@/hooks/useKidsCareChildren";
import { KidsCarePassGate } from "@/components/booking/KidsCarePassGate";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { format, addDays, addHours, parse, parseISO } from "date-fns";
import { formatTime12h } from "@/lib/timeFormat";
import { CalendarIcon, Clock, Loader2, AlertCircle, Info, CheckCircle2, MapPin, Baby } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface KidsCareBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
}

// All possible half-hour slots
const ALL_TIME_SLOTS = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30",
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00",
];

const MAX_DURATION_HOURS = 2;

export function KidsCareBookingModal({ open, onOpenChange, defaultDate }: KidsCareBookingModalProps) {
  const { user } = useAuth();
  const { hasPhone, isLoading: phoneLoading } = usePhoneOnFile();

  const navigate = useNavigate();
  const bookKidsCare = useBookKidsCare();
  const { data: availablePasses, isLoading: passesLoading } = useKidsCarePasses();
  const { profile } = useUserProfile();
  const { data: savedChildren, isLoading: childrenLoading } = useKidsCareChildren();

  // Fetch pass-child assignments to enforce one pass per child
  const { data: passChildMap } = useQuery({
    queryKey: ["kids-care-pass-child-map", user?.id],
    queryFn: async () => {
      if (!user) return {};
      try {
        const { data } = await (supabase.from as any)("kids_care_bookings")
          .select("pass_id, child_name")
          .eq("user_id", user.id)
          .not("status", "in", '("cancelled","no_show")');
        const map: Record<string, string> = {};
        for (const b of (data || [])) {
          if (b.pass_id && !map[b.pass_id]) map[b.pass_id] = b.child_name;
        }
        return map;
      } catch { return {}; }
    },
    enabled: !!user,
  });

  // Initialize from persisted draft if present.
  const initialDraft = (() => readKidsCareDraft())();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    if (initialDraft?.date) {
      try { return parseISO(initialDraft.date); } catch { /* ignore */ }
    }
    return defaultDate || new Date();
  });
  const [selectedStartTime, setSelectedStartTime] = useState<string>(initialDraft?.startTime || "");
  const [selectedEndTime, setSelectedEndTime] = useState<string>("");
  const [selectedChildId, setSelectedChildId] = useState<string>(initialDraft?.childId || "");
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState<string>("");
  const [selectedPassId, setSelectedPassId] = useState<string>("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [parentNotes, setParentNotes] = useState(initialDraft?.notes || "");
  const [confirmedBooking, setConfirmedBooking] = useState<{
    childName: string;
    date: string;
    startTime: string;
    endTime: string;
    room: string;
  } | null>(null);

  // Persist key fields as a draft so users can resume after dismissing.
  useEffect(() => {
    if (!open || confirmedBooking) return;
    writeKidsCareDraft({
      childId: selectedChildId || null,
      date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : null,
      startTime: selectedStartTime || null,
      notes: parentNotes,
    });
  }, [open, confirmedBooking, selectedChildId, selectedDate, selectedStartTime, parentNotes]);


  // Fetch hour slots for the selected date (now returns array of slots)
  const { data: daySlots, isLoading: hoursLoading, refetch: refetchDaySlots } = useKidsCareHoursForDate(selectedDate);

  // Force fresh fetch whenever the modal opens or date changes — prevents
  // members seeing stale published times if the app stayed open.
  useEffect(() => {
    if (open) {
      refetchDaySlots();
    }
  }, [open, selectedDate, refetchDaySlots]);

  // Filter time slots based on published hour slots for the day
  const getFilteredTimeSlots = (): string[] => {
    if (!daySlots || daySlots.length === 0) return [];
    // Union all slot ranges
    const allowed = new Set<string>();
    for (const slot of daySlots) {
      const openTime = slot.open_time.slice(0, 5);
      const closeTime = slot.close_time.slice(0, 5);
      for (const t of ALL_TIME_SLOTS) {
        if (t >= openTime && t < closeTime) allowed.add(t);
      }
    }
    // If booking for today, filter out time slots that have already passed
    const now = new Date();
    const isToday = selectedDate && 
      selectedDate.getFullYear() === now.getFullYear() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getDate() === now.getDate();
    
    const currentTimeStr = isToday ? format(now, "HH:mm") : "00:00";
    
    return ALL_TIME_SLOTS.filter((t) => allowed.has(t) && t >= currentTimeStr);
  };

  const filteredTimeSlots = getFilteredTimeSlots();
  const dayIsClosed = !hoursLoading && (!daySlots || daySlots.length === 0);
  const noHoursPublished = !hoursLoading && (!daySlots || daySlots.length === 0);

  // Silently clear any selected start/end time that is no longer valid
  // (e.g. staff just removed that slot). No alert — selection just disappears.
  useEffect(() => {
    if (!selectedStartTime) return;
    if (filteredTimeSlots.length === 0 || !filteredTimeSlots.includes(selectedStartTime)) {
      setSelectedStartTime("");
      setSelectedEndTime("");
    }
  }, [filteredTimeSlots.join("|"), selectedStartTime]);

  // Calculate available end times based on start time, max duration, and slot boundaries
  const getAvailableEndTimes = (startTime: string): string[] => {
    if (!startTime || !daySlots || daySlots.length === 0) return [];

    // Find which slot this start time falls within
    const slot = daySlots.find((s) => {
      const open = s.open_time.slice(0, 5);
      const close = s.close_time.slice(0, 5);
      return startTime >= open && startTime < close;
    });

    const slotClose = slot ? slot.close_time.slice(0, 5) : "20:30";

    const startTimeObj = parse(startTime, "HH:mm", new Date());
    const endTimes: string[] = [];

    for (let hours = 0.5; hours <= MAX_DURATION_HOURS; hours += 0.5) {
      const endTime = addHours(startTimeObj, hours);
      const endTimeStr = format(endTime, "HH:mm");
      // End time must be within the slot's close time
      if (endTimeStr <= slotClose) {
        endTimes.push(endTimeStr);
      }
    }

    return endTimes;
  };

  const handleBook = async () => {
    if (!user) {
      navigate("/auth");
      onOpenChange(false);
      return;
    }

    // Check agreements and service form
    if (!profile?.kids_care_agreement_signed) {
      toast.error("Please sign the Kids Care Agreement first. Go to Waivers & Agreements page.");
      navigate("/member/waivers");
      onOpenChange(false);
      return;
    }

    if (!profile?.kids_care_service_form_completed) {
      toast.error("Please complete the Kids Care Service Form first.");
      navigate("/member/kids-care-service-form");
      onOpenChange(false);
      return;
    }

    // Resolve child info from saved profile
    const selectedChild = savedChildren?.find(c => c.id === selectedChildId);
    const resolvedChildName = selectedChild?.full_name || childName.trim();
    
    if (!resolvedChildName) {
      toast.error("Please select a child");
      return;
    }

    // Calculate age from DOB
    let ageNum = 0;
    if (selectedChild?.date_of_birth) {
      const dob = new Date(selectedChild.date_of_birth);
      const ageDiff = Date.now() - dob.getTime();
      ageNum = ageDiff / (1000 * 60 * 60 * 24 * 365.25);
    } else {
      ageNum = parseFloat(childAge);
      if (!childAge || isNaN(ageNum) || ageNum < 0.333 || ageNum > 8) {
        toast.error("Please enter a valid age (4 months to 8 years)");
        return;
      }
    }

    if (!selectedDate) {
      toast.error("Please select a date");
      return;
    }

    if (!selectedStartTime) {
      toast.error("Please select a start time");
      return;
    }

    if (!selectedEndTime) {
      toast.error("Please select an end time");
      return;
    }

    if (!selectedPassId) {
      toast.error("Please select a Kids Care Pass");
      return;
    }

    try {
      const booking = await bookKidsCare.mutateAsync({
        childName: resolvedChildName,
        childAge: ageNum,
        childDob: selectedChild?.date_of_birth ? new Date(selectedChild.date_of_birth) : undefined,
        bookingDate: selectedDate,
        startTime: selectedStartTime,
        endTime: selectedEndTime,
        specialInstructions: specialInstructions || selectedChild?.special_instructions || undefined,
        parentNotes: parentNotes || undefined,
        passId: selectedPassId,
      });

      // Show confirmation
      setConfirmedBooking({
        childName: resolvedChildName,
        date: format(selectedDate, "EEEE, MMMM d, yyyy"),
        startTime: selectedStartTime,
        endTime: selectedEndTime,
        room: booking?.room || (["Infants", "Toddlers"].includes(booking?.age_group || "") ? "Little Stars" : "Big Stars"),
      });

      // Reset form + clear persisted draft
      clearKidsCareDraft();
      setSelectedChildId("");
      setChildName("");
      setChildAge("");
      setSelectedDate(undefined);
      setSelectedStartTime("");
      setSelectedEndTime("");
      setSelectedPassId("");
      setSpecialInstructions("");
      setParentNotes("");
    } catch (error: any) {
      console.error("Booking error:", error);
      // Error toast is handled by the hook
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = today;
  const maxDate = addDays(new Date(), 7);

  // Calculate duration
  const durationHours = selectedStartTime && selectedEndTime
    ? Math.abs(parse(selectedEndTime, "HH:mm", new Date()).getTime() - parse(selectedStartTime, "HH:mm", new Date()).getTime()) / (1000 * 60 * 60)
    : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) setConfirmedBooking(null);
      onOpenChange(o);
    }}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
        {confirmedBooking ? (
          // ✅ Booking Confirmation Screen
          <div className="text-center py-6 space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Booking Confirmed!</h2>
              <p className="text-sm text-muted-foreground mt-1">Your Kids Care session has been reserved</p>
            </div>
            <Card className="text-left">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Baby className="h-4 w-4 text-accent" />
                  <span className="font-medium">{confirmedBooking.childName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-4 w-4 text-accent" />
                  <span>{confirmedBooking.date}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-accent" />
                  <span>{confirmedBooking.startTime} – {confirmedBooking.endTime}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-accent" />
                  <span>{confirmedBooking.room}</span>
                </div>
              </CardContent>
            </Card>
            <div className="flex flex-col gap-2">
              <Button onClick={() => { setConfirmedBooking(null); onOpenChange(false); navigate("/member/kids-care-bookings"); }}>
                View My Bookings
              </Button>
              <Button variant="outline" onClick={() => { setConfirmedBooking(null); onOpenChange(false); }}>
                Done
              </Button>
            </div>
          </div>
        ) : (
        <>
        <DialogHeader>
          <DialogTitle>Book Kids Care Session</DialogTitle>
          <DialogDescription>
            Reserve a supervised kids care session. Maximum 2 hours per child per day.
          </DialogDescription>
        </DialogHeader>

        {/* Agreement Status Alert */}
        {profile && (!profile.kids_care_agreement_signed || !profile.kids_care_service_form_completed) && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                {!profile.kids_care_agreement_signed && (
                  <p>• Please sign the Kids Care Agreement on the <Button variant="link" className="h-auto p-0 underline font-semibold" onClick={() => { navigate("/member/waivers"); onOpenChange(false); }}>Waivers & Agreements</Button> page.</p>
                )}
                {!profile.kids_care_service_form_completed && (
                  <p>• Please complete the <Button variant="link" className="h-auto p-0 underline font-semibold" onClick={() => { navigate("/member/kids-care-service-form"); onOpenChange(false); }}>Kids Care Service Form</Button>.</p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!user ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please <a href="/auth" className="text-accent underline">sign in</a> to book kids care.
            </AlertDescription>
          </Alert>
        ) : passesLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-accent mr-2" />
            <span className="text-sm text-muted-foreground">Loading passes...</span>
          </div>
        ) : !availablePasses || availablePasses.length === 0 ? (
          <div className="py-2">
            <KidsCarePassGate />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Kids Care Pass Selection */}
            <div className="space-y-2">
              <Label>Kids Care Pass *</Label>
              {(() => {
                const selectedChild = savedChildren?.find(c => c.id === selectedChildId);
                const childNameForFilter = selectedChild?.full_name || childName;
                const filteredPasses = (availablePasses || []).filter((pass) => {
                  if (!childNameForFilter || !passChildMap) return true;
                  const assigned = passChildMap[pass.id];
                  return !assigned || assigned.toLowerCase().trim() === childNameForFilter.toLowerCase().trim();
                });
                return filteredPasses.length > 0 ? (
                  <Select value={selectedPassId} onValueChange={setSelectedPassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a pass" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredPasses.map((pass) => (
                        <SelectItem key={pass.id} value={pass.id}>
                          {pass.pass_type} - {pass.classes_remaining} sessions remaining
                          {pass.expires_at && ` (Expires ${format(parseISO(pass.expires_at), "MMM d, yyyy")})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {(availablePasses || []).length > 0
                      ? "No available pass for this child. Each child needs their own pass."
                      : "No active pass found."}
                  </p>
                );
              })()}
            </div>

            {/* Child Selection */}
            <div className="space-y-4">
              <h4 className="font-semibold">Select Child</h4>
              
              {childrenLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading saved profiles...
                </div>
              ) : savedChildren && savedChildren.length > 0 ? (
                <div className="space-y-2">
                  <Label>Registered Child *</Label>
                  <Select value={selectedChildId} onValueChange={(value) => {
                    setSelectedChildId(value);
                    const child = savedChildren.find(c => c.id === value);
                    if (child) {
                      setChildName(child.full_name);
                      if (child.date_of_birth) {
                        const dob = new Date(child.date_of_birth);
                        const ageDiff = Date.now() - dob.getTime();
                        const ageYears = (ageDiff / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);
                        setChildAge(ageYears);
                      }
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a child" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedChildren.map((child) => {
                        let ageLabel = "";
                        if (child.date_of_birth) {
                          const dob = new Date(child.date_of_birth);
                          const ageYears = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
                          ageLabel = ageYears < 1 
                            ? ` — ${Math.round(ageYears * 12)} months` 
                            : ` — ${ageYears.toFixed(1)} years`;
                        }
                        return (
                          <SelectItem key={child.id} value={child.id}>
                            {child.full_name}{ageLabel}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => { navigate("/member/kids-care-service-form"); onOpenChange(false); }}
                  >
                    + Add a new child profile
                  </Button>
                </div>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No children registered yet.{" "}
                    <Button
                      variant="link"
                      className="h-auto p-0 underline font-semibold"
                      onClick={() => { navigate("/member/kids-care-service-form"); onOpenChange(false); }}
                    >
                      Add a child profile
                    </Button>{" "}
                    to continue.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Booking Details */}
            <div className="space-y-4">
              <h4 className="font-semibold">Booking Details</h4>

              <div className="space-y-2">
                <Label>Date *</Label>
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
                <p className="text-xs text-muted-foreground">
                  Bookings can be made up to 7 days in advance
                </p>
              </div>

              {/* Day closed / no hours warning */}
              {selectedDate && dayIsClosed && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {noHoursPublished
                      ? "Hours haven't been published for this day yet. Please try another date."
                      : "Kids Care is closed on this day. Please select a different date."}
                  </AlertDescription>
                </Alert>
              )}

              {selectedDate && !dayIsClosed && filteredTimeSlots.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time *</Label>
                  <Select value={selectedStartTime} onValueChange={(value) => {
                    setSelectedStartTime(value);
                    setSelectedEndTime(""); // Reset end time when start time changes
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select start time" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTimeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {formatTime12h(time)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>End Time *</Label>
                  <Select 
                    value={selectedEndTime} 
                    onValueChange={setSelectedEndTime}
                    disabled={!selectedStartTime}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select end time" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedStartTime && getAvailableEndTimes(selectedStartTime).map((time) => {
                        const startTime = parse(selectedStartTime, "HH:mm", new Date());
                        const endTime = parse(time, "HH:mm", new Date());
                        const durationMs = endTime.getTime() - startTime.getTime();
                        const durationHours = durationMs / (1000 * 60 * 60);
                        const hours = Math.floor(durationHours);
                        const minutes = Math.round((durationHours - hours) * 60);
                        const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                        return (
                          <SelectItem key={time} value={time}>
                            {formatTime12h(time)} ({durationText})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {selectedStartTime && selectedEndTime && (
                    <p className="text-xs text-muted-foreground">
                      Duration: {durationHours.toFixed(1)} hours
                    </p>
                  )}
                </div>
              </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Special Instructions (Optional)</Label>
              <Textarea
                placeholder="Diapers, bottles, allergies, special care needs..."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Parent Notes (Optional)</Label>
              <Textarea
                placeholder="Any additional information for staff..."
                value={parentNotes}
                onChange={(e) => setParentNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Policies */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs space-y-1">
                <p>• Maximum 2-hour session per child per day</p>
                <p>• Parent/guardian must remain on premises during care</p>
                <p>• Cancellations must be made at least 2 hours in advance</p>
                <p>• Children must be in good health (no fever, runny nose, or contagious conditions)</p>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {user && !phoneLoading && !hasPhone && (
          <div className="mt-2">
            <PhoneRequiredGate reason="We use it for pickup coordination and last-minute schedule changes. Required to book kids care." />
          </div>
        )}
        <div className="flex gap-2 justify-end">

          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {user && availablePasses && availablePasses.length > 0 && (
            <Button
              onClick={handleBook}
              disabled={
                bookKidsCare.isPending ||
                !selectedChildId ||
                !selectedDate ||
                !selectedStartTime ||
                !selectedEndTime ||
                !selectedPassId
              }
            >
              {bookKidsCare.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Booking...
                </>
              ) : (
                "Confirm Booking"
              )}
            </Button>
          )}
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}

