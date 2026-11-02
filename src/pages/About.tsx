import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import loungeA from "@/assets/membership/lounge.webp.asset.json";

const story = [
  "Storm Wellness Club began with a belief that wellness should be more than a collection of workouts, treatments, or fleeting moments of self-care. It should be an experience that changes the way we feel, live, and connect with ourselves.",
  "But the story behind it is far more personal.",
  "Founded by Storm Durant, Storm Wellness Club is the culmination of more than a decade spent studying human behavior, psychology, physical performance, and the relationship between the mind and body.",
  "For years, strength was measured by how much we could push, how much we could accomplish, and how far we could take our bodies. Until personal experience challenged that definition.",
  "Because you can be physically strong and still feel depleted. You can be disciplined, accomplished, and seemingly healthy, yet feel disconnected from yourself.",
  "That realization became the foundation for something different.",
  "A place where strength and softness could coexist. Where ambition didn’t have to come at the expense of well-being. Where recovery wasn’t an afterthought, but an essential part of the experience.",
  "What followed was years of imagining, designing, questioning, and building something that didn’t quite exist in the way we believed it should.",
  "And the journey was anything but effortless.",
  "Storm Wellness Club was built through extraordinary dedication, difficult decisions, countless setbacks, and an unwavering commitment to a vision that was never simply about opening another fitness facility.",
  "Today, that vision lives within nearly 20,000 square feet of thoughtfully designed space in Livonia, Michigan.",
  "From strength training and Pilates to immersive wet spa experiences, advanced recovery therapies, holistic treatments, and intentional nourishment, every element has a purpose.",
  "Not simply to offer more, but to bring together the things that genuinely contribute to how we feel.",
  "We believe the spaces we inhabit influence us. That our environment can shift our energy, our mindset, and even our relationship with ourselves. It’s why every room has its own mood, every detail has been considered, and every experience is designed to evoke something beyond the physical.",
  "We believe in the power of community, but also the importance of solitude. In working hard, but knowing when to rest. In the science of human performance, but also the deeply human need to feel connected, understood, and cared for.",
  "Above all, we believe wellness is not about becoming someone else. It’s about finding your way back to yourself.",
];

export default function About() {
  return (
    <Layout>
      <SEOHead
        title="About Us"
        description="The story behind Storm Wellness Club, founded by Storm Durant: nearly 20,000 square feet of fitness, wet spa, recovery and nourishment in Livonia, Michigan."
        path="/about"
      />
      <section className="relative bg-primary text-primary-foreground pt-28 lg:pt-24">
        <div className="relative h-[55vh] md:h-[70vh] min-h-[380px] overflow-hidden">
          <img src={loungeA.url} alt="Inside Storm Wellness Club" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/40 to-transparent" />
          <div className="absolute bottom-10 left-0 right-0 px-6 text-center">
            <p className="uppercase tracking-[0.3em] text-xs text-gold-light mb-4">About Storm Wellness Club</p>
            <h1 className="font-serif text-4xl md:text-6xl max-w-3xl mx-auto">Built with intention. Rooted in something deeper.</h1>
          </div>
        </div>
      </section>

      <section className="section-padding bg-background">
        <div className="container mx-auto px-6 max-w-2xl space-y-6 text-lg leading-relaxed text-foreground/85">
          {story.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
          <div className="pt-8 text-center font-serif text-2xl md:text-3xl space-y-2 text-foreground">
            <p>This is what we built.</p>
            <p>This is Storm Wellness Club.</p>
            <p className="italic text-accent pt-4">Come home to yourself.</p>
          </div>
          <div className="pt-8 flex justify-center">
            <Link to="/memberships#tiers">
              <Button variant="gold" size="lg">Explore Memberships</Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
