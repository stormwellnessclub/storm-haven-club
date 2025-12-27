import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, CheckCircle, Dumbbell } from "lucide-react";
import { useState } from "react";

interface ClassSession {
  id: string;
  name: string;
  instructor: string;
  time: string;
  duration: string;
  capacity: number;
  enrolled: number;
  attendees: number;
  status: 'upcoming' | 'in-progress' | 'completed';
}

const todaysClasses: ClassSession[] = [
  { id: '1', name: 'Morning Yoga', instructor: 'Sarah Chen', time: '6:00 AM', duration: '60 min', capacity: 20, enrolled: 18, attendees: 16, status: 'completed' },
  { id: '2', name: 'HIIT Blast', instructor: 'Marcus Johnson', time: '7:30 AM', duration: '45 min', capacity: 25, enrolled: 25, attendees: 22, status: 'completed' },
  { id: '3', name: 'Spin Class', instructor: 'Emily Davis', time: '9:00 AM', duration: '45 min', capacity: 30, enrolled: 28, attendees: 0, status: 'in-progress' },
  { id: '4', name: 'Pilates', instructor: 'Lisa Wong', time: '10:30 AM', duration: '50 min', capacity: 15, enrolled: 12, attendees: 0, status: 'upcoming' },
  { id: '5', name: 'Boxing Basics', instructor: 'Mike Thompson', time: '12:00 PM', duration: '60 min', capacity: 20, enrolled: 15, attendees: 0, status: 'upcoming' },
  { id: '6', name: 'Evening Flow', instructor: 'Sarah Chen', time: '5:30 PM', duration: '75 min', capacity: 20, enrolled: 19, attendees: 0, status: 'upcoming' },
];

export default function Classes() {
  const [classes] = useState<ClassSession[]>(todaysClasses);
  const [selectedClass, setSelectedClass] = useState<ClassSession | null>(null);

  const getStatusColor = (status: ClassSession['status']) => {
    switch (status) {
      case 'completed': return 'bg-muted text-muted-foreground';
      case 'in-progress': return 'bg-green-500';
      case 'upcoming': return 'bg-blue-500';
    }
  };

  const getStatusLabel = (status: ClassSession['status']) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'in-progress': return 'In Progress';
      case 'upcoming': return 'Upcoming';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Class Schedule</h1>
            <p className="text-muted-foreground">
              View today's classes and manage attendance
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((classSession) => (
            <Card 
              key={classSession.id} 
              className={`cursor-pointer transition-colors hover:border-primary/50 ${
                selectedClass?.id === classSession.id ? 'border-primary' : ''
              }`}
              onClick={() => setSelectedClass(classSession)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{classSession.name}</CardTitle>
                    <CardDescription>{classSession.instructor}</CardDescription>
                  </div>
                  <Badge className={getStatusColor(classSession.status)}>
                    {getStatusLabel(classSession.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {classSession.time}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Dumbbell className="h-3 w-3" />
                    {classSession.duration}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {classSession.enrolled}/{classSession.capacity} enrolled
                  </div>
                  {classSession.status !== 'upcoming' && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      {classSession.attendees} attended
                    </div>
                  )}
                </div>
                {classSession.status === 'in-progress' && (
                  <Button className="w-full" size="sm">
                    Take Attendance
                  </Button>
                )}
                {classSession.status === 'upcoming' && (
                  <Button variant="outline" className="w-full" size="sm">
                    View Roster
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {classes.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No classes scheduled for today</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
