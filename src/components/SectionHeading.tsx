import { cn } from "@/lib/utils";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  className?: string;
  align?: "left" | "center";
  animate?: boolean;
}

export function SectionHeading({ 
  title, 
  subtitle, 
  className, 
  align = "center",
  animate = true 
}: SectionHeadingProps) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.2 });

  return (
    <div 
      ref={animate ? ref : undefined}
      className={cn(
        "mb-12",
        align === "center" ? "text-center" : "text-left",
        animate && "transition-all duration-700 ease-out",
        animate && (isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"),
        className
      )}
    >
      <h2 className="heading-section text-foreground mb-4">{title}</h2>
      {subtitle && (
        <p className={cn(
          "text-muted-foreground max-w-2xl leading-relaxed transition-all duration-500 delay-150",
          align === "center" && "mx-auto",
          animate && (isVisible ? "opacity-100" : "opacity-0")
        )}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
