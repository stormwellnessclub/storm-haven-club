import { Link } from "react-router-dom";
import { Reveal, EdImage } from "@/components/editorial/Editorial";
import coconutCloud from "@/assets/cafe/smoothie-coconut-cloud.jpg";
import creamsicle from "@/assets/cafe/smoothie-orange-creamsicle.jpg";
import glaze from "@/assets/cafe/smoothie-hailey-bieber.jpg";

const STORAGE = "https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images";
const chiaImg = `${STORAGE}/chia-pudding-v2.jpg`;
const avocadoImg = `${STORAGE}/avocado-toast-v2.jpg`;

const toMenu = () => {
  window.__lovableEvents?.track?.("project.cafe_menu_click", { source: "story" });
  document.getElementById("cafe-menu")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

function Eyebrow({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return <p className={`ed-caption mb-6 ${light ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{children}</p>;
}
function TextLink({ children, light, onClick = toMenu }: { children: React.ReactNode; light?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`group inline-flex items-center gap-3 ed-caption pb-1 border-b transition-colors ${light ? "text-primary-foreground border-primary-foreground/40 hover:border-primary-foreground" : "text-foreground border-foreground/30 hover:border-foreground"}`}>
      {children}<span aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">→</span>
    </button>
  );
}

export function CafeStory() {
  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[100svh] flex items-end bg-charcoal">
        <img src={coconutCloud} alt="Coconut Cloud smoothie at Storm Wellness Café" className="absolute inset-0 h-full w-full object-cover" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/40 to-charcoal/10" />
        <div className="relative z-10 container mx-auto px-6 pb-20 pt-40 md:pb-28">
          <div className="max-w-3xl">
            <p className="ed-caption text-primary-foreground/70 mb-6">Storm Wellness Café</p>
            <h1 className="ed-statement text-primary-foreground mb-8">Good for you should still be something you want.</h1>
            <p className="ed-body text-primary-foreground/80 max-w-xl mb-3">Coffee worth stopping for. Smoothies with a purpose. Food made to satisfy first — with ingredients chosen more thoughtfully.</p>
            <p className="ed-body text-primary-foreground/80 max-w-xl mb-3">Come after a workout. Come before one. Or just come because you wanted the Coconut Cloud.</p>
            <p className="ed-body text-primary-foreground/70 max-w-xl mb-10">Open to the public.</p>
            <div className="flex flex-wrap items-center gap-8">
              <button type="button" onClick={toMenu} className="bg-primary-foreground text-foreground px-8 py-4 ed-caption hover:bg-primary-foreground/90 transition-colors">Explore the Menu</button>
              <TextLink light>Order Ahead</TextLink>
            </div>
          </div>
        </div>
      </section>

      {/* Not the disciplined part */}
      <section className="py-28 md:py-40 bg-background">
        <div className="container mx-auto px-6 grid md:grid-cols-12 gap-12 items-center">
          <EdImage src={creamsicle} alt="Orange Creamsicle smoothie at Storm Wellness Café" className="md:col-span-6 aspect-[4/5]" />
          <Reveal className="md:col-span-5 md:col-start-8">
            <h2 className="ed-headline mb-10">This isn't the part you have to be disciplined about.</h2>
            <div className="ed-body text-muted-foreground space-y-4">
              <p>We care about what goes into it. You should care about how good it tastes.</p>
              <p>Storm Wellness Café was built around food and drinks that can fit into the way you want to live without tasting like a compromise.</p>
              <p className="text-foreground">Functional when it makes sense. Indulgent when it should be. Always something you would order again.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Four worlds */}
      <section className="pb-28 md:pb-40 bg-background">
        <div className="container mx-auto px-6">
          <Reveal>
            <Eyebrow>What are you in the mood for?</Eyebrow>
            <h2 className="ed-headline mb-20">Start with what sounds good.</h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-x-16 gap-y-20 border-t border-border pt-16">
            {[
              { h: "Coffee Bar", t: "I need coffee.", c: "Espresso, iced coffee, and café staples made for the first stop of the morning, the post-class reset, or the coffee you came in specifically to get.", l: "Explore Coffee" },
              { h: "Smoothies", t: "I want something cold.", c: "Creamy. Bright. Fruity. Functional. Our smoothies are built around flavors you would order even if nobody told you they were good for you.", l: "Explore Smoothies" },
              { h: "Bites", t: "I actually need to eat.", c: "Toast, sandwiches, bowls, and café bites made for the moment when a drink is not going to cut it.", l: "Explore Bites" },
              { h: "Energy + Hydration", t: "I need something that does something.", c: "Hydration, energy, and functional drinks for before training, after training, or the part of the afternoon where coffee is no longer the answer.", l: "Explore Energy + Hydration" },
            ].map((w, i) => (
              <Reveal key={w.h} delay={i % 2 ? 150 : 0} className={i % 2 ? "md:mt-24" : ""}>
                <Eyebrow>{w.h}</Eyebrow>
                <h3 className="ed-headline text-3xl md:text-4xl mb-6">{w.t}</h3>
                <p className="ed-body text-muted-foreground mb-8 max-w-md">{w.c}</p>
                <TextLink>{w.l}</TextLink>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Favorites — from actual 90-day sales */}
      <section className="py-28 md:py-40 bg-charcoal text-primary-foreground">
        <div className="container mx-auto px-6">
          <Reveal>
            <Eyebrow light>Café Favorites</Eyebrow>
            <h2 className="ed-headline mb-16">The ones people come back for.</h2>
          </Reveal>
          <div className="grid md:grid-cols-12 gap-12 items-start">
            <EdImage src={glaze} alt="Strawberry Glaze smoothie at Storm Wellness Café" className="md:col-span-5 aspect-[4/5]" />
            <div className="md:col-span-6 md:col-start-7 divide-y divide-primary-foreground/15 border-y border-primary-foreground/15">
              {[
                { n: "Turkey Melt", d: "Hot, pressed and properly melted — the order when a drink isn't going to cut it." },
                { n: "Tuna Melt", d: "The other half of the lunch rotation. Warm, savory and filling." },
                { n: "Strawberry Glaze Smoothie", d: "Strawberry glaze layered with coconut cream — cold, creamy and just sweet enough. Made with collagen, sea moss and hyaluronic acid." },
                { n: "Strawberry Starburst Amino Slushy", d: "Icy, bright and candy-sweet strawberry, with aminos for before or after training." },
              ].map((f) => (
                <Reveal key={f.n} className="py-8">
                  <h3 className="font-serif text-2xl mb-2">{f.n}</h3>
                  <p className="ed-body text-primary-foreground/70">{f.d}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Chia */}
      <section className="py-28 md:py-40 bg-background">
        <div className="container mx-auto px-6 grid md:grid-cols-12 gap-12 items-center">
          <Reveal className="md:col-span-5 order-2 md:order-1">
            <Eyebrow>Chia Pudding</Eyebrow>
            <h2 className="ed-headline text-3xl md:text-4xl mb-8">Not your afterthought chia pudding.</h2>
            <p className="ed-body text-muted-foreground mb-4">Made for texture, flavor, and the kind of toppings that make you forget chia pudding ever had a reputation for being boring.</p>
            <p className="ed-body text-muted-foreground mb-8">Like pistachio cream and fig jam over colostrum and saffron chia — rich, nutty and softly floral.</p>
            <TextLink>See what's on today</TextLink>
          </Reveal>
          <EdImage src={chiaImg} alt="Layered chia pudding at Storm Wellness Café" className="md:col-span-6 md:col-start-7 aspect-[4/5] order-1 md:order-2" />
        </div>
      </section>

      {/* Toast */}
      <section className="pb-28 md:pb-40 bg-background">
        <div className="container mx-auto px-6">
          <EdImage src={avocadoImg} alt="Garden Avocado Toast on sourdough at Storm Wellness Café" className="aspect-[16/10] md:aspect-[21/9]" />
          <Reveal className="grid md:grid-cols-12 gap-10 mt-12">
            <div className="md:col-span-5">
              <Eyebrow>Toast</Eyebrow>
              <h2 className="ed-headline text-3xl md:text-4xl">The kind you need a fork for.</h2>
            </div>
            <div className="md:col-span-5 md:col-start-8">
              <h3 className="ed-caption text-foreground mb-3">Garden Avocado Toast</h3>
              <p className="ed-body text-muted-foreground mb-8">Sourdough layered with avocado, greens, tomato, walnuts and pine nuts, finished with a touch of honey for contrast. Fresh, savory, creamy and just slightly sweet.</p>
              <TextLink>Add to Order</TextLink>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Part of the club */}
      <section className="py-28 md:py-36 bg-secondary/40">
        <Reveal className="container mx-auto px-6 max-w-2xl">
          <h2 className="ed-headline mb-8">Part of the club. Open to everyone.</h2>
          <p className="ed-body text-muted-foreground mb-6">Storm Wellness Café lives inside Storm Wellness Club, but you do not need a membership to come in.</p>
          <p className="ed-body text-foreground mb-10">Stop in for coffee. Meet someone for lunch. Order a smoothie. Pick something up on the way home. Or stay awhile.</p>
          <p className="ed-body text-muted-foreground mb-10">
            The coffee before <Link to="/classes" className="underline underline-offset-4">class</Link>. The smoothie after <Link to="/spa" className="underline underline-offset-4">Spa Aella</Link>. The thing you stop in for even on the days you are not training.
          </p>
          <TextLink>Order Ahead</TextLink>
        </Reveal>
      </section>
    </>
  );
}

export function CafeVisit() {
  return (
    <section className="py-24 bg-background border-t border-border">
      <div className="container mx-auto px-6 grid md:grid-cols-12 gap-10">
        <div className="md:col-span-5">
          <Eyebrow>Visit Storm Wellness Café</Eyebrow>
          <address className="not-italic ed-body">18340 Middlebelt Road<br />Livonia, Michigan</address>
          <p className="ed-body text-muted-foreground mt-4">Open to the public during club hours.</p>
        </div>
        <div className="md:col-span-5 md:col-start-8 flex flex-col items-start gap-6">
          <a href="https://maps.google.com/?q=18340+Middlebelt+Rd+Livonia+MI+48152" target="_blank" rel="noreferrer" className="ed-caption pb-1 border-b border-foreground/30 hover:border-foreground">Directions →</a>
          <TextLink>Order Ahead</TextLink>
        </div>
      </div>
    </section>
  );
}
