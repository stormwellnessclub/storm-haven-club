import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { ScheduleBrowser } from "@/components/booking/ScheduleBrowser";
import { buildBreadcrumbLd, buildServiceLd } from "@/lib/seo/schemas";

export default function Schedule() {
  return (
    <Layout>
      <SEOHead
        title="Reformer Pilates & Cycling Class Schedule in Livonia, MI"
        description="See this week's Reformer Pilates, Indoor Cycling, Yoga and aerobics classes in Livonia, MI. Small groups, book online — class passes available, no membership required."
        path="/schedule"
        jsonLd={[
          buildBreadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Class Schedule", path: "/schedule" },
          ]),
          buildServiceLd({
            name: "Group Fitness Classes",
            serviceType: "Fitness Classes",
            description:
              "Reformer Pilates (8 max), Indoor Cycling (10 max), Yoga and aerobics classes at Storm Wellness Club in Livonia, Michigan. Open to members and class-pass holders.",
            path: "/schedule",
          }),
        ]}
      />

      {/* Hero */}
      <section className="pt-32 pb-12 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <p className="text-accent text-sm uppercase tracking-widest mb-4">Weekly Schedule</p>
            <h1 className="heading-display mb-4">Reformer Pilates & Cycling Class Schedule in Livonia</h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Browse this week's Reformer Pilates, Indoor Cycling, Yoga, and aerobics classes.
              Reformer studio caps at 8 riders and cycling at 10, so every class stays small and
              coached. Sign in to book your spot.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed mt-4">
              New here? Buy a{" "}
              <Link to="/class-passes" className="text-accent underline underline-offset-4">
                class pass
              </Link>{" "}
              or a{" "}
              <Link to="/guest-pass" className="text-accent underline underline-offset-4">
                guest day pass
              </Link>{" "}
              — no membership required. Members can also add{" "}
              <Link to="/personal-training" className="text-accent underline underline-offset-4">
                personal training
              </Link>{" "}
              or recovery at the{" "}
              <Link to="/spa" className="text-accent underline underline-offset-4">
                Aella Spa
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <ScheduleBrowser />
    </Layout>
  );
}
