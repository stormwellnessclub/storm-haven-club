import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Dumbbell, CalendarDays, HandHeart, Gift } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { useUserMembership } from '@/hooks/useUserMembership';

const choices = [
  { key: 'stronger', label: 'Stronger', detail: 'Guidance. Progression. A plan that knows you.', icon: Dumbbell, section: 'pt-edit', title: 'Training that knows your name.', body: 'Choose personal training built around your starting point, with 30, 40, 60 or 80 sessions and monthly payment options.' },
  { key: 'calmer', label: 'Calmer', detail: 'A class. A rhythm. A place in your week.', icon: CalendarDays, section: 'movement-edit', title: 'A place in your week.', body: 'Make space for a class routine: explore the Seasonal Edit class packages and choose what fits.' },
  { key: 'restored', label: 'Restored', detail: 'An hour set aside for hands-on care.', icon: HandHeart, section: 'spa-edit', title: 'An hour no one else schedules.', body: 'Storm Signature, Deep Relief, Sports Performance, Lymph & Flow or Prenatal. Choose your treatment and length.' },
  { key: 'giving', label: 'Giving', detail: 'Something thoughtful. Chosen by you.', icon: Gift, section: '', title: 'A gift worth opening.', body: 'Give a massage, a class experience or a Storm Wellness Club gift card, with a message from you.' },
];
export default function SeasonalEditChoose() {
  const [params, setParams] = useSearchParams();
  const { data: membership } = useUserMembership();
  const [choice, setChoice] = useState(params.get('choice') ?? '');
  useEffect(() => { setChoice(params.get('choice') ?? ''); }, [params]);
  const selected = choices.find(c => c.key === choice);
  const view = params.get('for') === 'member' || (!params.get('for') && membership) ? 'member' : 'non_member';
  const pick = (key: string) => { const next = new URLSearchParams(params); next.set('choice', key); setParams(next, { replace: true }); };
  return <Layout><SEOHead title="Choose Your Seasonal Edit | Storm Wellness Club" description="Choose training, classes, massage or a thoughtful gift from The Seasonal Edit." path="/seasonal-edit/choose" />
    <main className="bg-background px-5 pb-12 pt-28 text-foreground sm:px-10 sm:pb-20 sm:pt-36">
      <div className="mx-auto max-w-4xl">
        <p className="mb-5 text-xs uppercase">The Seasonal Edit · November 24–30</p>
        <h1 className="max-w-2xl font-serif text-4xl leading-tight sm:text-6xl">What do you want December to feel like?</h1>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">A little more strength. A routine that fits. Time for care. Something thoughtful for someone else.</p>
        <div className="mt-10 grid border-t border-border sm:grid-cols-2">
          {choices.map(c => <Button key={c.key} variant="ghost" onClick={() => pick(c.key)} aria-pressed={choice === c.key} className={`h-auto min-h-32 justify-between whitespace-normal rounded-none border-b border-border px-3 py-6 text-left text-foreground hover:bg-secondary/40 hover:text-foreground normal-case tracking-normal ${choice === c.key ? 'bg-secondary/40' : ''}`}>
            <span className="flex min-w-0 items-start gap-4"><c.icon className="mt-2 h-5 w-5 shrink-0"/><span><span className="block font-serif text-3xl">{c.label}</span><span className="mt-2 block text-xs leading-relaxed text-muted-foreground">{c.detail}</span></span></span><ArrowRight className="ml-3 shrink-0"/>
          </Button>)}
        </div>
        {selected && <section aria-live="polite" className="mt-10 border-l-2 border-primary pl-6">
          <h2 className="font-serif text-3xl">{selected.title}</h2><p className="my-5 max-w-lg text-sm leading-relaxed">{selected.body}</p>
          <Button asChild><Link to={selected.key === 'giving' ? '/seasonal-edit/gifts' : `/seasonal-edit?for=${view}#${selected.section}`}>{selected.key === 'giving' ? 'Open the gift card' : 'See your options'}<ArrowRight /></Link></Button>
        </section>}
        <p className="mt-10 text-xs text-muted-foreground">Closes November 30 at 11:59 PM Michigan time. Each purchase keeps its stated use-by date.</p>
        <Button asChild variant="link" className="mt-5 px-0 normal-case tracking-normal"><Link to={`/seasonal-edit?for=${view}`}><ArrowLeft/>The full Seasonal Edit</Link></Button>
      </div>
    </main>
  </Layout>;
}
