import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useSpaServices } from "@/hooks/useSpaManagement";
import type { SpaPreparation } from "@/lib/aellaSculptForms";

/** Full "Before Your Aella Sculpt Appointment" page (preview only, noindex). Text comes from the service record. */
export default function AellaSculptPreparation() {
  useEffect(() => window.scrollTo(0, 0), []);
  const { data: services = [], isLoading } = useSpaServices();
  const sculpt = services.find((s) => (s as { service_key?: string | null }).service_key === "aella-sculpt");
  const prep = (sculpt as { preparation?: SpaPreparation | null } | undefined)?.preparation ?? null;
  return (
    <Layout>
      <Helmet>
        <title>Preparing for Aella Sculpt</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="dark bg-background text-foreground">
        <section className="px-6 pb-28 pt-36 md:px-16 md:pb-40 md:pt-48">
          <div className="mx-auto max-w-3xl">
            <Link to="/spa/preview/aella-sculpt" className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground hover:text-foreground">Spa Aella · Aella Sculpt</Link>
            {isLoading ? <p className="mt-10 text-sm text-muted-foreground">Loading…</p> : !prep ? (
              <p className="mt-10 text-sm text-muted-foreground">Preparation information isn't available right now. Please contact Spa Aella.</p>
            ) : (
              <>
                <h1 className="mt-6 font-serif text-5xl leading-tight md:text-6xl">{prep.full_title}</h1>
                <div className="mt-16 divide-y divide-foreground/15 border-y border-foreground/15">
                  {prep.full.map((item) => (
                    <div key={item.heading} className="grid gap-3 py-8 md:grid-cols-12 md:gap-10">
                      <h2 className="font-serif text-xl md:col-span-5">{item.heading}</h2>
                      <p className="text-sm leading-relaxed text-foreground/80 md:col-span-7">{item.body}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="mt-16 flex flex-wrap gap-10">
              <Link to="/spa/preview/aella-sculpt#book" className="border-b border-foreground/40 pb-1 text-xs tracking-[0.25em] uppercase hover:border-foreground">Book Treatment</Link>
              <Link to="/spa/preview/aella-sculpt" className="border-b border-foreground/40 pb-1 text-xs tracking-[0.25em] uppercase hover:border-foreground">About Aella Sculpt</Link>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
