import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Calendar, CreditCard, TrendingUp, Clock } from "lucide-react";

const stats = [
  {
    title: "Total Members",
    value: "1,284",
    change: "+12%",
    changeType: "positive" as const,
    icon: Users,
  },
  {
    title: "Check-Ins Today",
    value: "89",
    change: "+5%",
    changeType: "positive" as const,
    icon: UserCheck,
  },
  {
    title: "Appointments Today",
    value: "24",
    change: "-2",
    changeType: "neutral" as const,
    icon: Calendar,
  },
  {
    title: "Pending Applications",
    value: "7",
    change: "3 new",
    changeType: "neutral" as const,
    icon: CreditCard,
  },
];

const recentActivity = [
  { member: "Sarah Johnson", action: "Checked in", time: "2 min ago", type: "check-in" },
  { member: "Michael Chen", action: "Booked Reformer Pilates", time: "15 min ago", type: "booking" },
  { member: "Emily Davis", action: "Membership renewed", time: "1 hour ago", type: "payment" },
  { member: "James Wilson", action: "Checked in", time: "1 hour ago", type: "check-in" },
  { member: "Amanda Roberts", action: "New application submitted", time: "2 hours ago", type: "application" },
];

const upcomingAppointments = [
  { member: "Lisa Thompson", service: "Therapeutic Massage", time: "10:00 AM", provider: "Maria S." },
  { member: "David Brown", service: "Personal Training", time: "11:30 AM", provider: "Jake M." },
  { member: "Jennifer Lee", service: "Facial Treatment", time: "1:00 PM", provider: "Sophie K." },
  { member: "Robert Garcia", service: "Reformer Pilates", time: "2:30 PM", provider: "Anna B." },
];

export default function Dashboard() {
  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className={`text-xs ${
                  stat.changeType === "positive" 
                    ? "text-green-600" 
                    : "text-muted-foreground"
                }`}>
                  {stat.change} from last week
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{activity.member}</p>
                      <p className="text-sm text-muted-foreground">{activity.action}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Appointments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Upcoming Appointments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingAppointments.map((apt, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{apt.member}</p>
                      <p className="text-sm text-muted-foreground">
                        {apt.service} with {apt.provider}
                      </p>
                    </div>
                    <span className="text-sm font-medium">{apt.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
