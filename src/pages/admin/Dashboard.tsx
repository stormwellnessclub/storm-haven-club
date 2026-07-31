import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MembershipBreakdownCard } from "@/components/admin/MembershipBreakdownCard";

import { useUserRoles } from "@/hooks/useUserRoles";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
  AlertCircle,
  Trophy,
  AlertTriangle,
  Mail
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { clubTodayStart, clubTodayEnd, clubTodayDateStr } from "@/lib/clubTime";
import { BillingHealthWidget } from "@/components/admin/BillingHealthWidget";
import { CardSyncFailuresWidget } from "@/components/admin/CardSyncFailuresWidget";
import { SupportAlertCard } from "@/components/admin/SupportAlertCard";
import { CafeAlertCard } from "@/components/admin/CafeAlertCard";
import { AdminWidgetBoundary } from "@/components/admin/AdminWidgetBoundary";
import { toast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailProgress, setEmailProgress] = useState({ sent: 0, total: 0 });
  const navigate = useNavigate();
  const { user, authReady } = useAuth();
  const { isAdmin } = useUserRoles();
  const showAdminOnly = isAdmin();

  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Use America/Detroit day boundaries so every device sees the same counts
  const todayStartISO = clubTodayStart();
  const todayEndISO = clubTodayEnd();
  const today = clubTodayDateStr(); // YYYY-MM-DD in club tz

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-dashboard-stats', today],
    queryFn: async () => {
      const [
        activeMembersRes,
        foundingMembersRes,
        pendingAppsRes,
        todayAppointmentsRes,
        todayClassesRes,
        todayCheckinsRes,
      ] = await Promise.allSettled([
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('is_founding_member', true),
        supabase.from('membership_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('spa_appointments').select('*', { count: 'exact', head: true }).eq('appointment_date', today),
        supabase.from('class_sessions').select('*', { count: 'exact', head: true }).eq('session_date', today),
        supabase.from('check_ins').select('*', { count: 'exact', head: true }).gte('checked_in_at', todayStartISO).lt('checked_in_at', todayEndISO)
      ]);

      const queryErrors = {
        activeMembers: false,
        foundingMembers: false,
        pendingApps: false,
        todayAppointments: false,
        todayClasses: false,
        todayCheckins: false,
      };

      const resolveCount = (
        result: PromiseSettledResult<{ count: number | null; error: any }>,
        key: keyof typeof queryErrors,
        label: string,
      ) => {
        if (result.status === 'rejected') {
          queryErrors[key] = true;
          console.error(`Dashboard ${label} request failed:`, result.reason);
          return 0;
        }

        if (result.value.error) {
          queryErrors[key] = true;
          console.error(`Dashboard ${label} query failed:`, result.value.error);
          return 0;
        }

        return result.value.count || 0;
      };

      const activeMembers = resolveCount(activeMembersRes as any, 'activeMembers', 'active members');
      const foundingMembers = resolveCount(foundingMembersRes as any, 'foundingMembers', 'founding members');
      const pendingApps = resolveCount(pendingAppsRes as any, 'pendingApps', 'pending applications');
      const todayAppointments = resolveCount(todayAppointmentsRes as any, 'todayAppointments', 'appointments');
      const todayClasses = resolveCount(todayClassesRes as any, 'todayClasses', 'classes');
      const todayCheckins = resolveCount(todayCheckinsRes as any, 'todayCheckins', 'check-ins');

      return {
        activeMembers,
        foundingMembers,
        pendingApps,
        todayAppointments,
        todayClasses,
        todayCheckins,
        queryErrors,
        hasPartialFailure: Object.values(queryErrors).some(Boolean),
      };
    },
    enabled: authReady && !!user,
  });

  // Fetch failed payments in last 7 days (urgent attention)
  const sevenDaysAgo = subDays(new Date(), 7).toISOString();
  const { data: failedPayments = [], isLoading: failedPaymentsLoading } = useQuery({
    queryKey: ['admin-failed-payments-alert', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_attempts')
        .select(`
          id,
          member_id,
          amount,
          error_message,
          created_at,
          members!inner (
            first_name,
            last_name,
            email
          )
        `)
        .eq('status', 'failed')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        memberName: `${p.members?.first_name || ''} ${p.members?.last_name || ''}`.trim() || 'Unknown',
        email: p.members?.email,
        amount: p.amount,
        error: p.error_message,
        date: p.created_at,
      }));
    },
    enabled: authReady && !!user,
  });

  // Fetch recent check-ins
  const { data: recentCheckIns = [], isLoading: checkInsLoading } = useQuery({
    queryKey: ['admin-recent-checkins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('check_ins')
        .select(`
          id,
          checked_in_at,
          member_id,
          members!inner (
            first_name,
            last_name,
            membership_type
          )
        `)
        .order('checked_in_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []).map((checkIn: any) => ({
        name: `${checkIn.members?.first_name || ''} ${checkIn.members?.last_name || ''}`.trim() || 'Unknown',
        time: format(new Date(checkIn.checked_in_at), 'h:mm a'),
        membership: checkIn.members?.membership_type || 'Member',
        status: 'success'
      }));
    },
    enabled: authReady && !!user,
  });

  // Fetch upcoming appointments (spa + PT)
  const { data: upcomingAppointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ['admin-upcoming-appointments', today],
    queryFn: async () => {
      const dayStart = new Date(`${today}T00:00:00`).toISOString();
      const dayEnd = new Date(`${today}T23:59:59`).toISOString();
      const [spaRes, ptRes] = await Promise.all([
        supabase
          .from('spa_appointments')
          .select(`id, appointment_date, appointment_time, service_name,
            members ( first_name, last_name )`)
          .eq('appointment_date', today)
          .eq('status', 'confirmed')
          .order('appointment_time', { ascending: true })
          .limit(10),
        (supabase as any)
          .from('pt_appointments')
          .select('id, user_id, starts_at, format, instructor_id, status')
          .eq('status', 'scheduled')
          .gte('starts_at', dayStart)
          .lte('starts_at', dayEnd)
          .order('starts_at', { ascending: true })
          .limit(20),
      ]);

      if (spaRes.error) throw spaRes.error;

      const spaItems = (spaRes.data || []).map((apt: any) => ({
        kind: 'spa' as const,
        sortKey: apt.appointment_time || '00:00',
        member: `${apt.members?.first_name || ''} ${apt.members?.last_name || ''}`.trim() || 'Unknown',
        service: apt.service_name || 'Spa service',
        time: apt.appointment_time ? format(new Date(`2000-01-01T${apt.appointment_time}`), 'h:mm a') : 'TBD',
      }));

      const ptRows = (ptRes?.data ?? []) as any[];
      const userIds = Array.from(new Set(ptRows.map((r) => r.user_id)));
      const instructorIds = Array.from(new Set(ptRows.map((r) => r.instructor_id).filter(Boolean)));
      const [{ data: members }, { data: profiles }, { data: instructors }] = await Promise.all([
        userIds.length
          ? supabase.from('members').select('user_id, first_name, last_name').in('user_id', userIds)
          : Promise.resolve({ data: [] as any[] }),
        userIds.length
          ? supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds)
          : Promise.resolve({ data: [] as any[] }),
        instructorIds.length
          ? supabase.from('instructors').select('id, first_name, last_name').in('id', instructorIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const nameMap: Record<string, string> = {};
      (profiles ?? []).forEach((p: any) => { nameMap[p.user_id] = p.full_name ?? p.email ?? 'Unknown'; });
      (members ?? []).forEach((m: any) => {
        nameMap[m.user_id] = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || nameMap[m.user_id] || 'Unknown';
      });
      const instMap: Record<string, string> = {};
      (instructors ?? []).forEach((i: any) => { instMap[i.id] = `${i.first_name} ${i.last_name}`; });
      const ptLabel: Record<string, string> = {
        one_on_one: '1:1 PT',
        reformer_one_on_one: 'Reformer 1:1',
        semi_private: 'Semi-Private PT',
      };
      const ptItems = ptRows.map((r) => {
        const d = new Date(r.starts_at);
        return {
          kind: 'pt' as const,
          sortKey: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
          member: nameMap[r.user_id] || 'Member',
          service: `${ptLabel[r.format] ?? 'PT'}${r.instructor_id && instMap[r.instructor_id] ? ` · ${instMap[r.instructor_id]}` : ''}`,
          time: format(d, 'h:mm a'),
        };
      });

      return [...spaItems, ...ptItems].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    },
    enabled: authReady && !!user,
  });

  // Fetch pending applications
  const { data: pendingApplications = [], isLoading: applicationsLoading } = useQuery({
    queryKey: ['admin-pending-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membership_applications')
        .select('id, first_name, last_name, membership_plan, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []).map((app: any) => ({
        name: `${app.first_name || ''} ${app.last_name || ''}`.trim() || 'Unknown',
        plan: app.membership_plan || 'Standard',
        date: formatDistanceToNow(new Date(app.created_at), { addSuffix: true }),
        status: 'pending'
      }));
    },
    enabled: authReady && !!user,
  });

  const handleSendHoursEmail = async () => {
    setSendingEmails(true);
    setEmailProgress({ sent: 0, total: 0 });
    try {
      const { data: members, error } = await supabase
        .from('members')
        .select('first_name, email')
        .eq('status', 'active')
        .not('email', 'is', null);

      if (error) throw error;
      const validMembers = (members || []).filter((m) => m.email);
      setEmailProgress({ sent: 0, total: validMembers.length });

      let sent = 0;
      let failed = 0;
      for (const member of validMembers) {
        try {
          await supabase.functions.invoke("send-email", {
            body: { type: "soft_launch_hours", to: member.email, data: { name: member.first_name || "Member" } },
          });
          sent++;
        } catch {
          failed++;
        }
        setEmailProgress({ sent: sent + failed, total: validMembers.length });
      }

      toast({
        title: "Emails Sent",
        description: `${sent} sent successfully${failed > 0 ? `, ${failed} failed` : ""}`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send emails", variant: "destructive" });
    } finally {
      setSendingEmails(false);
    }
  };

  const statCards = [
    {
      title: "Active Members",
      value: stats?.activeMembers ?? 0,
      change: `${stats?.foundingMembers ?? 0} founding members`,
      icon: Users,
      color: "bg-primary/10 text-primary",
    },
    {
      title: "Today's Check-Ins",
      value: stats?.todayCheckins ?? 0,
      change: "Club entries today",
      icon: UserCheck,
      color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
    {
      title: "Appointments Today",
      value: stats?.todayAppointments ?? 0,
      change: "Spa & services",
      icon: Calendar,
      color: "bg-accent/20 text-accent-foreground",
    },
    ...(showAdminOnly ? [{
      title: "Pending Applications",
      value: stats?.pendingApps ?? 0,
      change: "Awaiting review",
      icon: FileText,
      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    }] : []),
  ];

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">
        {/* Failed Payments Alert - Critical (Admin only) */}
        {showAdminOnly && !failedPaymentsLoading && failedPayments.length > 0 && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-destructive/10 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <p className="font-semibold text-destructive">
                      Payment Failures Require Attention
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {failedPayments.length} member(s) had declined payments in the last 7 days
                    </p>
                  </div>
                </div>
                <Button variant="outline" asChild className="border-destructive/50 hover:bg-destructive/10">
                  <Link to="/admin/payments">
                    Review Now
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Support Alert */}
        <AdminWidgetBoundary title="Support messages">
          <SupportAlertCard />
        </AdminWidgetBoundary>

        {/* Cafe Orders Alert */}
        <AdminWidgetBoundary title="Cafe orders">
          <CafeAlertCard />
        </AdminWidgetBoundary>

        {/* Date and Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Today</p>
            <p className="text-lg font-medium">{currentDate}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button asChild>
              <Link to="/admin/check-in">
                <QrCode className="h-4 w-4 mr-2" />
                Open Scanner
              </Link>
            </Button>
            {showAdminOnly && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={sendingEmails}>
                    <Mail className="h-4 w-4 mr-2" />
                    {sendingEmails ? `Sending ${emailProgress.sent}/${emailProgress.total}...` : "Send Hours Email"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Send Soft Launch Hours Email</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will send the soft launch hours email to all active members. Are you sure?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {sendingEmails && (
                    <Progress value={emailProgress.total > 0 ? (emailProgress.sent / emailProgress.total) * 100 : 0} className="h-2" />
                  )}
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={sendingEmails}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSendHoursEmail} disabled={sendingEmails}>
                      Send to All Members
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statsLoading ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))
          ) : (
            statCards.map((stat) => (
              <Card key={stat.title} className="relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </p>
                      <p className="text-3xl font-bold tracking-tight">{stat.value.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{stat.change}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${stat.color}`}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <MembershipBreakdownCard />


        {stats?.hasPartialFailure ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Some dashboard counts could not load right now. Today&apos;s member check-ins still load independently, so a zero here only reflects check-ins when that specific query succeeds.
            </span>
          </div>
        ) : null}

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Recent Check-Ins */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-600" />
                Recent Check-Ins
                {!checkInsLoading && recentCheckIns.length > 0 && stats?.todayCheckins ? (
                  <Badge variant="secondary" className="text-[10px] ml-1">{stats.todayCheckins} today</Badge>
                ) : null}
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/check-in" className="text-xs">
                  View All <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {checkInsLoading ? (
                <div className="space-y-3">
                  {Array(4).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recentCheckIns.length > 0 ? (
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
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No check-ins yet today
                </p>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Appointments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent" />
                Appointments
                {!appointmentsLoading && upcomingAppointments.length > 0 && stats?.todayAppointments ? (
                  <Badge variant="secondary" className="text-[10px] ml-1">{stats.todayAppointments} today</Badge>
                ) : null}
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/appointments" className="text-xs">
                  View All <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {appointmentsLoading ? (
                <div className="space-y-3">
                  {Array(3).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : upcomingAppointments.length > 0 ? (
                <div className="space-y-3">
                  {upcomingAppointments.map((apt, index) => (
                    <div
                      key={index}
                      className="py-2 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
                      onClick={() => navigate(apt.kind === 'pt' ? '/admin/personal-training/schedule' : '/admin/appointments')}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm flex items-center gap-2">
                          {apt.member}
                          {apt.kind === 'pt' && (
                            <Badge variant="outline" className="text-[10px] py-0">PT</Badge>
                          )}
                        </p>
                        <Badge variant="outline" className="text-xs">{apt.time}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {apt.service}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No appointments scheduled today
                </p>
              )}
            </CardContent>
          </Card>

          {/* Pending Applications (Admin only) */}
          {showAdminOnly && (
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
                {applicationsLoading ? (
                  <div className="space-y-3">
                    {Array(2).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : pendingApplications.length > 0 ? (
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
                    {(stats?.pendingApps ?? 0) > pendingApplications.length && (
                      <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                        <Link to="/admin/applications">
                          View all {stats?.pendingApps} applications
                        </Link>
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No pending applications
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Billing Health Widget (Admin only) */}
          {showAdminOnly && (
            <AdminWidgetBoundary title="Billing health">
              <BillingHealthWidget />
            </AdminWidgetBoundary>
          )}
        </div>

        {/* Card Sync Failures Widget (Admin only) */}
        {showAdminOnly && (
          <AdminWidgetBoundary title="Card sync failures">
            <CardSyncFailuresWidget />
          </AdminWidgetBoundary>
        )}

        {/* Quick Stats Row */}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-950/50 dark:to-yellow-900/20 border-yellow-200 dark:border-yellow-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-yellow-600/10 rounded-lg">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                    {statsLoading ? <Skeleton className="h-8 w-12" /> : stats?.foundingMembers ?? 0}
                  </p>
                  <p className="text-sm text-yellow-600/80">Founding Members</p>
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
                  <p className="text-2xl font-bold">
                    {statsLoading ? <Skeleton className="h-8 w-12" /> : stats?.todayCheckins ?? 0}
                  </p>
                  <p className="text-sm text-muted-foreground">In Club Today</p>
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
                  <p className="text-2xl font-bold">
                    {statsLoading ? <Skeleton className="h-8 w-12" /> : stats?.todayClasses ?? 0}
                  </p>
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
