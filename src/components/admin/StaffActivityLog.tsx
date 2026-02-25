import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, QrCode, ScanLine, Ticket, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ActivityItem {
  id: string;
  type: 'check_in' | 'scan' | 'guest_pass_sold' | 'guest_pass_checkin' | 'spa_appointment';
  description: string;
  timestamp: string;
  details?: string;
}

interface StaffActivityLogProps {
  userId: string;
}

const TYPE_LABELS: Record<string, string> = {
  check_in: 'Check-In',
  scan: 'Scan',
  guest_pass_sold: 'Guest Pass Sold',
  guest_pass_checkin: 'Guest Pass Check-In',
  spa_appointment: 'Spa Appointment',
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  check_in: QrCode,
  scan: ScanLine,
  guest_pass_sold: Ticket,
  guest_pass_checkin: Ticket,
  spa_appointment: Calendar,
};

export function StaffActivityLog({ userId }: StaffActivityLogProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [stats, setStats] = useState({ checkIns: 0, scans: 0, guestPasses: 0, spaAppts: 0 });

  useEffect(() => {
    fetchActivity();
  }, [userId]);

  const fetchActivity = async () => {
    setLoading(true);
    try {
      const allActivities: ActivityItem[] = [];

      // Check-ins performed by this staff member
      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('id, checked_in_at, member_id')
        .eq('checked_in_by', userId)
        .order('checked_in_at', { ascending: false })
        .limit(100);

      for (const ci of checkIns || []) {
        allActivities.push({
          id: `ci-${ci.id}`,
          type: 'check_in',
          description: `Checked in member`,
          timestamp: ci.checked_in_at,
          details: ci.member_id,
        });
      }

      // Scans performed
      const { data: scans } = await supabase
        .from('scanner_access_logs')
        .select('id, scanned_at, member_id_text, access_granted')
        .eq('scanned_by', userId)
        .order('scanned_at', { ascending: false })
        .limit(100);

      for (const s of scans || []) {
        allActivities.push({
          id: `scan-${s.id}`,
          type: 'scan',
          description: `Scanned ${s.member_id_text || 'member'} — ${s.access_granted ? 'Granted' : 'Denied'}`,
          timestamp: s.scanned_at,
        });
      }

      // Guest passes sold
      const { data: guestsSold } = await supabase
        .from('guest_passes' as any)
        .select('id, created_at, guest_name')
        .eq('sold_by', userId)
        .order('created_at', { ascending: false })
        .limit(100) as { data: any[] | null };

      for (const gp of guestsSold || []) {
        allActivities.push({
          id: `gps-${gp.id}`,
          type: 'guest_pass_sold',
          description: `Sold guest pass to ${gp.guest_name}`,
          timestamp: gp.created_at,
        });
      }

      // Guest passes checked in
      const { data: guestsCheckedIn } = await supabase
        .from('guest_passes' as any)
        .select('id, used_at, guest_name')
        .eq('checked_in_by', userId)
        .not('used_at', 'is', null)
        .order('used_at', { ascending: false })
        .limit(100) as { data: any[] | null };

      for (const gp of guestsCheckedIn || []) {
        allActivities.push({
          id: `gpci-${gp.id}`,
          type: 'guest_pass_checkin',
          description: `Checked in guest ${gp.guest_name}`,
          timestamp: gp.used_at,
        });
      }

      // Spa appointments managed
      const { data: spaAppts } = await supabase
        .from('spa_appointments')
        .select('id, created_at, service_name, appointment_date')
        .eq('staff_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      for (const sa of spaAppts || []) {
        allActivities.push({
          id: `spa-${sa.id}`,
          type: 'spa_appointment',
          description: `Managed ${sa.service_name} appointment`,
          timestamp: sa.created_at,
          details: sa.appointment_date,
        });
      }

      // Sort by timestamp descending
      allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setActivities(allActivities);
      setStats({
        checkIns: (checkIns || []).length,
        scans: (scans || []).length,
        guestPasses: (guestsSold || []).length + (guestsCheckedIn || []).length,
        spaAppts: (spaAppts || []).length,
      });
    } catch (error) {
      console.error('Error fetching staff activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'all' ? activities : activities.filter(a => a.type === filter);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Activity Log</CardTitle>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Activity</SelectItem>
            <SelectItem value="check_in">Check-Ins</SelectItem>
            <SelectItem value="scan">Scans</SelectItem>
            <SelectItem value="guest_pass_sold">Guest Passes Sold</SelectItem>
            <SelectItem value="guest_pass_checkin">Guest Check-Ins</SelectItem>
            <SelectItem value="spa_appointment">Spa Appointments</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {/* Stats summary */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="text-center p-2 rounded-md bg-muted/50">
            <p className="text-lg font-bold">{stats.checkIns}</p>
            <p className="text-xs text-muted-foreground">Check-Ins</p>
          </div>
          <div className="text-center p-2 rounded-md bg-muted/50">
            <p className="text-lg font-bold">{stats.scans}</p>
            <p className="text-xs text-muted-foreground">Scans</p>
          </div>
          <div className="text-center p-2 rounded-md bg-muted/50">
            <p className="text-lg font-bold">{stats.guestPasses}</p>
            <p className="text-xs text-muted-foreground">Guest Passes</p>
          </div>
          <div className="text-center p-2 rounded-md bg-muted/50">
            <p className="text-lg font-bold">{stats.spaAppts}</p>
            <p className="text-xs text-muted-foreground">Spa Appts</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No activity found</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filtered.map((activity) => {
              const Icon = TYPE_ICONS[activity.type] || QrCode;
              return (
                <div key={activity.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                  <div className="mt-0.5 p-1.5 rounded-md bg-muted">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(activity.timestamp), 'MMM d, yyyy · h:mm a')}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {TYPE_LABELS[activity.type]}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
