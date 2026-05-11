import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/Layout";
import { ScheduleBrowser } from "@/components/booking/ScheduleBrowser";

export default function Schedule() {
  return (
    <Layout>
      <SEOHead
        title="Class Schedule"
        description="View the weekly class schedule at Storm Wellness Club. Reformer Pilates, Indoor Cycling, Aerobics, and more."
        path="/schedule"
      />

      {/* Hero */}
      <section className="pt-32 pb-12 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <p className="text-accent text-sm uppercase tracking-widest mb-4">Weekly Schedule</p>
            <h1 className="heading-display mb-4">Class Schedule</h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Browse our weekly class offerings. Sign in to book your spot.
            </p>
          </div>
        </div>
      </section>

      <ScheduleBrowser />
    </Layout>
  );
}
