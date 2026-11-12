import { Link } from "react-router-dom";
import { AELLA_SCULPT, BODY_LAB } from "@/lib/aellaSculpt";
import bodyLabForm from "@/assets/spa-preview/body-lab-form.jpg.asset.json";

const btn =
  "text-xs tracking-[0.25em] uppercase border border-foreground/50 px-5 py-3 text-foreground hover:bg-foreground hover:text-background transition-colors text-center";

/** Spa preview chapter for Aella Body Lab. Built as a list so more Body Lab treatments can join later. */
export function BodyLabChapter({ index, flip }: { index: number; flip: boolean }) {
  const treatments = [AELLA_SCULPT];
  return (
    <section id="body-lab" className="scroll-mt-20 border-t border-foreground/10">
      <div className="grid md:grid-cols-12">
        <div className={`md:col-span-5 ${flip ? "md:order-2" : ""}`}>
          <img
            src={bodyLabForm.url}
            alt=""
            loading="lazy"
            width={736}
            height={964}
            className="h-[60svh] w-full object-cover object-[50%_30%] md:sticky md:top-0 md:h-[100svh]"
          />
        </div>
        <div className="px-6 py-16 md:col-span-7 md:px-16 md:py-28">
          <p className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground">{String(index + 1).padStart(2, "0")}</p>
          <h2 className="mt-4 font-serif text-5xl md:text-6xl">{BODY_LAB.name}</h2>
          <p className="mt-4 text-muted-foreground">{BODY_LAB.descriptor}</p>
          <ul className="mt-12">
            {treatments.map((t) => (
              <li key={t.name} className="border-t border-foreground/15 py-8">
                <h3 className="font-serif text-3xl md:text-4xl">{t.name}</h3>
                <p className="mt-2 text-[11px] tracking-[0.25em] uppercase text-muted-foreground">{t.subtitle}</p>
                <p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">{t.card}</p>
                <p className="mt-5 text-xs tracking-[0.2em] uppercase text-muted-foreground">{t.minutes} minutes</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/spa/preview/aella-sculpt#book" className={btn}>Book Treatment</Link>
                  <Link to="/spa/preview/aella-sculpt" className={`${btn} border-transparent hover:border-foreground/50 hover:bg-transparent hover:text-foreground`}>Learn More</Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
