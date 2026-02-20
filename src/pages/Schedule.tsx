import { Link } from "react-router-dom";
import { TempClassSchedule } from "@/components/booking/TempClassSchedule";
import { Layout } from "@/components/Layout";
import { ChevronRight } from "lucide-react";

export default function Schedule() {
  return (
    <Layout>
      {/* Hero */}
      <section className="pt-32 pb-6 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <p className="text-accent text-sm uppercase tracking-widest mb-4">Book Your Classes</p>
            <h1 className="heading-display mb-4">Class Schedule</h1>
            <p className="text-muted-foreground text-lg">
              Book your classes up to 3 weeks in advance. Diamond members get 10 included classes per month.
            </p>
            <div className="mt-4">
              <Link to="/class-passes" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                Need passes? View class pass pricing
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="container py-6">
        <TempClassSchedule />
      </div>
    </Layout>
  );
}
