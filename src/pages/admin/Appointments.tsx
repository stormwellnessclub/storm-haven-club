import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, Plus, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useAdminSpaAppointments, useUpdateSpaAppointmentStatus } from "@/hooks/useAdminSpaAppointments";
import { format, parse } from "date-fns";

const timeSlots = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
];

const getServiceColor = (category: string) => {
  if (category.includes("Massage")) return "bg-purple-500/10 text-purple-600 border-purple-500/30";
  if (category.includes("Facial")) return "bg-pink-500/10 text-pink-600 border-pink-500/30";
  if (category.includes("Recovery")) return "bg-blue-500/10 text-blue-600 border-blue-500/30";
  if (category.includes("Body")) return "bg-amber-500/10 text-amber-600 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border";
};

const formatTime = (time: string) => {
  try {
    const parsed = parse(time, "HH:mm:ss", new Date());
    return format(parsed, "h:mm a");
  } catch {
    return time;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
    case 'completed':
      return 'bg-success/10 text-success border-success/30';
    case 'cancelled':
      return 'bg-destructive/10 text-destructive border-destructive/30';
    case 'no_show':
      return 'bg-muted text-muted-foreground border-border';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

export default function Appointments() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
    setSelectedDate(newDate);
  };

  const { data: appointments, isLoading } = useAdminSpaAppointments({ 
    appointmentDate: selectedDate 
  });
  const updateStatus = useUpdateSpaAppointmentStatus();

  const appointmentsForDate = appointments?.filter(apt => {
    const aptDate = new Date(apt.appointment_date);
    return aptDate.toDateString() === selectedDate.toDateString();
  }) || [];

  const getAppointmentForSlot = (slot: string) => {
    return appointmentsForDate.find(apt => {
      const aptTime = apt.appointment_time.split(':').slice(0, 2).join(':');
      return aptTime === slot;
    });
  };

  const stats = {
    total: appointmentsForDate.length,
    completed: appointmentsForDate.filter(a => a.status === 'completed').length,
    upcoming: appointmentsForDate.filter(a => ['confirmed'].includes(a.status)).length,
    cancelled: appointmentsForDate.filter(a => a.status === 'cancelled').length,
  };

  return (
    <AdminLayout title="Appointments">
      <div className="space-y-6">
        {/* Date Navigation */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" onClick={() => navigateDate("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <h2 className="text-xl font-semibold">{formatDate(selectedDate)}</h2>
                <p className="text-sm text-muted-foreground">
                  {stats.total} appointments scheduled
                </p>
              </div>
              <Button variant="outline" size="icon" onClick={() => navigateDate("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Schedule Timeline */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Daily Schedule
              </CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Appointment
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {timeSlots.map((slot) => {
                    const appointment = getAppointmentForSlot(slot);
                    return (
                      <div
                        key={slot}
                        className={`flex items-stretch gap-4 p-3 rounded-lg border ${
                          appointment ? "bg-card" : "bg-secondary/30"
                        }`}
                      >
                        <div className="w-20 text-sm font-medium text-muted-foreground">
                          {formatTime(slot + ":00")}
                        </div>
                        {appointment ? (
                          <div className="flex-1 flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium">
                                {appointment.member 
                                  ? `${appointment.member.first_name} ${appointment.member.last_name}`
                                  : appointment.user?.email || 'Guest'}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className={getServiceColor(appointment.service_category)}>
                                  {appointment.service_name}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {appointment.duration_minutes} min
                                </span>
                                <Badge variant="outline" className={getStatusColor(appointment.status)}>
                                  {appointment.status}
                                </Badge>
                              </div>
                              {appointment.member_notes && (
                                <p className="text-xs text-muted-foreground mt-1 italic">
                                  {appointment.member_notes}
                                </p>
                              )}
                            </div>
                            {appointment.staff && (
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">with</p>
                                <p className="font-medium">{appointment.staff.full_name || 'TBD'}</p>
                              </div>
                            )}
                            {['confirmed'].includes(appointment.status) && (
                              <div className="flex gap-2 ml-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateStatus.mutate({ 
                                    appointmentId: appointment.id, 
                                    status: 'completed' 
                                  })}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Complete
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => updateStatus.mutate({ 
                                    appointmentId: appointment.id, 
                                    status: 'cancelled' 
                                  })}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center">
                            <span className="text-sm text-muted-foreground italic">
                              Available
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats & Actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Today's Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                  <span className="text-sm">Total Appointments</span>
                  <span className="font-bold">{stats.total}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                  <span className="text-sm">Completed</span>
                  <span className="font-bold text-success">{stats.completed}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                  <span className="text-sm">Upcoming</span>
                  <span className="font-bold text-blue-600">{stats.upcoming}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                  <span className="text-sm">Cancellations</span>
                  <span className="font-bold text-destructive">{stats.cancelled}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Staff On Duty
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {appointmentsForDate
                    .filter(apt => apt.staff)
                    .map((apt) => (
                      <div
                        key={apt.staff!.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {apt.staff!.full_name?.charAt(0) || '?'}
                          </div>
                          <span className="font-medium text-sm">{apt.staff!.full_name}</span>
                        </div>
                        <Badge variant="outline" className="text-success border-success">
                          Active
                        </Badge>
                      </div>
                    ))}
                  {appointmentsForDate.filter(apt => apt.staff).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No staff assignments
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
