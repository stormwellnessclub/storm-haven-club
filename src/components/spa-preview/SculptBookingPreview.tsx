import { useState } from "react";
import { AELLA_SCULPT } from "@/lib/aellaSculpt";
import { useSpaTreatmentPackages } from "@/hooks/useSpaTreatmentPackages";
import { formatDollars, packageLabel, splitPackages } from "@/lib/spaPackages";
import { useSpaTreatmentZones } from "@/hooks/useSpaTreatmentZones";
import { activeZones, canPickTimes, chooseZone, ZONE_PROMPT, ZONE_PROMPT_NOTE } from "@/lib/spaZones";

const Step = ({ n, title, children, locked = false }: { n: number; title: string; children: React.ReactNode; locked?: boolean }) => (
  <div className={`border-t border-foreground/15 py-10 transition-opacity ${locked ? "pointer-events-none opacity-35" : ""}`} aria-disabled={locked || undefined}>
    <p className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground">Step {n}</p>
    <h3 className="mt-3 font-serif text-2xl md:text-3xl">{title}</h3>
    <div className="mt-6">{children}</div>
  </div>
);

const choice = (on: boolean) =>
  `border px-5 py-3 text-left text-sm transition-colors ${
    on ? "border-foreground bg-foreground text-background" : "border-foreground/30 text-foreground hover:border-foreground/70"
  }`;

/**
 * Design preview of the Aella Sculpt booking steps (area → visit type → single or series → summary).
 * Nothing is reserved or charged: the service, prices and providers are not set up yet.
 */
export function SculptBookingPreview() {
  const [zoneId, setZoneId] = useState<string | null>(null);
  const { data: zoneRows = [] } = useSpaTreatmentZones();
  const zones = activeZones(zoneRows, "aella-sculpt");
  const zone = zones.find((z) => z.id === zoneId)?.name ?? null;
  const locked = !canPickTimes(zoneId);
  const [visit, setVisit] = useState<string | null>(null);
  const [pkgId, setPkgId] = useState<string | null>(null);
  const visitType = AELLA_SCULPT.visitTypes.find((v) => v.id === visit);
  const { data = [] } = useSpaTreatmentPackages();
  const { single, series } = splitPackages(data, "aella-sculpt");
  const options = [single, ...series].filter(Boolean) as NonNullable<typeof single>[];
  const chosen = options.find((o) => o.id === pkgId) ?? null;

  return (
    <section id="book" className="scroll-mt-20 px-6 py-28 md:px-16 md:py-40">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-serif text-5xl md:text-6xl">Let's find your time.</h2>
        <div className="mt-14">
          <Step n={1} title={ZONE_PROMPT}>
            <p className="-mt-3 mb-6 max-w-xl text-sm leading-relaxed text-muted-foreground">{ZONE_PROMPT_NOTE}</p>
            <div className="grid gap-2 md:grid-cols-2" role="radiogroup" aria-label="Treatment zone">
              {zones.map((z) => (
                <button key={z.id} type="button" role="radio" aria-checked={zoneId === z.id} onClick={() => setZoneId(chooseZone(zoneId, z.id))} className={choice(zoneId === z.id)}>
                  <span className="block">{z.name}</span>
                  {z.description && <span className={`mt-1 block text-xs leading-relaxed ${zoneId === z.id ? "text-background/70" : "text-muted-foreground"}`}>{z.description}</span>}
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">One zone per appointment.</p>
          </Step>
          <Step n={2} title="Is this your first Aella Sculpt treatment?" locked={locked}>
            <div className="grid gap-2 md:grid-cols-2">
              {AELLA_SCULPT.visitTypes.map((v) => (
                <button key={v.id} type="button" aria-pressed={visit === v.id} onClick={() => setVisit(v.id)} className={choice(visit === v.id)}>
                  <span className="block">{v.label}</span>
                  <span className={`mt-1 block text-xs ${visit === v.id ? "text-background/70" : "text-muted-foreground"}`}>{v.note}</span>
                </button>
              ))}
            </div>
          </Step>
          <Step n={3} title="A single treatment, or a series?" locked={locked}>
            <div className="grid gap-2">
              {options.map((o) => (
                <button key={o.id} type="button" aria-pressed={pkgId === o.id} onClick={() => setPkgId(o.id)}
                  className={`${choice(pkgId === o.id)} flex items-baseline justify-between gap-6`}>
                  <span>{packageLabel(o)}{o.is_recommended && <span className={`ml-3 text-[10px] tracking-[0.3em] uppercase ${pkgId === o.id ? "text-background/70" : "text-muted-foreground"}`}>Recommended</span>}</span>
                  <span className="font-serif text-lg">{formatDollars(o.price_cents)}</span>
                </button>
              ))}
            </div>
          </Step>
          <Step n={4} title="You're booking" locked={locked}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Treatment</dt><dd>{AELLA_SCULPT.name} · {AELLA_SCULPT.minutes} minutes</dd>
              <dt className="text-muted-foreground">Area</dt><dd>{zone ?? "Choose an area"}</dd>
              <dt className="text-muted-foreground">Visit</dt><dd>{visitType?.label ?? "Choose a visit type"}</dd>
              <dt className="text-muted-foreground">Option</dt><dd>{chosen ? `${packageLabel(chosen)} · ${formatDollars(chosen.price_cents)}` : "Choose an option"}</dd>
              <dt className="text-muted-foreground">Provider</dt><dd>First available</dd>
            </dl>
            <button type="button" disabled className="mt-10 cursor-not-allowed border border-foreground/30 px-6 py-3 text-xs tracking-[0.25em] uppercase text-muted-foreground">
              View Availability
            </button>
            <p className="mt-4 text-sm text-muted-foreground">
              Preview only. Available times appear here once Aella Sculpt opens for booking.
            </p>
          </Step>
        </div>
      </div>
    </section>
  );
}
