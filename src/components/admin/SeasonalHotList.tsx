import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Printer, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { hotListText, REASON_LABEL, REASON_OFFER, SEASONAL_EDIT_ENDS, type HotReason } from '@/lib/seasonalHotList';

type Row = { user_id: string; first_name: string | null; last_name: string | null; phone: string | null; email: string | null; is_member: boolean; reason_key: HotReason; reason: string; trainer: string | null; priority: number; contacted_at: string | null; bought_at: string | null };

export function SeasonalHotList() {
  const qc = useQueryClient();
  const [sender, setSender] = useState('Storm');
  const [trainer, setTrainer] = useState('all');
  const [reason, setReason] = useState('all');
  const [hideDone, setHideDone] = useState(true);
  const [showCard, setShowCard] = useState(false);
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['seasonal-hot-list'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_seasonal_hot_list' as never);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const trainers = useMemo(() => [...new Set(data.map(r => r.trainer).filter(Boolean))] as string[], [data]);
  const rows = data.filter(r => (trainer === 'all' || r.trainer === trainer) && (reason === 'all' || r.reason_key === reason) && (!hideDone || (!r.contacted_at && !r.bought_at)));

  const mark = async (r: Row, field: 'contacted_at' | 'bought_at', on: boolean) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('marketing_outreach_marks' as never).upsert({ user_id: r.user_id, [field]: on ? new Date().toISOString() : null, ...(field === 'contacted_at' && on ? { contacted_by: u.user?.id } : {}), updated_at: new Date().toISOString() } as never, { onConflict: 'user_id' });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['seasonal-hot-list'] });
  };
  const copy = async (r: Row) => {
    await navigator.clipboard.writeText(hotListText(r.reason_key, r.first_name, sender));
    toast.success('Text copied. Paste it into a message from your phone.');
  };

  return <section className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4 print:hidden">
      <div>
        <p className="text-xs uppercase text-muted-foreground">Ends {SEASONAL_EDIT_ENDS} · 11:59 PM</p>
        <h2 className="mt-1 font-serif text-3xl">Hot list</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">The people most likely to buy, best first. Copy the personal text, send it from your own phone, then mark them. Anyone who already bought from the Seasonal Edit is left off.</p>
      </div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setShowCard(s => !s)}>{showCard ? 'Hide' : 'Counter card & desk script'}</Button><Button variant="outline" onClick={() => window.print()}><Printer />Print list</Button></div>
    </header>

    {showCard && <CounterCard />}

    <div className="flex flex-wrap items-end gap-3 print:hidden">
      <label className="text-xs">Text signed by<Input className="mt-1 w-40" value={sender} onChange={e => setSender(e.target.value)} /></label>
      <label className="text-xs">Trainer<Select value={trainer} onValueChange={setTrainer}><SelectTrigger className="mt-1 w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{trainers.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></label>
      <label className="text-xs">Why<Select value={reason} onValueChange={setReason}><SelectTrigger className="mt-1 w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Everyone</SelectItem>{Object.entries(REASON_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></label>
      <Button variant={hideDone ? 'secondary' : 'outline'} onClick={() => setHideDone(h => !h)}>{hideDone ? 'Showing not contacted' : 'Showing everyone'}</Button>
      <Badge variant="secondary">{rows.length} people</Badge>
    </div>

    {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
    {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

    <div className="divide-y rounded-lg border">
      {rows.map(r => <article key={r.user_id} className="grid gap-3 p-3 md:grid-cols-[1.2fr_1.5fr_auto] md:items-center print:break-inside-avoid">
        <div>
          <p className="font-medium">{[r.first_name, r.last_name].filter(Boolean).join(' ') || r.email}{r.is_member && <Badge variant="outline" className="ml-2">Member</Badge>}</p>
          <p className="text-xs text-muted-foreground">{r.phone ? <a className="inline-flex items-center gap-1 underline" href={`sms:${r.phone}`}><Phone className="h-3 w-3" />{r.phone}</a> : 'No phone'}{r.trainer ? ` · Trainer: ${r.trainer}` : ''}</p>
        </div>
        <div className="text-sm"><p>{r.reason}</p><p className="text-xs text-muted-foreground">Offer: {REASON_OFFER[r.reason_key]}</p></div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button size="sm" onClick={() => copy(r)}><Copy />Copy text</Button>
          <Button size="sm" variant={r.contacted_at ? 'secondary' : 'outline'} onClick={() => mark(r, 'contacted_at', !r.contacted_at)}>{r.contacted_at && <Check />}Contacted</Button>
          <Button size="sm" variant={r.bought_at ? 'secondary' : 'outline'} onClick={() => mark(r, 'bought_at', !r.bought_at)}>{r.bought_at && <Check />}Bought</Button>
        </div>
      </article>)}
      {!isLoading && !rows.length && <p className="p-4 text-sm text-muted-foreground">Nobody left on this list.</p>}
    </div>
  </section>;
}

function CounterCard() {
  return <div className="grid gap-4 md:grid-cols-2">
    <div className="rounded-lg border bg-card p-8 text-center print:break-after-page">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Storm Wellness Club</p>
      <h3 className="mt-4 font-serif text-4xl">The Seasonal Edit</h3>
      <p className="mt-3 text-sm">Personal training, classes and massage, at our best pricing of the year.</p>
      <p className="mt-1 text-sm font-medium">Ends {SEASONAL_EDIT_ENDS} at 11:59 PM</p>
      <div className="mx-auto mt-6 w-fit rounded bg-background p-3"><QRCodeSVG value="https://stormwellnessclub.com/seasonal-edit" size={160} /></div>
      <p className="mt-3 text-xs text-muted-foreground">Scan to see the offers, or ask us at the desk</p>
    </div>
    <div className="rounded-lg border p-6 text-sm print:hidden">
      <p className="text-xs uppercase text-muted-foreground">Front desk script: say it at every check-in</p>
      <p className="mt-3 font-serif text-xl">“Have you seen the Seasonal Edit? It ends Sunday. Training, classes and massages, and it makes a beautiful gift.”</p>
      <p className="mt-4 text-muted-foreground">If they're interested, hand them the card or open the hot list and copy their personal text. Never say “sale” or “free.”</p>
    </div>
  </div>;
}
