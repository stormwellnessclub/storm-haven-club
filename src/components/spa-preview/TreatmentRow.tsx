import { useState } from "react";
import { Link } from "react-router-dom";
import type { SpaService } from "@/hooks/useSpaManagement";
import { spaMenuMode } from "@/lib/spaMenu";
import type { TreatmentGroup } from "@/lib/spaVariants";

export const money = (n: number) => `$${Number(n).toFixed(0)}`;
export const lengthLabel = (s: Pick<SpaService, "duration_minutes" | "price">) => `${s.duration_minutes} min · ${money(s.price)}`;
const btn = "text-xs tracking-[0.25em] uppercase border border-foreground/50 px-6 py-3 text-foreground hover:bg-foreground hover:text-background transition-colors";
const quiet = "border-b border-foreground/40 pb-1 text-xs tracking-[0.25em] uppercase text-foreground hover:border-foreground transition-colors";
export const lengthChoice = (on: boolean) =>
  `border px-4 py-2 text-xs tracking-[0.15em] uppercase transition-colors ${on ? "border-foreground bg-foreground text-background" : "border-foreground/30 text-foreground hover:border-foreground/70"}`;

export const requestHref = (s: Pick<SpaService, "category">) => `/spa?category=${encodeURIComponent(s.category)}`;

interface Props {
  group: TreatmentGroup<SpaService>;
  onBook: (s: SpaService) => void;
  /** Small label above the name, e.g. "Signature". */
  label?: string;
  viewHref?: string;
  photo?: { src: string; alt: string; pos?: string };
  notes?: string[];
  /** A short practical note shown under the lengths (e.g. arrive early). */
  aside?: string;
}

/** One treatment on the menu, with every length it comes in. */
export function TreatmentRow({ group, onBook, label, viewHref, photo, notes, aside }: Props) {
  const [pickId, setPickId] = useState(group.variants[0]?.id);
  const chosen = group.variants.find((v) => v.id === pickId) ?? group.variants[0];
  if (!chosen) return null;
  const mode = spaMenuMode(chosen);
  const several = group.variants.length > 1;
  const description = group.variants.find((v) => v.description)?.description;
  return (
    <li className="border-t border-foreground/15 py-8">
      {photo && (
        <figure className="mb-6">
          <img src={photo.src} alt={photo.alt} loading="lazy" className={`aspect-[4/3] w-full object-cover ${photo.pos ?? ""}`} />
        </figure>
      )}
      {label && <p className="mb-3 text-[10px] tracking-[0.35em] uppercase text-muted-foreground">{label}</p>}
      <h3 className="font-serif text-2xl md:text-3xl">{group.name}</h3>
      {description && <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {notes && notes.length > 0 && (
        <ul className="mt-4 flex max-w-xl flex-wrap gap-x-5 gap-y-1 text-xs text-foreground/75">
          {notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
      {mode === "book" && several ? (
        <div className="mt-5 flex flex-wrap gap-2" role="radiogroup" aria-label={`${group.name} length`}>
          {group.variants.map((v) => (
            <button key={v.id} type="button" role="radio" aria-checked={v.id === chosen.id} onClick={() => setPickId(v.id)} className={lengthChoice(v.id === chosen.id)}>
              {lengthLabel(v)}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-xs tracking-[0.2em] uppercase text-muted-foreground">
          {group.variants.map(lengthLabel).join("   /   ")}
        </p>
      )}
      {aside && <p className="mt-4 max-w-xl text-xs leading-relaxed text-muted-foreground">{aside}</p>}
      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
        {mode === "book" && (
          <button type="button" onClick={() => onBook(chosen)} className={btn}>
            Book{several ? ` ${chosen.duration_minutes} min` : ""}
          </button>
        )}
        {mode === "request" && <Link to={requestHref(chosen)} className={btn}>Request</Link>}
        {mode === "soon" && <span className="text-xs tracking-[0.25em] uppercase text-muted-foreground">Coming soon</span>}
        {viewHref && <Link to={viewHref} className={quiet}>View Treatment</Link>}
      </div>
    </li>
  );
}
