import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Baby, Search, UserCheck, UserX, Clock, Users, Loader2, Calendar, ListPlus, Mail, Phone, AlertTriangle, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { useAdminKidsCareBookings, useUpdateKidsCareBookingStatus } from "@/hooks/useAdminKidsCareBookings";
import { useKidsCareInterestList, useUpdateKidsCareInterestStatus } from "@/hooks/useKidsCareInterest";
import { format, parse } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KidsCareHoursEditor } from "@/components/admin/KidsCareHoursEditor";
import { KidsCareCapacityDashboard } from "@/components/admin/KidsCareCapacityDashboard";
import { KidsCareHourRequests } from "@/components/admin/KidsCareHourRequests";

export default function Childcare() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState("bookings");
  
  const { data: bookings, isLoading } = useAdminKidsCareBookings({ 
    bookingDate: selectedDate 
  });
  const updateStatus = useUpdateKidsCareBookingStatus();

  // Interest waitlist
  const { data: interestList, isLoading: isLoadingInterest } = useKidsCareInterestList();
  const updateInterestStatus = useUpdateKidsCareInterestStatus();

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
              Manage children check-in, roster, hours, and interest waitlist
            </p>
          </div>
          {activeTab === "bookings" && (
            <Card className="px-4 py-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-semibold">{checkedInCount}</span> children checked in
                </span>
              </div>
            </Card>
          )}
          {activeTab === "interest" && (
            <Card className="px-4 py-2">
              <div className="flex items-center gap-2">
                <ListPlus className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-semibold">{interestList?.filter(i => i.status === 'waiting').length || 0}</span> families waiting
                </span>
              </div>
            </Card>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <Baby className="h-4 w-4" />
              Bookings
            </TabsTrigger>
            <TabsTrigger value="hours" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Hours
            </TabsTrigger>
            <TabsTrigger value="interest" className="flex items-center gap-2">
              <ListPlus className="h-4 w-4" />
              Interest Waitlist
              {interestList && interestList.filter(i => i.status === 'waiting').length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {interestList.filter(i => i.status === 'waiting').length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="space-y-6">
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

            {/* Capacity Dashboard */}
            {!isLoading && todayBookings.length > 0 && (
              <KidsCareCapacityDashboard bookings={todayBookings} selectedDate={selectedDate} />
            )}

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
                    const awaitingParentConfirm = isCheckedOut && !booking.parent_confirmed_pickup;
                    const roomName = booking.room || (
                      ["Infants", "Toddlers"].includes(booking.age_group || "") ? "Little Stars" : "Big Stars"
                    );

                    return (
                      <Card key={booking.id} className={isCheckedIn ? 'border-success/50' : awaitingParentConfirm ? 'border-warning/50' : ''}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                <Baby className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div>
                                <CardTitle className="text-base">{booking.child_name}</CardTitle>
                                <CardDescription>Age {booking.child_age} • {booking.age_group} • {roomName}</CardDescription>
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
                              Staff checkout at {format(new Date(booking.checked_out_at), "h:mm a")}
                            </div>
                          )}
                          {/* Dual checkout status */}
                          {isCheckedOut && (
                            <div className="text-xs">
                              {booking.parent_confirmed_pickup ? (
                                <div className="flex items-center gap-1 text-success">
                                  <UserCheck className="h-3 w-3" />
                                  Parent confirmed pickup at {format(new Date(booking.parent_confirmed_at!), "h:mm a")}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-warning">
                                  <AlertTriangle className="h-3 w-3" />
                                  Awaiting parent pickup confirmation
                                </div>
                              )}
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
          </TabsContent>

          <TabsContent value="hours" className="space-y-6">
            <KidsCareHoursEditor />
          </TabsContent>

          <TabsContent value="interest" className="space-y-6">
            {isLoadingInterest ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : interestList && interestList.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Kids Care Interest Waitlist</CardTitle>
                  <CardDescription>
                    Families interested in Kids Care before soft launch
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Children</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Signed Up</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {interestList.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            {entry.first_name || entry.last_name 
                              ? `${entry.first_name || ''} ${entry.last_name || ''}`.trim()
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                {entry.email}
                              </div>
                              {entry.phone && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {entry.phone}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="font-medium">{entry.children_count}</span>
                              <span className="text-muted-foreground"> child{entry.children_count > 1 ? 'ren' : ''}</span>
                            </div>
                            {entry.children_ages && (
                              <div className="text-xs text-muted-foreground">
                                Ages: {entry.children_ages}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            {entry.notes ? (
                              <span className="text-sm text-muted-foreground truncate block">
                                {entry.notes}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(entry.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={entry.status}
                              onValueChange={(value) => 
                                updateInterestStatus.mutate({ id: entry.id, status: value })
                              }
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="waiting">Waiting</SelectItem>
                                <SelectItem value="contacted">Contacted</SelectItem>
                                <SelectItem value="converted">Converted</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ListPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No interest waitlist signups yet</p>
                <p className="text-sm mt-1">
                  Families can sign up on the Kids Care page
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
