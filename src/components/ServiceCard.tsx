import { cn } from "@/lib/utils";

interface ServiceCardProps {
  image: string;
  title: string;
  description: string;
  price?: string;
  duration?: string;
  badge?: string;
  className?: string;
  onClick?: () => void;
}

export function ServiceCard({ 
  image, 
  title, 
  description, 
  price, 
  duration,
  badge,
  className,
  onClick 
}: ServiceCardProps) {
  return (
    <div 
      className={cn(
        "card-luxury overflow-hidden group cursor-pointer hover-lift",
        className
      )}
      onClick={onClick}
    >
      <div className="relative h-48 overflow-hidden">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {badge && (
          <span className="absolute top-4 left-4 px-3 py-1 bg-accent text-accent-foreground text-xs uppercase tracking-wider font-medium">
            {badge}
          </span>
        )}
      </div>
      <div className="p-6">
        <h3 className="font-serif text-xl mb-2 group-hover:text-accent transition-colors duration-300">{title}</h3>
        <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{description}</p>
        <div className="flex items-center justify-between">
          {price && (
            <span className="text-accent font-semibold">{price}</span>
          )}
          {duration && (
            <span className="text-muted-foreground text-sm">{duration}</span>
          )}
        </div>
      </div>
    </div>
  );
}
