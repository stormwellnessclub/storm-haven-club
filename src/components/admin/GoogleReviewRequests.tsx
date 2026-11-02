import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Check, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatInTimeZone } from 'date-fns-tz';

const db = supabase as any;
async function call(action: string, payload = {}) {
  const { data, error } = await supabase.functions.invoke('campaign-studio', { body: { action, ...payload } });
  if (error || data?.ok === false) throw new Error(data?.error || error?.message);
  return data;
}
export function GoogleReviewRequests() {
  const qc = useQueryClient();
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [email, setEmail] = useState(''), [phone, setPhone] = useState(''), [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: settings, error: settingsError } = useQuery({ queryKey: ['google-review-settings'], queryFn: async () => {
    const { data, error } = await db.from('google_review_settings').select('*').single(); if (error) throw error; return data;
  } });
  const { data: people = [] } = useQuery({ queryKey: ['google-review-people'], queryFn: async () => {
    const all = []; for (let from = 0; ; from += 1000) { const { data, error } = await db.from('google_review_people').select('*').order('created_at', { ascending: false }).range(from, from + 999); if (error) throw error; all.push(...data); if (data.length < 1000) return all; }
  } });
  const { data: google, error: googleError, isLoading } = useQuery({ queryKey: ['google-reviews'], queryFn: () => call('google_reviews'), staleTime: 300_000 });
  const { data: matches } = useQuery({ queryKey: ['review-search', query], queryFn: () => call('review_people', { search: query }), enabled: query.length > 1 });
  const { data: messages = [] } = useQuery({ queryKey: ['google-review-messages'], queryFn: async () => {
    const { data, error } = await db.from('google_review_messages').select('*,google_review_requests(first_name,email,visit_type)').order('due_at', { ascending: false }).limit(100); if (error) throw error; return data;
  } });
  const mark = async (person: any) => {
    const em = String(person.email || '').trim().toLowerCase(), ph = String(person.phone || '').replace(/\D/g, '').slice(-10);
    if (!em && !ph && !person.user_id) return toast.error('An email, phone number or account is required');
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await db.from('google_review_people').insert({ name: person.name, email: em || null, phone: ph || null, user_id: person.user_id || null, reviewed_at: new Date().toISOString(), marked_by: auth.user?.id });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['google-review-people'] }); toast.success('Marked reviewed; further requests will be skipped');
      setEmail(''); setPhone(''); setName('');
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return <section className="space-y-5 border-t pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-xl">Google review requests</h2><div className="flex items-center gap-2"><Switch id="review-enabled" checked={settings?.enabled ?? false} disabled={!settings} onCheckedChange={async (enabled) => {
      const { error } = await db.from('google_review_settings').update({ enabled }).eq('id', true); if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ['google-review-settings'] });
    }} /><Label htmlFor="review-enabled">{settings?.enabled ? 'Active' : 'Paused'}</Label></div></div>
    {settingsError && <p className="text-sm text-destructive">{settingsError.message}</p>}
    <div className="flex flex-wrap gap-2"><Badge variant="outline">SMS · 24 hours</Badge><Badge variant="outline">Email · 48 hours</Badge><Badge variant="outline">15 sends / day · 48 minutes apart</Badge><Badge variant="outline">90-day cooldown</Badge></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3"><h3 className="font-medium">Confirmed reviewers · {people.length}</h3>
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setQuery(search); }}><Input aria-label="Find a reviewer account" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or email" /><Button type="submit" variant="outline" size="icon" aria-label="Search accounts"><Search className="h-4 w-4" /></Button></form>
        {matches?.people?.map((p: any) => <div key={p.user_id} className="flex items-center justify-between gap-2 border-b py-2 text-sm"><div className="min-w-0"><p>{p.first_name} {p.last_name}</p><p className="break-all text-muted-foreground">{p.email}</p></div><Button size="sm" variant="outline" disabled={busy || people.some((x: any) => x.user_id === p.user_id || x.email === p.email?.toLowerCase())} onClick={() => mark({ ...p, name: [p.first_name,p.last_name].filter(Boolean).join(' ') })}><Check className="mr-1 h-4 w-4" />Reviewed</Button></div>)}
        <form className="space-y-2" onSubmit={e => { e.preventDefault(); mark({ name, email, phone }); }}><Input aria-label="Reviewer name" placeholder="Reviewer name" value={name} onChange={e => setName(e.target.value)} /><div className="grid gap-2 sm:grid-cols-2"><Input aria-label="Reviewer email" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} /><Input aria-label="Reviewer phone" type="tel" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} /></div><Button type="submit" variant="outline" disabled={busy || (!email && !phone)}><Check className="mr-2 h-4 w-4" />Mark reviewed</Button></form>
        <ul className="max-h-60 divide-y overflow-y-auto">{people.map((p: any) => <li key={p.id} className="py-2 text-sm"><p>{p.name || p.email || p.phone}</p><p className="break-all text-xs text-muted-foreground">{p.email || p.phone} · Confirmed reviewed</p></li>)}</ul>
      </div>
      <div className="space-y-3"><h3 className="font-medium">Google reviews · {google?.total ?? '—'}</h3>{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}{googleError && <p className="text-sm text-destructive">{googleError.message}</p>}<ul className="max-h-[450px] divide-y overflow-y-auto">{google?.reviews?.map((r: any) => <li key={r.id} className="space-y-1 py-3"><div className="flex justify-between gap-2"><span className="text-sm font-medium">{r.name}</span><span className="text-xs text-muted-foreground">{formatInTimeZone(r.date,'America/Detroit','MMM d, yyyy')}</span></div>{r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}</li>)}</ul></div>
    </div>
    <div><h3 className="mb-2 font-medium">Request activity</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Guest / visit</th><th>Channel</th><th>Earliest send</th><th>Status</th></tr></thead><tbody>{messages.map((m: any) => <tr key={m.id} className="border-b"><td className="py-2">{m.google_review_requests?.first_name || m.google_review_requests?.email || 'Guest'}<div className="text-xs text-muted-foreground">{m.google_review_requests?.visit_type}</div></td><td>{m.channel}</td><td className="whitespace-nowrap">{formatInTimeZone(m.due_at,'America/Detroit','MMM d, h:mm a')}</td><td>{m.status}{m.detail && <div className="max-w-xs text-xs text-muted-foreground">{m.detail}</div>}</td></tr>)}</tbody></table>{!messages.length && <p className="py-4 text-sm text-muted-foreground">No review requests yet.</p>}</div></div>
  </section>;
}