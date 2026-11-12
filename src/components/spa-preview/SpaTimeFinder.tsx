import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { SpaService } from "@/hooks/useSpaManagement";
import { orderedSpaMenu, spaMenuMode } from "@/lib/spaMenu";
import { groupTreatments } from "@/lib/spaVariants";
import { AELLA_SCULPT } from "@/lib/aellaSculpt";
import { lengthChoice, lengthLabel, requestHref } from "./TreatmentRow";

const choice = (on: boolean) =>
  `border px-5 py-3 text-left text-sm transition-colors ${on ? "border-foreground bg-foreground text-background" : "border-foreground/30 text-foreground hover:border-foreground/70"}`;
const primary = "inline-flex items-center justify-center border border-foreground bg-foreground px-8 py-4 text-xs tracking-[0.25em] uppercase text-background transition-opacity hover:opacity-90";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-foreground/15 py-8">
      <p className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground">{String(n).padStart(2, "0")}</p>
      <h3 className="mt-3 mb-6 font-serif text-2xl md:text-3xl">{title}</h3>
      {children}
    </div>
  );
}

/**
 * "Let's find your time": pick the kind of care, the treatment and its length, then open booking
 * for exactly that choice. Facials go to the appointment request; Aella Sculpt goes to its own booking.
 */
export function SpaTimeFinder({ services, chapters, onBook }: {
  services: SpaService[];
  chapters: { category: string; title: string }[];
  onBook: (s: SpaService) => void;
}) {
  const [cat, setCat] = useState<string | null>(null);
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);

  const groups = useMemo(
    () => (cat ? groupTreatments(orderedSpaMenu(services, cat)).filter((g) => spaMenuMode(g.variants[0]) !== "soon") : []),
    [services, cat],
  );
  const group = groups.find((g) => g.key === groupKey) ?? null;
  const variant = group ? group.variants.find((v) => v.id === variantId) ?? (group.variants.length === 1 ? group.variants[0] : null) : null;
  const mode = variant ? spaMenuMode(variant) : null;
  const isSculpt = cat === "Aella Body Lab";

  return (
    <div className="mx-auto max-w-3xl">
      <Step n={1} title="What would you like?">
        <div className="grid gap-2 sm:grid-cols-2">
          {chapters.map((c) => (
            <button key={c.category} type="button" aria-pressed={cat === c.category} className={choice(cat === c.category)}
              onClick={() => { setCat(c.category); setGroupKey(null); setVariantId(null); }}>
              {c.title}
            </button>
          ))}
        </div>
      </Step>

      {isSculpt && (
        <Step n={2} title={AELLA_SCULPT.name}>
          <p className="mb-8 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {AELLA_SCULPT.minutes} minutes. Choose your treatment area and a single treatment or series on the next page.
          </p>
          <Link to="/spa/preview/aella-sculpt#book" className={primary}>Find Your Time</Link>
        </Step>
      )}

      {cat && !isSculpt && (
        <Step n={2} title="Choose your treatment">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading the menu…</p>
          ) : (
            <div className="grid gap-2">
              {groups.map((g) => (
                <button key={g.key} type="button" aria-pressed={groupKey === g.key} className={`${choice(groupKey === g.key)} flex items-baseline justify-between gap-6`}
                  onClick={() => { setGroupKey(g.key); setVariantId(g.variants.length === 1 ? g.variants[0].id : null); }}>
                  <span>{g.name}</span>
                  <span className={`shrink-0 text-xs ${groupKey === g.key ? "text-background/70" : "text-muted-foreground"}`}>
                    {g.variants.map((v) => `${v.duration_minutes}`).join(" / ")} min
                  </span>
                </button>
              ))}
            </div>
          )}
        </Step>
      )}

      {group && group.variants.length > 1 && (
        <Step n={3} title="How long?">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Length">
            {group.variants.map((v) => (
              <button key={v.id} type="button" role="radio" aria-checked={variant?.id === v.id} onClick={() => setVariantId(v.id)} className={lengthChoice(variant?.id === v.id)}>
                {lengthLabel(v)}
              </button>
            ))}
          </div>
        </Step>
      )}

      {group && variant && (
        <div className="border-t border-foreground/15 py-8">
          <p className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground">You're booking</p>
          <p className="mt-3 font-serif text-2xl md:text-3xl">{group.name}</p>
          <p className="mt-2 text-xs tracking-[0.2em] uppercase text-muted-foreground">{lengthLabel(variant)}</p>
          <div className="mt-8">
            {mode === "book" && <button type="button" className={primary} onClick={() => onBook(variant)}>Find Your Time</button>}
            {mode === "request" && (
              <>
                <p className="mb-6 max-w-xl text-sm text-muted-foreground">Send us the days and times that suit you, and we'll confirm your appointment.</p>
                <Link to={requestHref(variant)} className={primary}>Request Appointment</Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
