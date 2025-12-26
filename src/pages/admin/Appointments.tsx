import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, Plus, ChevronLeft, ChevronRight } from "lucide-react";

const timeSlots = [
  "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM"
];

const mockAppointments = [
  { id: "1", member: "Lisa Thompson", service: "Therapeutic Massage", time: "10:00 AM", provider: "Maria S.", duration: 60 },
  { id: "2", member: "David Brown", service: "Personal Training", time: "11:00 AM", provider: "Jake M.", duration: 60 },
  { id: "3", member: "Jennifer Lee", service: "Facial Treatment", time: "1:00 PM", provider: "Sophie K.", duration: 90 },
  { id: "4", member: "Robert Garcia", service: "Reformer Pilates", time: "2:00 PM", provider: "Anna B.", duration: 55 },
  { id: "5", member: "Sarah Johnson", service: "Deep Tissue Massage", time: "3:00 PM", provider: "Maria S.", duration: 60 },
  { id: "6", member: "Michael Chen", service: "Cycling Class", time: "5:00 PM", provider: "Tom R.", duration: 45 },
];

const getServiceColor = (service: string) => {
  if (service.includes("Massage")) return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
  if (service.includes("Training")) return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
  if (service.includes("Facial") || service.includes("Treatment")) return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300";
  if (service.includes("Pilates") || service.includes("Class") || service.includes("Cycling")) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
  return "bg-secondary text-secondary-foreground";
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
                  {mockAppointments.length} appointments scheduled
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
              <div className="space-y-2">
                {timeSlots.map((slot) => {
                  const appointment = mockAppointments.find((a) => a.time === slot);
                  return (
                    <div
                      key={slot}
                      className={`flex items-stretch gap-4 p-3 rounded-lg border ${
                        appointment ? "bg-card" : "bg-secondary/30"
                      }`}
                    >
                      <div className="w-20 text-sm font-medium text-muted-foreground">
                        {slot}
                      </div>
                      {appointment ? (
                        <div className="flex-1 flex items-center justify-between">
                          <div>
                            <p className="font-medium">{appointment.member}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={getServiceColor(appointment.service)}>
                                {appointment.service}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {appointment.duration} min
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">with</p>
                            <p className="font-medium">{appointment.provider}</p>
                          </div>
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
                  <span className="font-bold">{mockAppointments.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                  <span className="text-sm">Completed</span>
                  <span className="font-bold text-green-600">2</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                  <span className="text-sm">Upcoming</span>
                  <span className="font-bold text-blue-600">4</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                  <span className="text-sm">Cancellations</span>
                  <span className="font-bold text-red-600">0</span>
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
                  {["Maria S.", "Jake M.", "Sophie K.", "Anna B.", "Tom R."].map((staff) => (
                    <div
                      key={staff}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {staff.charAt(0)}
                        </div>
                        <span className="font-medium text-sm">{staff}</span>
                      </div>
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Available
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
