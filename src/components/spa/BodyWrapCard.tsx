import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { SpaService } from "@/hooks/useSpaManagement";
import { bodyWrapDetails, bodyWrapName } from "@/lib/bodyWraps";

export function BodyWrapCard({ variants, onBook }: { variants: SpaService[]; onBook: (service: SpaService) => void }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("");
  const first = variants[0];
  if (!first) return null;
  const details = bodyWrapDetails(first.name);
  const name = bodyWrapName(first.name);
  const selected = variants.find(s => s.id === choice);
  const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
  return (
    <article id={`wrap-${details?.slug || first.id}`} className="card-luxury p-6 flex flex-col scroll-mt-48 min-w-0">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Body Wraps</p>
      <h3 className="font-serif text-xl mb-3">{name}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed mb-5">{details?.overview || first.description}</p>
      {details && <ul className="grid sm:grid-cols-2 gap-3 mb-5">{details.benefits.map(b => <li key={b.title} className="flex items-start gap-2 text-sm font-medium"><Check className="h-4 w-4 shrink-0 text-accent mt-0.5" />{b.title}</li>)}</ul>}
      <div className="border-t border-border pt-4 space-y-3 mt-auto">
        {variants.map(s => <div key={s.id} className="flex justify-between gap-3 text-sm"><span>{s.duration_minutes} min{variants.length > 1 ? ` · ${/\(extended\)/i.test(s.name) ? "Extended treatment" : "Body wrap"}` : ""}</span><span className="font-semibold text-accent shrink-0">{money(s.price)}</span></div>)}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {details && <Button asChild variant="link" className="p-0 h-auto"><Link to={`/spa/body-wraps/${details.slug}`}>Learn more <ArrowUpRight className="h-4 w-4 ml-1" /></Link></Button>}
          <Button variant="outline" size="sm" onClick={() => { if (variants.length === 1) { onBook(first); return; } setChoice(first.id); setOpen(true); }}>Book Now</Button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{name}</DialogTitle><DialogDescription>Choose your treatment length</DialogDescription></DialogHeader>
          <RadioGroup aria-label="Treatment length" value={choice} onValueChange={setChoice} className="gap-3">
            {variants.map(s => <Label key={s.id} htmlFor={`wrap-${s.id}`} className={`flex items-start gap-3 border rounded-md p-4 cursor-pointer ${choice === s.id ? "border-accent bg-accent/5" : "border-border"}`}>
              <RadioGroupItem id={`wrap-${s.id}`} value={s.id} className="mt-1 shrink-0" />
              <span className="flex-1 min-w-0 space-y-1"><span className="block font-semibold">{s.duration_minutes} minutes</span><span className="block text-sm text-muted-foreground">{/\(extended\)/i.test(s.name) ? "Wrap with full-body scrub and short massage" : "Body wrap treatment"}</span>{s.member_price != null && <span className="block text-xs text-muted-foreground">Member menu price: {money(s.member_price)}</span>}</span>
              <span className="text-accent font-semibold shrink-0">{money(s.price)}</span>
            </Label>)}
          </RadioGroup>
          <Button disabled={!selected} onClick={() => { if (!selected) return; setOpen(false); onBook(selected); }}>Continue to booking</Button>
        </DialogContent>
      </Dialog>
    </article>
  );
}