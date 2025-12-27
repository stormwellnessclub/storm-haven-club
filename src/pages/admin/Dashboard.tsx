import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  UserCheck, 
  Calendar, 
  FileText, 
  TrendingUp, 
  Clock,
  QrCode,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Link } from "react-router-dom";

const stats = [
  {
    title: "Active Members",
    value: "1,284",
    change: "+12 this month",
    icon: Users,
    color: "bg-primary/10 text-primary",
  },
  {
    title: "Today's Check-Ins",
    value: "89",
    change: "Peak: 11am",
    icon: UserCheck,
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  {
    title: "Appointments Today",
    value: "24",
    change: "6 remaining",
    icon: Calendar,
    color: "bg-accent/20 text-accent-foreground",
  },
  {
    title: "Pending Applications",
    value: "7",
    change: "3 new today",
    icon: FileText,
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
];

const recentCheckIns = [
  { name: "Sarah Johnson", time: "8:45 AM", membership: "Premium", status: "success" },
  { name: "Michael Chen", time: "8:30 AM", membership: "Executive", status: "success" },
  { name: "Emily Davis", time: "8:15 AM", membership: "Standard", status: "success" },
  { name: "James Wilson", time: "8:00 AM", membership: "Premium", status: "warning" },
];

const upcomingAppointments = [
  { member: "Lisa Thompson", service: "Therapeutic Massage", time: "10:00 AM", provider: "Maria S." },
  { member: "David Brown", service: "Personal Training", time: "11:30 AM", provider: "Jake M." },
  { member: "Jennifer Lee", service: "Facial Treatment", time: "1:00 PM", provider: "Sophie K." },
];

const pendingApplications = [
  { name: "Robert Garcia", plan: "Premium", date: "Today", status: "pending" },
  { name: "Anna Martinez", plan: "Executive", date: "Yesterday", status: "pending" },
];

export default function Dashboard() {
  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">
        {/* Date and Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Today</p>
            <p className="text-lg font-medium">{currentDate}</p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/admin/check-in">
                <QrCode className="h-4 w-4 mr-2" />
                Open Scanner
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.change}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Check-Ins - Takes 1 column */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-600" />
                Recent Check-Ins
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/check-in" className="text-xs">
                  View All <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {recentCheckIns.map((checkIn, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                  >
                    {checkIn.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{checkIn.name}</p>
                      <p className="text-xs text-muted-foreground">{checkIn.membership}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{checkIn.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Appointments - Takes 1 column */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent" />
                Upcoming Appointments
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/appointments" className="text-xs">
                  View All <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {upcomingAppointments.map((apt, index) => (
                  <div
                    key={index}
                    className="py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{apt.member}</p>
                      <Badge variant="outline" className="text-xs">{apt.time}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {apt.service} • {apt.provider}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pending Applications - Takes 1 column */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-600" />
                Pending Applications
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/applications" className="text-xs">
                  Review <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {pendingApplications.map((app, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{app.name}</p>
                      <p className="text-xs text-muted-foreground">{app.plan} Membership</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">{app.date}</Badge>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                  <Link to="/admin/applications">
                    View all 7 applications
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats Row */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/50 dark:to-green-900/20 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-green-600/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">98%</p>
                  <p className="text-sm text-green-600/80">Member Retention</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-accent/20 rounded-lg">
                  <Users className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">147</p>
                  <p className="text-sm text-muted-foreground">Currently In Club</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">18</p>
                  <p className="text-sm text-muted-foreground">Classes Scheduled Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
