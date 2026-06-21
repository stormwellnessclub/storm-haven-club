import smoothie from "@/assets/cafe/pilot-smoothie.jpg";
import bowl from "@/assets/cafe/pilot-bowl.jpg";
import juice from "@/assets/cafe/pilot-juice.jpg";
import chia from "@/assets/cafe/pilot-chia.jpg";

const pilots = [
  { src: smoothie, name: "Banana Chocolate Fudge", category: "Protein Smoothie", price: "$12" },
  { src: bowl, name: "Protein Yogurt Power Bowl", category: "Café Bites", price: "$14" },
  { src: juice, name: "Go Green!", category: "Cold Pressed Juice", price: "$9" },
  { src: chia, name: "Colostrum & Saffron Chia — PB&J", category: "Café Bites", price: "$10" },
];

export function CafeStylePreview() {
  return (
    <section
      className="mb-8 rounded-2xl border border-dashed p-6"
      style={{ borderColor: "#A65D43", background: "#FDFBF7" }}
    >
      <div className="mb-4 flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <p
            className="text-xs uppercase tracking-widest"
            style={{ color: "#A65D43" }}
          >
            Style preview — pilot images
          </p>
          <h2
            className="mt-1 text-2xl font-serif"
            style={{ color: "#2a2420" }}
          >
            Do you like this photography direction?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Four sample dishes generated in one art direction (warm cream backdrop, soft daylight,
            sage accents, neutral ceramic/glass). Approve and we'll generate the rest of the menu in
            this same style, then build the new layout.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {pilots.map((p) => (
          <article
            key={p.name}
            className="overflow-hidden rounded-xl"
            style={{ background: "#EAE6DF" }}
          >
            <div className="aspect-square overflow-hidden">
              <img
                src={p.src}
                alt={p.name}
                width={1024}
                height={1024}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-3">
              <p
                className="text-[10px] uppercase tracking-wider"
                style={{ color: "#87A878" }}
              >
                {p.category}
              </p>
              <h3
                className="mt-0.5 text-sm font-medium leading-tight"
                style={{ color: "#2a2420" }}
              >
                {p.name}
              </h3>
              <p
                className="mt-1 text-sm font-semibold"
                style={{ color: "#A65D43" }}
              >
                {p.price}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
