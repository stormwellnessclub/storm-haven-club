import { useState } from "react";
import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { 
  Flame, 
  Snowflake, 
  Clock, 
  Users,
  CircleDot,
  Bike,
  Dumbbell,
  Heart,
  Zap,
  Wind,
  Sparkles,
  Activity
} from "lucide-react";

// Updated images
import reformerPilates from "@/assets/reformer-pilates.jpg";
import reformerPilates2 from "@/assets/reformer-pilates-2.jpg";
import pilates from "@/assets/pilates.jpg";
import cycling from "@/assets/cycling.jpg";
import cycling2 from "@/assets/cycling-2.jpg";
import aerobicsStudio from "@/assets/aerobics-studio.jpg";

type ClassType = "all" | "pilates" | "cycling" | "aerobics";
type HeatFilter = "all" | "heated" | "non-heated";

interface ClassItem {
  id: number;
  name: string;
  type: ClassType;
  isHeated: boolean;
  instructor: string;
  duration: string;
  spots: number;
  time: string;
  day: string;
  image: string;
  description: string;
  icon: typeof Dumbbell;
}

const classes: ClassItem[] = [
  // Reformer Pilates Classes
  {
    id: 1,
    name: "Power Reformer",
    type: "pilates",
    isHeated: false,
    instructor: "Sarah M.",
    duration: "55 min",
    spots: 12,
    time: "6:00 AM",
    day: "Mon, Wed, Fri",
    image: reformerPilates,
    description: "Build strength and improve flexibility with our state-of-the-art reformer equipment.",
    icon: CircleDot,
  },
  {
    id: 2,
    name: "Core Reform",
    type: "pilates",
    isHeated: false,
    instructor: "Jennifer L.",
    duration: "45 min",
    spots: 12,
    time: "9:00 AM",
    day: "Mon, Wed",
    image: reformerPilates2,
    description: "Focused core work on the reformer for a stronger center and better posture.",
    icon: CircleDot,
  },
  {
    id: 3,
    name: "Heated Reformer Flow",
    type: "pilates",
    isHeated: true,
    instructor: "Anna R.",
    duration: "50 min",
    spots: 12,
    time: "7:00 PM",
    day: "Tue, Thu",
    image: pilates,
    description: "Heated reformer session focused on deep stretching and muscle recovery.",
    icon: CircleDot,
  },
  // Cycling Classes
  {
    id: 4,
    name: "Hot Cycle",
    type: "cycling",
    isHeated: true,
    instructor: "Marcus J.",
    duration: "45 min",
    spots: 20,
    time: "7:00 AM",
    day: "Tue, Thu, Sat",
    image: cycling,
    description: "High-intensity cycling in our heated studio with premium TechnoGym bikes.",
    icon: Bike,
  },
  {
    id: 5,
    name: "Rhythm Ride",
    type: "cycling",
    isHeated: false,
    instructor: "David P.",
    duration: "50 min",
    spots: 20,
    time: "12:00 PM",
    day: "Mon-Fri",
    image: cycling2,
    description: "Beat-driven cycling that makes cardio fun with immersive lighting.",
    icon: Bike,
  },
  {
    id: 6,
    name: "Power Cycle",
    type: "cycling",
    isHeated: true,
    instructor: "Marcus J.",
    duration: "45 min",
    spots: 20,
    time: "6:00 PM",
    day: "Mon, Wed, Fri",
    image: cycling,
    description: "Intense heated cycling for maximum calorie burn and endurance.",
    icon: Bike,
  },
  // Aerobics Classes
  {
    id: 7,
    name: "Sunrise Yoga",
    type: "aerobics",
    isHeated: true,
    instructor: "Elena K.",
    duration: "60 min",
    spots: 25,
    time: "6:30 AM",
    day: "Daily",
    image: aerobicsStudio,
    description: "Start your day with heated yoga to improve flexibility and mindfulness.",
    icon: Heart,
  },
  {
    id: 8,
    name: "HIIT Burn",
    type: "aerobics",
    isHeated: true,
    instructor: "Mike T.",
    duration: "30 min",
    spots: 25,
    time: "5:30 PM",
    day: "Tue, Thu",
    image: aerobicsStudio,
    description: "High-intensity interval training in our heated aerobics studio.",
    icon: Zap,
  },
  {
    id: 9,
    name: "Barre Sculpt",
    type: "aerobics",
    isHeated: false,
    instructor: "Lisa M.",
    duration: "55 min",
    spots: 20,
    time: "9:30 AM",
    day: "Mon, Wed, Fri",
    image: aerobicsStudio,
    description: "Ballet-inspired workout to tone and sculpt your entire body.",
    icon: Sparkles,
  },
  {
    id: 10,
    name: "Stretch & Breathe",
    type: "aerobics",
    isHeated: false,
    instructor: "Elena K.",
    duration: "45 min",
    spots: 25,
    time: "8:00 PM",
    day: "Sun",
    image: aerobicsStudio,
    description: "Gentle stretching and breathwork for recovery and relaxation.",
    icon: Wind,
  },
];

const classTypeConfig = {
  pilates: { icon: CircleDot, label: "Reformer Pilates", color: "text-purple-500" },
  cycling: { icon: Bike, label: "Cycling", color: "text-blue-500" },
  aerobics: { icon: Activity, label: "Aerobics", color: "text-rose-500" },
};

export default function Classes() {
  const [typeFilter, setTypeFilter] = useState<ClassType>("all");
  const [heatFilter, setHeatFilter] = useState<HeatFilter>("all");

  const filteredClasses = classes.filter((cls) => {
    const matchesType = typeFilter === "all" || cls.type === typeFilter;
    const matchesHeat =
      heatFilter === "all" ||
      (heatFilter === "heated" && cls.isHeated) ||
      (heatFilter === "non-heated" && !cls.isHeated);
    return matchesType && matchesHeat;
  });

  return (
    <Layout>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <p className="text-accent text-sm uppercase tracking-widest mb-4">Three Distinct Studios</p>
            <h1 className="heading-display mb-6">Class Schedule</h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              From reformer pilates to high-intensity cycling, discover classes designed to 
              challenge and transform. Filter by class type or temperature preference.
            </p>
          </div>
        </div>
      </section>

      {/* Studio Info */}
      <section className="py-12 bg-background border-b border-border">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/10 flex items-center justify-center">
                <CircleDot className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className="font-serif text-xl mb-2">Reformer Pilates Studio</h3>
              <p className="text-muted-foreground text-sm">12 premium reformer machines with heated & non-heated class options</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Bike className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="font-serif text-xl mb-2">Cycling Studio</h3>
              <p className="text-muted-foreground text-sm">20 TechnoGym bikes with immersive lighting & sound system</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-500/10 flex items-center justify-center">
                <Activity className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="font-serif text-xl mb-2">Aerobics Room</h3>
              <p className="text-muted-foreground text-sm">Versatile studio for yoga, HIIT, barre & more</p>
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 bg-background border-b border-border sticky top-20 z-40">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2 self-center">Class Type:</span>
              {[
                { value: "all", label: "All Classes", icon: null },
                { value: "pilates", label: "Reformer Pilates", icon: CircleDot },
                { value: "cycling", label: "Cycling", icon: Bike },
                { value: "aerobics", label: "Aerobics", icon: Activity },
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setTypeFilter(type.value as ClassType)}
                  className={`filter-badge flex items-center gap-1.5 ${typeFilter === type.value ? "filter-badge-active" : ""}`}
                >
                  {type.icon && <type.icon className="w-3.5 h-3.5" />}
                  {type.label}
                </button>
              ))}
            </div>
            
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2 self-center">Temperature:</span>
              {[
                { value: "all", label: "All", icon: null },
                { value: "heated", label: "Heated", icon: Flame },
                { value: "non-heated", label: "Non-Heated", icon: Snowflake },
              ].map((heat) => (
                <button
                  key={heat.value}
                  onClick={() => setHeatFilter(heat.value as HeatFilter)}
                  className={`filter-badge flex items-center gap-1.5 ${heatFilter === heat.value ? "filter-badge-active" : ""}`}
                >
                  {heat.icon && <heat.icon className="w-3.5 h-3.5" />}
                  {heat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Class Grid */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClasses.map((cls) => {
              const typeConfig = classTypeConfig[cls.type as keyof typeof classTypeConfig];
              const ClassIcon = cls.icon;
              return (
                <div key={cls.id} className="card-luxury overflow-hidden group">
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={cls.image}
                      alt={cls.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-hero" />
                    <div className="absolute top-4 left-4 flex gap-2">
                      {cls.isHeated ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-accent text-accent-foreground text-xs uppercase tracking-wider">
                          <Flame className="w-3 h-3" /> Heated
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground text-xs uppercase tracking-wider">
                          <Snowflake className="w-3 h-3" /> Non-Heated
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center gap-2">
                        <ClassIcon className="w-4 h-4 text-primary-foreground" />
                        <span className="text-primary-foreground text-xs uppercase tracking-wider">
                          {typeConfig.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        cls.type === 'pilates' ? 'bg-purple-500/10' : 
                        cls.type === 'cycling' ? 'bg-blue-500/10' : 'bg-rose-500/10'
                      }`}>
                        <ClassIcon className={`w-4 h-4 ${
                          cls.type === 'pilates' ? 'text-purple-500' : 
                          cls.type === 'cycling' ? 'text-blue-500' : 'text-rose-500'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-serif text-xl">{cls.name}</h3>
                        <p className="text-muted-foreground text-sm mt-1">{cls.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {cls.duration}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {cls.spots} spots
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground">Instructor</p>
                        <p className="text-sm font-medium">{cls.instructor}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{cls.day}</p>
                        <p className="text-sm font-medium">{cls.time}</p>
                      </div>
                    </div>
                    
                    <Button variant="outline" className="w-full mt-4">
                      Book Class
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredClasses.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No classes match your filters. Try adjusting your selection.</p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
