import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useBookKidsCare, useKidsCarePasses } from "@/hooks/useKidsCareBooking";
import { useUserProfile } from "@/hooks/useUserProfile";
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
import { format, addDays, addHours, parse, parseISO } from "date-fns";
import { CalendarIcon, Clock, Loader2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface KidsCareBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIME_SLOTS = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30",
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "16:00", "16:30", "17:00",
  "17:30", "18:00", "18:30", "19:00", "19:30", "20:00",
];

const MAX_DURATION_HOURS = 2;

export function KidsCareBookingModal({ open, onOpenChange }: KidsCareBookingModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const bookKidsCare = useBookKidsCare();
  const { data: availablePasses, isLoading: passesLoading } = useKidsCarePasses();
  const { profile } = useUserProfile();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [selectedStartTime, setSelectedStartTime] = useState<string>("");
  const [selectedEndTime, setSelectedEndTime] = useState<string>("");
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState<string>("");
  const [childDob, setChildDob] = useState<Date | undefined>(undefined);
  const [selectedPassId, setSelectedPassId] = useState<string>("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [parentNotes, setParentNotes] = useState("");

  // Calculate available end times based on start time and max duration
  const getAvailableEndTimes = (startTime: string): string[] => {
    if (!startTime) return [];

    const startTimeObj = parse(startTime, "HH:mm", new Date());
    const endTimes: string[] = [];

    // Generate end times in 30-minute increments up to 2 hours
    for (let hours = 0.5; hours <= MAX_DURATION_HOURS; hours += 0.5) {
      const endTime = addHours(startTimeObj, hours);
      const endTimeStr = format(endTime, "HH:mm");

      // Make sure end time is within valid hours (before 20:30)
      if (endTimeStr <= "20:30") {
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

    // Validation
    if (!childName.trim()) {
      toast.error("Please enter child's name");
      return;
    }

    const ageNum = parseFloat(childAge);
    if (!childAge || isNaN(ageNum) || ageNum < 0.25 || ageNum > 10) {
      toast.error("Please enter a valid age (3 months to 10 years)");
      return;
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
      await bookKidsCare.mutateAsync({
        childName: childName.trim(),
        childAge: ageNum,
        childDob: childDob,
        bookingDate: selectedDate,
        startTime: selectedStartTime,
        endTime: selectedEndTime,
        specialInstructions: specialInstructions || undefined,
        parentNotes: parentNotes || undefined,
        passId: selectedPassId,
      });

      // Reset form
      setChildName("");
      setChildAge("");
      setChildDob(undefined);
      setSelectedDate(undefined);
      setSelectedStartTime("");
      setSelectedEndTime("");
      setSelectedPassId("");
      setSpecialInstructions("");
      setParentNotes("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Booking error:", error);
      // Error toast is handled by the hook
    }
  };

  const minDate = addDays(new Date(), 1);
  const maxDate = addDays(new Date(), 2); // 48 hours in advance

  // Calculate duration
  const durationHours = selectedStartTime && selectedEndTime
    ? Math.abs(parse(selectedEndTime, "HH:mm", new Date()).getTime() - parse(selectedStartTime, "HH:mm", new Date()).getTime()) / (1000 * 60 * 60)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              You need an active Kids Care Pass to book.{" "}
              <a href="/class-passes" className="text-accent underline">Purchase a pass</a> to continue.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6 py-4">
            {/* Kids Care Pass Selection */}
            <div className="space-y-2">
              <Label>Kids Care Pass *</Label>
              <Select value={selectedPassId} onValueChange={setSelectedPassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a pass" />
                </SelectTrigger>
                <SelectContent>
                  {availablePasses.map((pass) => (
                    <SelectItem key={pass.id} value={pass.id}>
                      {pass.pass_type} - {pass.classes_remaining} sessions remaining
                      {pass.expires_at && ` (Expires ${format(parseISO(pass.expires_at), "MMM d, yyyy")})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Child Information */}
            <div className="space-y-4">
              <h4 className="font-semibold">Child Information</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Child's Name *</Label>
                  <Input
                    placeholder="Child's full name"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Age (in years) *</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="10"
                    placeholder="e.g., 2.5"
                    value={childAge}
                    onChange={(e) => setChildAge(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Age: 3 months (0.25) to 10 years
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Date of Birth (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !childDob && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {childDob ? format(childDob, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={childDob}
                      onSelect={setChildDob}
                      disabled={(date) => date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
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
                  Bookings can be made up to 48 hours in advance
                </p>
              </div>

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
                      {TIME_SLOTS.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
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
                            {time} ({durationText})
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

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {user && availablePasses && availablePasses.length > 0 && (
            <Button
              onClick={handleBook}
              disabled={
                bookKidsCare.isPending ||
                !childName ||
                !childAge ||
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
      </DialogContent>
    </Dialog>
  );
}

