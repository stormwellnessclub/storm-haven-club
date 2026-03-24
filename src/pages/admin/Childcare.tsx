import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Baby, Search, UserCheck, UserX, Clock, Users, Loader2, Calendar, ListPlus, Mail, Phone, AlertTriangle, MessageSquarePlus, MessageCircle, ChevronDown, Shield, Heart, Pill, Camera, CameraOff, XCircle, Pencil, Ticket, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminKidsCareBookings, useUpdateKidsCareBookingStatus, useAdminCancelKidsCareBooking, useAdminUpdateKidsCareBookingTime } from "@/hooks/useAdminKidsCareBookings";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { KidsCareHoursEditor } from "@/components/admin/KidsCareHoursEditor";
import { KidsCareCapacityDashboard } from "@/components/admin/KidsCareCapacityDashboard";
import { KidsCareHourRequests } from "@/components/admin/KidsCareHourRequests";
import { KidsCareAdminChat, useKidsCareUnreadCount } from "@/components/admin/KidsCareAdminChat";
import { KidsCareBookForParent } from "@/components/admin/KidsCareBookForParent";
import { KidsCarePassesTab } from "@/components/admin/KidsCarePassesTab";


export default function Childcare() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState("bookings");
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  
  const { data: bookings, isLoading, error: bookingsError } = useAdminKidsCareBookings({ 
    bookingDate: selectedDate 
  });
  const updateStatus = useUpdateKidsCareBookingStatus();
  const cancelBooking = useAdminCancelKidsCareBooking();
  const updateTime = useAdminUpdateKidsCareBookingTime();
  // Interest waitlist
  const { data: interestList, isLoading: isLoadingInterest } = useKidsCareInterestList();
  const updateInterestStatus = useUpdateKidsCareInterestStatus();
  const { data: kidsCareUnread } = useKidsCareUnreadCount();

  const todayBookings = bookings || [];

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
            <TabsTrigger value="hour-requests" className="flex items-center gap-2">
              <MessageSquarePlus className="h-4 w-4" />
              Hour Requests
            </TabsTrigger>
            <TabsTrigger value="parent-chat" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Parent Chat
              {(kidsCareUnread ?? 0) > 0 && (
                <Badge className="bg-pink-500 text-white ml-1 text-xs">
                  {kidsCareUnread}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="passes" className="flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              Passes
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
              <KidsCareBookForParent />
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

            {bookingsError && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="flex items-center gap-3 py-4">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">Failed to load bookings</p>
                    <p className="text-sm text-muted-foreground">{(bookingsError as Error).message}</p>
                  </div>
                </CardContent>
              </Card>
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
                          {editingTimeId === booking.id ? (
                            <div className="flex items-center gap-2">
                              <Input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="h-7 w-24 text-xs" />
                              <span className="text-xs">–</span>
                              <Input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="h-7 w-24 text-xs" />
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                                updateTime.mutate({ bookingId: booking.id, startTime: editStartTime + ":00", endTime: editEndTime + ":00" });
                                setEditingTimeId(null);
                              }}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingTimeId(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                              {booking.status === 'confirmed' && (
                                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-1" onClick={() => {
                                  setEditingTimeId(booking.id);
                                  setEditStartTime(booking.start_time.substring(0, 5));
                                  setEditEndTime(booking.end_time.substring(0, 5));
                                }}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
                          {/* Pass Info */}
                          {booking.pass_type ? (
                            <div className="text-xs flex items-center gap-2 p-2 bg-accent/10 rounded border border-accent/20">
                              <Ticket className="h-3 w-3 text-accent-foreground" />
                              <span className="font-medium">{booking.pass_type.replace(/_/g, " ")}</span>
                              <span className="text-muted-foreground">•</span>
                              <span>{booking.pass_classes_remaining}/{booking.pass_classes_total} sessions left</span>
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                {booking.pass_status}
                              </Badge>
                            </div>
                          ) : (
                            <div className="text-xs flex items-center gap-1 p-2 bg-warning/10 rounded border border-warning/20 text-warning">
                              <AlertTriangle className="h-3 w-3" />
                              No pass linked to this booking
                            </div>
                          )}

                          {booking.special_instructions && (
                            <div className="text-xs text-muted-foreground italic p-2 bg-muted rounded">
                              <span className="font-medium not-italic">Booking Notes:</span> {booking.special_instructions}
                            </div>
                          )}

                          {/* Safety-critical info shown prominently (not collapsed) */}
                          {(booking.child_allergies || booking.child_medical_conditions) && (
                            <div className="space-y-1">
                              {booking.child_allergies && (
                                <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-xs">
                                  <span className="font-semibold text-destructive flex items-center gap-1">
                                    <Heart className="h-3 w-3" /> Allergies
                                  </span>
                                  <p className="text-foreground mt-0.5">{booking.child_allergies}</p>
                                </div>
                              )}
                              {booking.child_medical_conditions && (
                                <div className="p-2 rounded bg-warning/10 border border-warning/20 text-xs">
                                  <span className="font-semibold text-warning flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" /> Medical Conditions
                                  </span>
                                  <p className="text-foreground mt-0.5">{booking.child_medical_conditions}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* No child profile warning */}
                          {!booking.child_profile_found && (
                            <div className="text-xs flex items-center gap-1 p-2 bg-muted rounded text-muted-foreground">
                              <Shield className="h-3 w-3" />
                              No child profile registered — parent should complete profile
                            </div>
                          )}
                          {/* Additional child profile info - Collapsible */}
                          {(booking.child_medications || booking.child_emergency_contact_name || booking.child_authorized_pickup_persons || booking.child_special_instructions || booking.child_preferred_activities) && (
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-7 px-2">
                                  <span className="flex items-center gap-1">
                                    <Shield className="h-3 w-3" />
                                    More Child Info
                                  </span>
                                  <ChevronDown className="h-3 w-3 transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="space-y-2 pt-2 text-xs">
                                  {booking.child_medications && (
                                    <div className="p-2 rounded bg-muted">
                                      <span className="font-semibold flex items-center gap-1">
                                        <Pill className="h-3 w-3" /> Medications
                                      </span>
                                      <p className="text-muted-foreground mt-0.5">{booking.child_medications}</p>
                                    </div>
                                  )}
                                  {booking.child_special_instructions && (
                                    <div className="p-2 rounded bg-muted">
                                      <span className="font-semibold">Special Instructions</span>
                                      <p className="text-muted-foreground mt-0.5">{booking.child_special_instructions}</p>
                                    </div>
                                  )}
                                  {booking.child_preferred_activities && (
                                    <div className="p-2 rounded bg-accent/10 border border-accent/20">
                                      <span className="font-semibold flex items-center gap-1">
                                        <Baby className="h-3 w-3" /> Preferred Activities
                                      </span>
                                      <p className="text-muted-foreground mt-0.5">{booking.child_preferred_activities}</p>
                                    </div>
                                  )}
                                  {booking.child_emergency_contact_name && (
                                    <div className="p-2 rounded bg-muted">
                                      <span className="font-semibold flex items-center gap-1">
                                        <Phone className="h-3 w-3" /> Emergency Contact
                                      </span>
                                      <p className="text-muted-foreground mt-0.5">
                                        {booking.child_emergency_contact_name}
                                        {booking.child_relationship_to_child && ` (${booking.child_relationship_to_child})`}
                                        {booking.child_emergency_contact_phone && ` — ${booking.child_emergency_contact_phone}`}
                                      </p>
                                    </div>
                                  )}
                                  {booking.child_authorized_pickup_persons && (
                                    <div className="p-2 rounded bg-muted">
                                      <span className="font-semibold flex items-center gap-1">
                                        <UserCheck className="h-3 w-3" /> Authorized Pickup
                                      </span>
                                      <p className="text-muted-foreground mt-0.5">{booking.child_authorized_pickup_persons}</p>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    {booking.child_photo_release ? (
                                      <><Camera className="h-3 w-3" /> Photo release: Yes</>
                                    ) : (
                                      <><CameraOff className="h-3 w-3" /> Photo release: No</>
                                    )}
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
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
                          <div className="flex gap-2 flex-wrap">
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
                            {booking.status !== 'cancelled' && booking.status !== 'checked_out' && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Cancel
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will cancel {booking.child_name}'s booking and restore the session credit to the parent's pass.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => cancelBooking.mutate({ bookingId: booking.id })}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Cancel Booking
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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

          <TabsContent value="hour-requests" className="space-y-6">
            <KidsCareHourRequests />
          </TabsContent>

          <TabsContent value="parent-chat" className="space-y-6">
            <KidsCareAdminChat />
          </TabsContent>

          <TabsContent value="passes" className="space-y-6">
            <KidsCarePassesTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
