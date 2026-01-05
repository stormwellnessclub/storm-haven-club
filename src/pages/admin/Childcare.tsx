import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Baby, Search, UserCheck, UserX, Clock, Users, Loader2, Calendar } from "lucide-react";
import { useState } from "react";
import { useAdminKidsCareBookings, useUpdateKidsCareBookingStatus } from "@/hooks/useAdminKidsCareBookings";
import { format, parse } from "date-fns";

export default function Childcare() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const { data: bookings, isLoading } = useAdminKidsCareBookings({ 
    bookingDate: selectedDate 
  });
  const updateStatus = useUpdateKidsCareBookingStatus();

  const todayBookings = bookings?.filter(booking => {
    const bookingDate = new Date(booking.booking_date);
    return bookingDate.toDateString() === selectedDate.toDateString();
  }) || [];

  const checkedInCount = todayBookings.filter(b => ['checked_in'].includes(b.status)).length;

  const filteredBookings = todayBookings.filter(booking =>
    booking.child_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    booking.member?.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    booking.member?.last_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCheckIn = (bookingId: string) => {
    updateStatus.mutate({ bookingId, status: 'checked_in' });
  };

  const handleCheckOut = (bookingId: string) => {
    updateStatus.mutate({ bookingId, status: 'checked_out' });
  };

  const formatTime = (time: string) => {
    try {
      const parsed = parse(time, "HH:mm:ss", new Date());
      return format(parsed, "h:mm a");
    } catch {
      return time;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Childcare</h1>
            <p className="text-muted-foreground">
              Manage children check-in and roster
            </p>
          </div>
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-semibold">{checkedInCount}</span> children checked in
              </span>
            </div>
          </Card>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by child or parent name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() - 1);
              setSelectedDate(newDate);
            }}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelectedDate(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() + 1);
              setSelectedDate(newDate);
            }}
          >
            Next
          </Button>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredBookings.map((booking) => {
                const isCheckedIn = booking.status === 'checked_in';
                const isCheckedOut = booking.status === 'checked_out';
                const canCheckIn = booking.status === 'confirmed';
                const canCheckOut = booking.status === 'checked_in';

                return (
                  <Card key={booking.id} className={isCheckedIn ? 'border-success/50' : ''}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <Baby className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{booking.child_name}</CardTitle>
                            <CardDescription>Age {booking.child_age} • {booking.age_group}</CardDescription>
                          </div>
                        </div>
                        <Badge 
                          variant={
                            isCheckedIn ? 'default' : 
                            isCheckedOut ? 'secondary' : 
                            'outline'
                          }
                          className={
                            isCheckedIn ? 'bg-success/10 text-success border-success/30' :
                            isCheckedOut ? 'bg-muted text-muted-foreground' :
                            ''
                          }
                        >
                          {booking.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Parent: </span>
                        <span>
                          {booking.member 
                            ? `${booking.member.first_name} ${booking.member.last_name}`
                            : booking.user?.email || 'Unknown'}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                      </div>
                      {booking.special_instructions && (
                        <div className="text-xs text-muted-foreground italic p-2 bg-muted rounded">
                          {booking.special_instructions}
                        </div>
                      )}
                      {booking.checked_in_at && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <UserCheck className="h-3 w-3" />
                          Checked in at {format(new Date(booking.checked_in_at), "h:mm a")}
                        </div>
                      )}
                      {booking.checked_out_at && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <UserX className="h-3 w-3" />
                          Checked out at {format(new Date(booking.checked_out_at), "h:mm a")}
                        </div>
                      )}
                      <div className="flex gap-2">
                        {canCheckIn && (
                          <Button
                            className="flex-1"
                            onClick={() => handleCheckIn(booking.id)}
                            disabled={updateStatus.isPending}
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Check In
                          </Button>
                        )}
                        {canCheckOut && (
                          <Button
                            className="flex-1"
                            variant="outline"
                            onClick={() => handleCheckOut(booking.id)}
                            disabled={updateStatus.isPending}
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            Check Out
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {filteredBookings.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Baby className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No bookings found for this date</p>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
