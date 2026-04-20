import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { TeamMember } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TeamMember[];
  onChanged: () => void;
}

interface TimeOffRow {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'denied';
  notes: string | null;
}

export function TimeOffPanel({ open, onOpenChange, members, onChanged }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<TimeOffRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('staff_time_off_requests' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error) setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const memberById = new Map(members.filter((m) => m.user_id).map((m) => [m.user_id!, m]));

  const review = async (id: string, status: 'approved' | 'denied') => {
    const { error } = await supabase
      .from('staff_time_off_requests' as any)
      .update({
        status,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }

    // If approved, create PTO shift rows for each day
    if (status === 'approved') {
      const row = rows.find((r) => r.id === id);
      if (row) {
        const m = memberById.get(row.user_id);
        const dates: string[] = [];
        const start = new Date(row.start_date + 'T12:00:00');
        const end = new Date(row.end_date + 'T12:00:00');
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          );
        }
        const inserts = dates.map((date) => ({
          user_id: row.user_id,
          person_name: m?.name ?? null,
          shift_date: date,
          start_time: '00:00:00',
          end_time: '23:59:00',
          status: 'pto' as const,
          notes: row.reason,
          created_by: user?.id ?? null,
        }));
        if (inserts.length) {
          await supabase.from('staff_shifts' as any).insert(inserts);
        }
      }
    }

    toast({ title: status === 'approved' ? 'Approved' : 'Denied' });
    load();
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Time-Off Requests</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {loading ? (
            <div className="text-sm text-muted-foreground p-4">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4">No requests.</div>
          ) : (
            rows.map((r) => {
              const m = memberById.get(r.user_id);
              return (
                <Card key={r.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{m?.name ?? 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.start_date} → {r.end_date}
                      </div>
                      {r.reason && <div className="text-sm mt-1">{r.reason}</div>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant={
                          r.status === 'approved'
                            ? 'default'
                            : r.status === 'denied'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {r.status}
                      </Badge>
                      {r.status === 'pending' && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => review(r.id, 'approved')}>
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => review(r.id, 'denied')}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
