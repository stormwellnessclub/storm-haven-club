import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { SpaService } from "@/hooks/useSpaManagement";
import { CUPPING_PRICE_PER_AREA, MASSAGE_INCLUSIONS, massageDetails, massageName } from "@/lib/massages";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

export function MassageCard({ variants, onBook, isMember }: { variants: SpaService[]; onBook: (service: SpaService) => void; isMember: boolean }) {
  const [open, setOpen] = useState(false);
  const [details, setDetailsOpen] = useState(false);
  const [choice, setChoice] = useState("");
  const first = variants[0];
  if (!first) return null;
  const info = massageDetails(first.name);
  const name = massageName(first.name);
  const selected = variants.find(s => s.id === choice);
  const cupping = isMember
    ? `Member privilege: cupping, a ${money(CUPPING_PRICE_PER_AREA)}-per-area enhancement, is extended to members at your therapist's discretion.`
    : `Add cupping: ${money(CUPPING_PRICE_PER_AREA)} per area. A privilege extended to members.`;

  return (
    <article className="card-luxury p-6 flex flex-col min-w-0">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Massage{info ? ` · ${info.pressure}` : ""}</p>
      <h3 className="font-serif text-xl mb-3">{name}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed mb-3">{info?.overview || first.description}</p>
      {info && variants.length > 1 && <p className="text-sm italic text-foreground/80 mb-4">{info.extended}</p>}
      <p className="text-xs text-accent flex gap-2 mb-5"><Sparkles className="h-4 w-4 shrink-0" />{cupping}</p>
      <div className="border-t border-border pt-4 space-y-3 mt-auto">
        {variants.map(s => <div key={s.id} className="flex justify-between gap-3 text-sm"><span>{s.duration_minutes} min</span><span className="font-semibold text-accent shrink-0">{money(s.price)}</span></div>)}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button variant="link" className="p-0 h-auto" onClick={() => setDetailsOpen(true)}>What's included</Button>
          <Button variant="outline" size="sm" onClick={() => { if (variants.length === 1) { onBook(first); return; } setChoice(first.id); setOpen(true); }}>Book Now</Button>
        </div>
      </div>

      <Dialog open={details} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{name}</DialogTitle><DialogDescription>{info?.pressure}</DialogDescription></DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">{info?.overview}</p>
          {info && <p className="text-sm">{info.extended}</p>}
          <p className="text-xs uppercase tracking-wider text-muted-foreground pt-2">Included in every massage</p>
          <ul className="space-y-2">{MASSAGE_INCLUSIONS.map(i => <li key={i} className="flex gap-2 text-sm"><Check className="h-4 w-4 shrink-0 text-accent mt-0.5" />{i}</li>)}</ul>
          <p className="text-sm text-accent">{cupping}</p>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{name}</DialogTitle><DialogDescription>Choose your massage length</DialogDescription></DialogHeader>
          <RadioGroup aria-label="Massage length" value={choice} onValueChange={setChoice} className="gap-3">
            {variants.map(s => <Label key={s.id} htmlFor={`massage-${s.id}`} className={`flex items-center gap-3 border rounded-md p-4 cursor-pointer ${choice === s.id ? "border-accent bg-accent/5" : "border-border"}`}>
              <RadioGroupItem id={`massage-${s.id}`} value={s.id} className="shrink-0" />
              <span className="flex-1 font-semibold">{s.duration_minutes} minutes</span>
              <span className="text-accent font-semibold shrink-0">{money(s.price)}</span>
            </Label>)}
          </RadioGroup>
          <Button disabled={!selected} onClick={() => { if (!selected) return; setOpen(false); onBook(selected); }}>Continue to booking</Button>
        </DialogContent>
      </Dialog>
    </article>
  );
}
