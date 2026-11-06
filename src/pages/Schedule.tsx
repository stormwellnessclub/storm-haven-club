import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/Layout";
import ClassPasses from "@/pages/ClassPasses";
import { useScrollToHash } from "@/pages/StormShop";
import { ScheduleBrowser } from "@/components/booking/ScheduleBrowser";
import { buildBreadcrumbLd, buildServiceLd } from "@/lib/seo/schemas";

export default function Schedule() {
  useScrollToHash();
  return (
    <Layout>
      <SEOHead
        title="Reformer Pilates & Cycling Class Schedule in Livonia, MI"
        description="See this week's Reformer Pilates, cycling and aerobics classes in Livonia, MI. Small coached classes, book online — no membership required."
        path="/schedule"
        image="/og/og-classes.jpg"
        imageAlt="Reformer Pilates studio at Storm Wellness Club in Livonia, Michigan"
        jsonLd={[
          buildBreadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Class Schedule", path: "/schedule" },
          ]),
          buildServiceLd({
            name: "Group Fitness Classes",
            serviceType: "Fitness Classes",
            description:
              "Reformer Pilates (8 max), Indoor Cycling (10 max) and aerobics classes at Storm Wellness Club in Livonia, Michigan. Open to members and class-pass holders.",
            path: "/schedule",
          }),
        ]}
      />

      <section className="pt-32 pb-10 bg-background">
        <div className="container mx-auto px-6 md:px-12">
          <div className="max-w-2xl">
            <p className="ed-caption text-muted-foreground">Class Schedule</p>
            <h1 className="ed-headline mt-6">Find your class.</h1>
            <p className="ed-body text-muted-foreground mt-6">
              Reformer Pilates, cycling and aerobics in small, coached classes. You don’t need to be a member — new here? Add a single class as you reserve your spot.
            </p>
            <p className="ed-caption text-muted-foreground mt-6">Grip socks required for every class.</p>
          </div>
        </div>
      </section>

      <ScheduleBrowser />
      <ClassPasses embedded />
    </Layout>
  );
}
