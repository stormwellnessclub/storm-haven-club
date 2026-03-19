import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Baby, Clock, CheckCircle2, Loader2, AlertTriangle, Calendar, Info, Plus } from "lucide-react";
import { HourRequestForm } from "@/components/kids-care/HourRequestForm";
import { KidsCareBookingModal } from "@/components/booking/KidsCareBookingModal";
import { useMyKidsCareBookings, useCancelKidsCareBooking } from "@/hooks/useKidsCareBooking";
import { useConfirmPickup, useUpcomingKidsCareSlots } from "@/hooks/useKidsCareHours";
import { format, parseISO } from "date-fns";
import { formatTime12h } from "@/lib/timeFormat";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function KidsCareBookings() {
  const { data: bookings, isLoading } = useMyKidsCareBookings();
  const cancelBooking = useCancelKidsCareBooking();
  const confirmPickup = useConfirmPickup();
  const { data: upcomingSlots, isLoading: slotsLoading } = useUpcomingKidsCareSlots(7);
  const [cancelDialogId, setCancelDialogId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingDefaultDate, setBookingDefaultDate] = useState<Date | undefined>(undefined);

  const handleCancel = () => {
    if (!cancelDialogId) return;
    cancelBooking.mutate(
      { bookingId: cancelDialogId, reason: cancelReason },
      { onSuccess: () => { setCancelDialogId(null); setCancelReason(""); } }
    );
  };

  const openBookingForDate = (date?: Date) => {
    setBookingDefaultDate(date);
    setBookingModalOpen(true);
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const activeBookings = bookings?.filter((b) =>
    ["confirmed", "checked_in", "checked_out"].includes(b.status) &&
    (b.booking_date >= todayStr)
  ) || [];

  const pastBookings = bookings?.filter((b) =>
    !activeBookings.some((a) => a.id === b.id)
  ) || [];

  const getRoomName = (ageGroup: string | null, room: string | null) => {
    if (room) return room;
    if (!ageGroup) return "Little Stars";
    return ["Infants", "Toddlers"].includes(ageGroup) ? "Little Stars" : "Big Stars";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-accent/10 text-accent border-accent/30";
      case "checked_in": return "bg-success/10 text-success border-success/30";
      case "checked_out": return "bg-muted text-muted-foreground";
      case "cancelled": return "bg-destructive/10 text-destructive";
      default: return "";
    }
  };

  // Group upcoming slots by date
  const slotsByDate = (upcomingSlots || []).reduce<Record<string, typeof upcomingSlots>>((acc, slot) => {
    if (!acc[slot.slot_date]) acc[slot.slot_date] = [];
    acc[slot.slot_date]!.push(slot);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <MemberLayout title="Kids Care Bookings">
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </MemberLayout>
    );
  }

  return (
    <MemberLayout title="Kids Care Bookings">
      <div className="space-y-8 max-w-3xl">

        {/* Book a Session CTA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Kids Care</h2>
            <p className="text-sm text-muted-foreground">Book a supervised session for your child during your workout.</p>
          </div>
          <Button onClick={() => openBookingForDate()} className="gap-2">
            <Plus className="h-4 w-4" />
            Book a Session
          </Button>
        </div>

        {/* Registration Reminder */}
        <Alert className="border-accent/30 bg-accent/5">
          <Info className="h-4 w-4 text-accent" />
          <AlertDescription className="text-sm">
            <strong>Tip:</strong> Please register your child before booking.{" "}
            <a href="/member/kids-care-service-form" className="text-accent underline font-semibold">
              Add a child profile
            </a>{" "}
            from the Kids Care Service Form, then select them when booking a session.
          </AlertDescription>
        </Alert>

        {/* Upcoming Schedule */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Upcoming Open Hours
          </h2>
          {slotsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : Object.keys(slotsByDate).length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-muted-foreground">
                <p>No Kids Care hours scheduled for the next 7 days.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(slotsByDate).map(([date, slots]) => (
                <Card key={date} className="cursor-pointer hover:border-accent/50 transition-colors" onClick={() => openBookingForDate(parseISO(date))}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold">
                        {date === todayStr ? "Today" : format(parseISO(date), "EEEE, MMM d")}
                      </p>
                      <Button variant="ghost" size="sm" className="text-xs text-accent h-auto py-1 px-2">
                        Book →
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {slots!.map((slot, i) => (
                        <div key={i} className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime12h(slot.open_time)} – {formatTime12h(slot.close_time)}
                          {slot.label && (
                            <Badge variant="outline" className="ml-1 text-xs">{slot.label}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Request Hours Section */}
        <HourRequestForm />

        {/* Active / Upcoming */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-accent" />
            Active & Upcoming
          </h2>
          {activeBookings.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Baby className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No active bookings</p>
                <Button variant="link" className="mt-2" onClick={() => openBookingForDate()}>
                  Book your first session
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeBookings.map((booking) => {
                const isCheckedOut = booking.status === "checked_out";
                const needsPickupConfirm = isCheckedOut && !booking.parent_confirmed_pickup;

                return (
                  <Card key={booking.id} className={needsPickupConfirm ? "border-warning/50" : ""}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{booking.child_name}</CardTitle>
                          <CardDescription>
                            {format(parseISO(booking.booking_date), "EEEE, MMM d, yyyy")} • {getRoomName(booking.age_group, booking.room)}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className={getStatusColor(booking.status)}>
                          {booking.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime12h(booking.start_time)} - {formatTime12h(booking.end_time)}
                      </div>

                      {booking.special_instructions && (
                        <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                          {booking.special_instructions}
                        </p>
                      )}

                      {needsPickupConfirm && (
                        <Alert className="border-warning/30 bg-warning/5">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          <AlertDescription className="flex items-center justify-between">
                            <span className="text-sm">Staff has checked out your child. Please confirm pickup.</span>
                            <Button
                              size="sm"
                              onClick={() => confirmPickup.mutate(booking.id)}
                              disabled={confirmPickup.isPending}
                            >
                              {confirmPickup.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              )}
                              Confirm Pickup
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}

                      {isCheckedOut && booking.parent_confirmed_pickup && (
                        <div className="flex items-center gap-1 text-xs text-success">
                          <CheckCircle2 className="h-3 w-3" />
                          Pickup confirmed at {format(new Date(booking.parent_confirmed_at!), "h:mm a")}
                        </div>
                      )}

                      {booking.status === "confirmed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setCancelDialogId(booking.id)}
                        >
                          Cancel Booking
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Past Bookings */}
        {pastBookings.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Past Bookings</h2>
            <div className="space-y-3">
              {pastBookings.slice(0, 10).map((booking) => (
                <Card key={booking.id} className="opacity-75">
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{booking.child_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(booking.booking_date), "MMM d, yyyy")} • {formatTime12h(booking.start_time)} - {formatTime12h(booking.end_time)}
                      </p>
                    </div>
                    <Badge variant="outline" className={getStatusColor(booking.status)}>
                      {booking.status.replace("_", " ")}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cancel Dialog */}
      <Dialog open={!!cancelDialogId} onOpenChange={(open) => !open && setCancelDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Cancellations must be made at least 2 hours before the booking start time.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for cancellation (optional)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setCancelDialogId(null)}>Keep Booking</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelBooking.isPending}>
              {cancelBooking.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Cancel Booking
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Modal */}
      <KidsCareBookingModal
        open={bookingModalOpen}
        onOpenChange={setBookingModalOpen}
        defaultDate={bookingDefaultDate}
      />
    </MemberLayout>
  );
}
