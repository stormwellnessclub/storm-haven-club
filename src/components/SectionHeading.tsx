import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  className?: string;
  align?: "left" | "center";
}

export function SectionHeading({ title, subtitle, className, align = "center" }: SectionHeadingProps) {
  return (
    <div className={cn(
      "mb-12",
      align === "center" ? "text-center" : "text-left",
      className
    )}>
      <h2 className="heading-section text-foreground mb-4">{title}</h2>
      {subtitle && (
        <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
