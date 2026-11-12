import { useSpaTreatmentPackages } from "@/hooks/useSpaTreatmentPackages";
import { formatDollars, perTreatmentCents, splitPackages, type SpaTreatmentPackage } from "@/lib/spaPackages";
import { AELLA_SCULPT } from "@/lib/aellaSculpt";

// Series copy is chosen by treatment count; names and prices come from the saved packages.
const copyFor = (count: number) => AELLA_SCULPT.series[count <= 4 ? 0 : count <= 6 ? 1 : 2];

type Group = { key: string; title: string; name: string; body: string; recommended: boolean; items: SpaTreatmentPackage[] };

function groupSeries(series: SpaTreatmentPackage[]): Group[] {
  const groups: Group[] = [];
  for (const p of series) {
    const c = copyFor(p.session_count);
    const g = groups.find((x) => x.key === c.name);
    if (g) { g.items.push(p); g.recommended ||= p.is_recommended; continue; }
    groups.push({ key: c.name, title: c.count, name: p.name, body: c.body, recommended: p.is_recommended, items: [p] });
  }
  for (const g of groups) {
    const counts = g.items.map((i) => i.session_count);
    g.title = counts.length > 1 ? `${Math.min(...counts)}–${Math.max(...counts)} Treatments` : `${counts[0]} Treatments`;
  }
  return groups;
}

export function SculptSeries() {
  const { data = [], isLoading } = useSpaTreatmentPackages();
  const { single, series } = splitPackages(data, "aella-sculpt");
  const groups = groupSeries(series);

  return (
    <section id="series" className="scroll-mt-20 border-t border-foreground/10 px-6 py-28 md:px-16 md:py-40">
      <div className="grid gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <p className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground">Treatment series</p>
          <h2 className="mt-5 font-serif text-5xl leading-[1.05] md:text-6xl">Contouring is progressive.</h2>
          <p className="mt-8 leading-relaxed text-muted-foreground">{AELLA_SCULPT.seriesNote}</p>
        </div>
        <div className="md:col-span-8">
          {isLoading && <p className="text-muted-foreground">Loading prices…</p>}
          {single && (
            <div className="grid grid-cols-[1fr_auto] items-baseline gap-6 border-t border-foreground/15 py-8">
              <div>
                <h3 className="font-serif text-2xl md:text-3xl">{single.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">One focused treatment zone, {AELLA_SCULPT.minutes} minutes.</p>
              </div>
              <p className="font-serif text-3xl">{formatDollars(single.price_cents)}</p>
            </div>
          )}
          {groups.map((g) => (
            <div
              key={g.key}
              className={g.recommended ? "my-2 bg-cream px-6 py-10 text-background md:px-10" : "border-t border-foreground/15 py-8"}
            >
              {g.recommended && <p className="mb-4 text-[11px] tracking-[0.35em] uppercase text-background/60">Recommended</p>}
              <p className={`text-[11px] tracking-[0.3em] uppercase ${g.recommended ? "text-background/60" : "text-muted-foreground"}`}>{g.title}</p>
              <h3 className="mt-3 font-serif text-3xl md:text-4xl">The {g.name}</h3>
              <p className={`mt-4 max-w-xl leading-relaxed ${g.recommended ? "text-background/75" : "text-muted-foreground"}`}>{g.body}</p>
              <dl className="mt-8 space-y-3">
                {g.items.map((p) => (
                  <div key={p.id} className="grid grid-cols-[1fr_auto] items-baseline gap-6">
                    <dt className={g.recommended ? "text-background/75" : "text-muted-foreground"}>
                      {p.session_count} treatments · {formatDollars(perTreatmentCents(p))} per treatment
                    </dt>
                    <dd className="font-serif text-3xl">{formatDollars(p.price_cents)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          <div className="border-t border-foreground/15" />
        </div>
      </div>
    </section>
  );
}
