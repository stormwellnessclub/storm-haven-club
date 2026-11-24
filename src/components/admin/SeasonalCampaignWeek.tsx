import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ExternalLink, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SEASONAL_WEEK_PREFIX, WEEK_DAYS } from '../../../supabase/functions/_shared/seasonalCampaignWeek';

type Campaign = { id: string; name: string; status: string; audience_key: string; scheduled_at: string | null; send_email: boolean; send_sms: boolean };
export function SeasonalCampaignWeek({ campaigns, onOpen }: { campaigns: Campaign[]; onOpen: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const week = campaigns.filter(c => c.name.startsWith(SEASONAL_WEEK_PREFIX));
  const prepare = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('campaign-studio', { body: { action: 'prepare_seasonal_week' } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Could not save drafts');
      await qc.invalidateQueries({ queryKey: ['marketing-campaigns'] });
      toast.success(`${data.created} new drafts saved. Nothing sent or scheduled.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save drafts'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
      <div><p className="text-xs uppercase text-muted-foreground">November 24–30 · Michigan time</p><h2 className="mt-2 font-serif text-3xl">Seven Days, Seven Openings</h2><p className="mt-2 max-w-2xl text-sm">One connected campaign: start with intent, show one experience at a time, follow up on interest, then close at the real deadline.</p></div>
      <Button onClick={prepare} disabled={busy}>{busy ? <Loader2 className="animate-spin"/> : <Save/>}{week.length ? 'Add missing drafts' : 'Save campaign drafts'}</Button>
    </header>
    <div className="flex flex-wrap gap-3 text-sm"><Button asChild variant="outline"><Link to="/seasonal-edit/choose" target="_blank">Offer picker<ExternalLink/></Link></Button><Button asChild variant="outline"><Link to="/seasonal-edit/gifts" target="_blank">Reveal card<ExternalLink/></Link></Button><Badge variant="secondary">{week.length} saved drafts and sends</Badge></div>
    <div className="space-y-0">
      {WEEK_DAYS.map(day => {
        const messages = week.filter(c => c.name.includes(`· Nov ${day.day} ·`));
        return <section key={day.day} className="grid gap-4 border-t py-5 md:grid-cols-[100px_1fr_1fr]">
          <div><p className="font-serif text-2xl">Nov {day.day}</p><p className="text-xs text-muted-foreground">Email {day.emailTime} AM</p>{'textTime' in day && <p className="text-xs text-muted-foreground">Text {day.textTime === '16:00' ? '4:00 PM' : day.textTime === '12:00' ? '12:00 PM' : '9:00 AM'}</p>}</div>
          <div><p className="text-xs uppercase text-muted-foreground">{day.focus}</p><h3 className="mt-1 font-serif text-xl">{day.title}</h3><p className="mt-2 text-sm">{day.insight}</p><p className="mt-2 text-xs text-muted-foreground">Measure: {day.goal}</p></div>
          <div className="space-y-2">{messages.length ? messages.map(c => <Button key={c.id} variant="ghost" className="flex h-auto w-full justify-between gap-2 whitespace-normal px-2 py-2 text-left text-xs normal-case tracking-normal" onClick={() => onOpen(c.id)}><span>{c.name.split(`· Nov ${day.day} ·`)[1]}</span><Badge variant={c.status === 'draft' ? 'secondary' : 'outline'}>{c.status}</Badge><ArrowRight className="shrink-0"/></Button>) : <p className="text-xs text-muted-foreground">Drafts not saved yet.</p>}</div>
        </section>;
      })}
    </div>
    <div className="border-t pt-5 text-sm"><h3 className="font-medium">Sending safeguards</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground"><li>Times above are proposals, not scheduled sends. Existing round 3 texts remain unchanged.</li><li>Recent non-members: activity or a purchase in the past 12 months. Imported contacts: prior opens or clicks; one gift email only.</li><li>November 29: last clicked category, excluding people who bought afterward. Opens alone never choose a follow-up category.</li><li>Text consent and all email opt-outs are checked again at send time.</li><li>A separate marketing sender must be verified before it is used; receipts are not changed.</li><li>Results include purchases after an email, not proof that the email caused every purchase.</li></ul></div>
  </section>;
}
