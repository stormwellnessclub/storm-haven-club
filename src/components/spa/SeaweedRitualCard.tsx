import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { SpaService } from "@/hooks/useSpaManagement";
import { SEAWEED_RITUAL_NAME, SEAWEED_RITUAL_PATH, SEAWEED_RITUAL_OVERVIEW, SEAWEED_RITUAL_PREPARATION, SEAWEED_RITUAL_BENEFITS } from "@/lib/seaweedRitual";

export function SeaweedRitualCard({ variants, onBook }: { variants: SpaService[]; onBook: (service: SpaService) => void }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("");
  const selected = variants.find(s => s.id === choice);
  return (
    <article id="seaweed-ritual" className="card-luxury p-6 flex flex-col scroll-mt-48">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Body Wraps</p>
      <h3 className="font-serif text-xl mb-3">{SEAWEED_RITUAL_NAME}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed mb-5">{SEAWEED_RITUAL_OVERVIEW}</p>
      <ul className="grid sm:grid-cols-2 gap-3 mb-5">
        {SEAWEED_RITUAL_BENEFITS.map(b => <li key={b.title} className="flex items-start gap-2 text-sm font-medium"><Check className="h-4 w-4 shrink-0 text-accent mt-0.5" />{b.title}</li>)}
      </ul>
      <p className="text-xs text-muted-foreground leading-relaxed mb-5">{SEAWEED_RITUAL_PREPARATION}</p>
      <div className="border-t border-border pt-4 space-y-3 mt-auto">
        {variants.map(s => <div key={s.id} className="flex justify-between gap-3 text-sm"><span>{s.duration_minutes} min · {s.duration_minutes === 90 ? "Extended massage" : "Complete ritual"}</span><span className="font-semibold text-accent shrink-0">${s.price}</span></div>)}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button asChild variant="link" className="p-0 h-auto"><Link to={SEAWEED_RITUAL_PATH}>Learn more <ArrowUpRight className="h-4 w-4 ml-1" /></Link></Button>
          <Button variant="outline" size="sm" onClick={() => { setChoice(variants[0]?.id || ""); setOpen(true); }}>Book Now</Button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{SEAWEED_RITUAL_NAME}</DialogTitle><DialogDescription>Choose your ritual length</DialogDescription></DialogHeader>
          <RadioGroup aria-label="Ritual length" value={choice} onValueChange={setChoice} className="gap-3">
            {variants.map(s => <Label key={s.id} htmlFor={`ritual-${s.id}`} className={`flex items-start gap-3 border rounded-md p-4 cursor-pointer ${choice === s.id ? "border-accent bg-accent/5" : "border-border"}`}>
              <RadioGroupItem id={`ritual-${s.id}`} value={s.id} className="mt-1 shrink-0" />
              <span className="flex-1 min-w-0 space-y-1"><span className="block font-semibold">{s.duration_minutes} minutes</span><span className="block text-sm text-muted-foreground">{s.duration_minutes === 90 ? "Complete ritual with extended massage" : "Complete ritual"}</span>{s.member_price != null && <span className="block text-xs text-muted-foreground">Member menu price: ${s.member_price}</span>}</span>
              <span className="text-accent font-semibold shrink-0">${s.price}</span>
            </Label>)}
          </RadioGroup>
          <p className="text-xs text-muted-foreground leading-relaxed">{SEAWEED_RITUAL_PREPARATION}</p>
          <Button disabled={!selected} onClick={() => { if (!selected) return; setOpen(false); onBook(selected); }}>Continue to booking</Button>
        </DialogContent>
      </Dialog>
    </article>
  );
}