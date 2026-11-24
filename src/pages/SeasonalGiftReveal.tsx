import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, RotateCcw, Loader2, Copy, Check } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/storm-logo-dark.png';

export default function SeasonalGiftReveal() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [params] = useSearchParams();
  const location = useLocation();
  // A private gift code stays in the fragment: it never enters HTTP requests or analytics query strings.
  const candidate = location.hash.slice(1);
  const recipientCode = /^STORM-[A-Z0-9-]{4,40}$/.test(candidate) ? candidate : null;
  const classGift = params.get('kind') === 'class';
  const { data: offers = [], isLoading, error } = useQuery({
    queryKey: ['gift-reveal-offers'], enabled: !recipientCode,
    queryFn: async () => {
      const { data, error } = await supabase.from('gift_card_offers').select('id,label,blurb,price_cents,class_offer_key,starts_at,ends_at').eq('is_active', true).order('display_order');
      if (error) throw error;
      const now = Date.now();
      return (data ?? []).filter(o => (!o.starts_at || Date.parse(o.starts_at) <= now) && (!o.ends_at || Date.parse(o.ends_at) > now));
    },
  });
  const massage = offers.find(o => !o.class_offer_key);
  const movement = offers.find(o => o.class_offer_key === 'movement_edit');
  const gifts = [
    ...(massage ? [{ key: 'massage', title: 'An hour for them.', detail: massage.label, price: massage.price_cents / 100, href: `/shop?gift=${massage.id}#gift-cards` }] : []),
    ...(movement ? [{ key: 'classes', title: 'A place in their week.', detail: movement.label, price: movement.price_cents / 100, href: `/shop?gift=${movement.id}#gift-cards` }] : []),
    { key: 'amount', title: 'Let them choose.', detail: 'Storm Wellness Club gift card', price: null, href: '/shop#gift-cards' },
  ];
  const copy = async () => { if (!recipientCode) return; try { await navigator.clipboard.writeText(recipientCode); setCopied(true); } catch { setCopied(false); } };
  return <Layout><SEOHead title="A Gift Worth Opening | Storm Wellness Club" description="Open the Seasonal Edit gift card. Choose a massage, class experience or Storm Wellness Club gift card." path={recipientCode ? '/gifts/open' : '/seasonal-edit/gifts'} noindex={!!recipientCode}/>
    <main className="bg-background px-5 pb-10 pt-28 text-foreground sm:px-10 sm:pb-16 sm:pt-36">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-xs uppercase">{recipientCode ? 'A gift for you' : 'The Seasonal Edit · Giving'}</p>
        <h1 className="mx-auto mt-4 max-w-xl font-serif text-4xl leading-tight sm:text-5xl">{recipientCode ? 'Something thoughtful is waiting.' : 'For the person who books everyone else first.'}</h1>
        <div className={`gift-reveal mt-10 ${open ? 'gift-reveal-open' : ''}`}>
          <div className="gift-reveal-inside border border-border bg-card px-5 py-9 sm:px-10">
            {open && <div aria-live="polite">
              {recipientCode ? <><h2 className="font-serif text-3xl">Your Storm Wellness Club gift.</h2><p className="mt-5 font-mono text-lg break-all">{recipientCode}</p><Button variant="outline" className="mt-4" onClick={copy}>{copied ? <Check/> : <Copy/>}{copied ? 'Copied' : 'Copy gift code'}</Button><p className="mx-auto mt-6 max-w-md text-sm">Your personal message, chosen experience and validity are in your gift email.</p><Button asChild className="mt-6"><Link to={classGift ? `/seasonal-edit?redeem=${encodeURIComponent(recipientCode)}#redeem` : '/spa'}>{classGift ? 'Redeem your class gift' : 'Find a treatment'}<ArrowRight/></Link></Button><p className="mt-4 text-xs text-muted-foreground">For a gift card amount, share your code with the front desk at checkout.</p></> : <>
                <h2 className="font-serif text-3xl">Chosen by you. Made for them.</h2>
                {isLoading ? <Loader2 className="mx-auto mt-6 animate-spin" aria-label="Loading gifts"/> : error ? <p className="mt-6">Gift options could not load. <Link className="underline" to="/shop#gift-cards">Visit the gift shop</Link>.</p> : <div className="mt-7 grid gap-0 sm:grid-cols-3">
                  {gifts.map(g => <div key={g.key} className="flex flex-col border-t border-border px-3 py-6 text-left sm:border-t-0 sm:border-l first:sm:border-l-0">
                    <h3 className="font-serif text-2xl">{g.title}</h3><p className="mt-3 text-xs leading-relaxed text-muted-foreground">{g.detail}</p><p className="mt-4 text-lg">{g.price === null ? 'Choose an amount' : `$${g.price}`}</p><Button asChild variant="link" className="mt-4 h-auto justify-start whitespace-normal px-0 text-left text-xs normal-case tracking-normal"><Link to={g.href}>Send this gift<ArrowRight/></Link></Button>
                  </div>)}
                </div>}
                <p className="mt-6 text-xs leading-relaxed text-muted-foreground">Member tier pricing is for the member’s own massage. Gifts for someone else use the listed gift price.</p>
              </>}
            </div>}
          </div>
          <div className="gift-reveal-cover border border-border bg-background p-6 sm:p-10" aria-hidden={open}>
            <img src={logo} alt="Storm Wellness Club" className="mx-auto h-24 w-24 object-contain"/>
            <p className="my-7 font-serif text-3xl">An hour no one else schedules.</p>
            <Button onClick={() => setOpen(true)} disabled={open} variant="outline">Open the card<ArrowRight/></Button>
          </div>
        </div>
        {open && <Button onClick={() => setOpen(false)} variant="link" className="mt-5 text-xs normal-case tracking-normal"><RotateCcw/>Close the card</Button>}
        {!recipientCode && <p className="mt-7 text-xs text-muted-foreground">Seasonal Edit gift buying closes November 30 at 11:59 PM Michigan time.<br/>Already purchased gifts keep their stated validity.</p>}
      </div>
    </main>
  </Layout>;
}
