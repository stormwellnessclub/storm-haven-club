import { cn } from "@/lib/utils";

/**
 * Typography-led composition used when a collection has no authentic
 * photography yet. Deliberately not a stock or generated image.
 */
const TONES = [
  "bg-primary/10 text-primary",
  "bg-muted text-foreground",
  "bg-secondary text-secondary-foreground",
  "bg-primary/5 text-primary",
  "bg-accent text-accent-foreground",
] as const;

interface CollectionPlateProps {
  name: string;
  tagline?: string | null;
  index?: number;
  className?: string;
  /** Real photography, when it exists, always wins. */
  imageUrl?: string | null;
}

export function CollectionPlate({
  name,
  tagline,
  index = 0,
  className,
  imageUrl,
}: CollectionPlateProps) {
  if (imageUrl) {
    return (
      <div className={cn("overflow-hidden", className)}>
        <img src={imageUrl} alt={name} loading="lazy" className="h-full w-full object-cover" />
      </div>
    );
  }

  const tone = TONES[index % TONES.length];

  return (
    <div
      className={cn(
        "relative flex flex-col justify-end overflow-hidden p-8 md:p-10",
        tone,
        className,
      )}
      aria-hidden="true"
    >
      <span className="absolute inset-x-8 top-8 h-px bg-current opacity-20" />
      <span className="absolute -right-6 -top-10 font-serif text-[9rem] leading-none opacity-[0.07] select-none">
        {name.replace(/^(The|A)\s+/i, "").charAt(0)}
      </span>
      <p className="font-serif text-2xl md:text-3xl leading-tight">{name}</p>
      {tagline && <p className="mt-2 text-sm opacity-70 max-w-sm leading-relaxed">{tagline}</p>}
    </div>
  );
}
