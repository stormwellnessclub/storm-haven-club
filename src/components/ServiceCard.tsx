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
      className={cn("card-luxury overflow-hidden group cursor-pointer", className)}
      onClick={onClick}
    >
      <div className="relative h-48 overflow-hidden">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {badge && (
          <span className="absolute top-4 left-4 px-3 py-1 bg-accent text-accent-foreground text-xs uppercase tracking-wider font-medium">
            {badge}
          </span>
        )}
      </div>
      <div className="p-6">
        <h3 className="font-serif text-xl mb-2">{title}</h3>
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
