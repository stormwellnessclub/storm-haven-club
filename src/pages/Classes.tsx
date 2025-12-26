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
    name: "Reformer Sculpt – All Levels",
    type: "pilates",
    isHeated: true,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "6:00 AM",
    day: "Mon, Wed, Fri",
    image: reformerPilates,
    description: "Build strength and improve flexibility with our reformer equipment.",
    icon: CircleDot,
  },
  {
    id: 2,
    name: "Signature Flow Pilates – All Levels",
    type: "pilates",
    isHeated: true,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "7:00 AM",
    day: "Tue, Thu",
    image: reformerPilates2,
    description: "Flowing pilates movements on the reformer for a full-body workout.",
    icon: CircleDot,
  },
  {
    id: 3,
    name: "Reformer Sculpt – Adv/Int",
    type: "pilates",
    isHeated: false,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "8:00 AM",
    day: "Mon-Fri",
    image: pilates,
    description: "Advanced reformer workout for experienced practitioners.",
    icon: CircleDot,
  },
  {
    id: 4,
    name: "Reformer Sculpt – Adv/Int",
    type: "pilates",
    isHeated: true,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "9:00 AM",
    day: "Mon-Fri",
    image: reformerPilates,
    description: "Heated advanced reformer session for deeper stretching.",
    icon: CircleDot,
  },
  {
    id: 5,
    name: "Reformer Sculpt – Adv/Int",
    type: "pilates",
    isHeated: false,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "10:00 AM",
    day: "Mon-Fri",
    image: reformerPilates2,
    description: "Non-heated advanced reformer for strength and control.",
    icon: CircleDot,
  },
  {
    id: 6,
    name: "Pilates Foundations – Beginner",
    type: "pilates",
    isHeated: false,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "11:00 AM",
    day: "Mon-Fri, Sat, Sun",
    image: pilates,
    description: "Perfect for beginners learning reformer fundamentals.",
    icon: CircleDot,
  },
  {
    id: 7,
    name: "Signature Flow Pilates – All Levels",
    type: "pilates",
    isHeated: true,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "4:00 PM",
    day: "Mon-Fri",
    image: reformerPilates,
    description: "Heated flowing pilates for all skill levels.",
    icon: CircleDot,
  },
  {
    id: 8,
    name: "Pilates Flow – All Levels",
    type: "pilates",
    isHeated: false,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "5:00 PM",
    day: "Mon-Fri",
    image: reformerPilates2,
    description: "Non-heated pilates flow for all levels.",
    icon: CircleDot,
  },
  {
    id: 9,
    name: "Reformer Sculpt – Adv/Int",
    type: "pilates",
    isHeated: true,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "6:00 PM",
    day: "Tue",
    image: pilates,
    description: "Evening heated reformer session.",
    icon: CircleDot,
  },
  {
    id: 10,
    name: "Signature Flow Pilates – All Levels",
    type: "pilates",
    isHeated: false,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "7:00 PM",
    day: "Mon-Fri",
    image: reformerPilates,
    description: "Evening non-heated pilates for relaxation.",
    icon: CircleDot,
  },
  // Cycling Classes
  {
    id: 11,
    name: "Cycle",
    type: "cycling",
    isHeated: false,
    instructor: "Instructor",
    duration: "50 min",
    spots: 10,
    time: "6:00 AM",
    day: "Mon-Fri",
    image: cycling,
    description: "Early morning cycling to start your day energized.",
    icon: Bike,
  },
  {
    id: 12,
    name: "Cycle",
    type: "cycling",
    isHeated: false,
    instructor: "Instructor",
    duration: "50 min",
    spots: 10,
    time: "7:00 AM",
    day: "Mon-Fri",
    image: cycling2,
    description: "Morning cycling session with immersive lighting.",
    icon: Bike,
  },
  {
    id: 13,
    name: "Cycle",
    type: "cycling",
    isHeated: false,
    instructor: "Instructor",
    duration: "50 min",
    spots: 10,
    time: "9:00 AM",
    day: "Mon-Fri, Sat, Sun",
    image: cycling,
    description: "Mid-morning cycling for cardio and endurance.",
    icon: Bike,
  },
  {
    id: 14,
    name: "Cycle",
    type: "cycling",
    isHeated: false,
    instructor: "Instructor",
    duration: "50 min",
    spots: 10,
    time: "10:00 AM",
    day: "Mon-Fri",
    image: cycling2,
    description: "Beat-driven cycling that makes cardio fun.",
    icon: Bike,
  },
  {
    id: 15,
    name: "Cycle",
    type: "cycling",
    isHeated: false,
    instructor: "Instructor",
    duration: "50 min",
    spots: 10,
    time: "11:00 AM",
    day: "Sat, Sun",
    image: cycling,
    description: "Weekend cycling session.",
    icon: Bike,
  },
  {
    id: 16,
    name: "Cycle",
    type: "cycling",
    isHeated: false,
    instructor: "Instructor",
    duration: "50 min",
    spots: 10,
    time: "4:00 PM",
    day: "Mon-Fri",
    image: cycling2,
    description: "Afternoon cycling to power through your day.",
    icon: Bike,
  },
  {
    id: 17,
    name: "Cycle",
    type: "cycling",
    isHeated: false,
    instructor: "Instructor",
    duration: "50 min",
    spots: 10,
    time: "5:00 PM",
    day: "Mon-Fri",
    image: cycling,
    description: "After-work cycling session.",
    icon: Bike,
  },
  {
    id: 18,
    name: "Cycle",
    type: "cycling",
    isHeated: false,
    instructor: "Instructor",
    duration: "50 min",
    spots: 10,
    time: "6:00 PM",
    day: "Mon-Fri",
    image: cycling2,
    description: "Evening cycling with high energy.",
    icon: Bike,
  },
  {
    id: 19,
    name: "Cycle",
    type: "cycling",
    isHeated: false,
    instructor: "Instructor",
    duration: "50 min",
    spots: 10,
    time: "8:00 AM",
    day: "Sat, Sun",
    image: cycling,
    description: "Weekend morning cycling.",
    icon: Bike,
  },
  // Aerobics Classes
  {
    id: 20,
    name: "Buns of Steel",
    type: "aerobics",
    isHeated: true,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "8:00 AM",
    day: "Mon, Wed",
    image: aerobicsStudio,
    description: "Heated lower body workout targeting glutes and legs.",
    icon: Zap,
  },
  {
    id: 21,
    name: "Vinyasa Yoga",
    type: "aerobics",
    isHeated: true,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "9:00 AM",
    day: "Mon-Fri",
    image: aerobicsStudio,
    description: "Heated flowing yoga for flexibility and mindfulness.",
    icon: Heart,
  },
  {
    id: 22,
    name: "Mat Pilates",
    type: "aerobics",
    isHeated: true,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "11:00 AM",
    day: "Mon, Wed, Thu, Sat, Sun",
    image: aerobicsStudio,
    description: "Core-focused mat pilates in our heated studio.",
    icon: CircleDot,
  },
  {
    id: 23,
    name: "Bootcamp Glutes",
    type: "aerobics",
    isHeated: false,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "4:00 PM",
    day: "Mon, Wed, Fri",
    image: aerobicsStudio,
    description: "Intense bootcamp workout focused on glutes.",
    icon: Zap,
  },
  {
    id: 24,
    name: "Yoga Sculpt",
    type: "aerobics",
    isHeated: true,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "6:00 PM",
    day: "Wed",
    image: aerobicsStudio,
    description: "Heated yoga with strength training elements.",
    icon: Heart,
  },
  {
    id: 25,
    name: "Bootcamp Full Body",
    type: "aerobics",
    isHeated: false,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "8:00 AM",
    day: "Sat",
    image: aerobicsStudio,
    description: "Full body bootcamp workout for strength and cardio.",
    icon: Zap,
  },
  {
    id: 26,
    name: "Power Flow Yoga",
    type: "aerobics",
    isHeated: true,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "10:00 AM",
    day: "Sat",
    image: aerobicsStudio,
    description: "Dynamic heated yoga for strength and flexibility.",
    icon: Heart,
  },
  {
    id: 27,
    name: "Bootcamp Glutes",
    type: "aerobics",
    isHeated: false,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "8:00 AM",
    day: "Sun",
    image: aerobicsStudio,
    description: "Sunday morning bootcamp targeting glutes.",
    icon: Zap,
  },
  {
    id: 28,
    name: "Core and Tone",
    type: "aerobics",
    isHeated: true,
    instructor: "Instructor",
    duration: "50 min",
    spots: 8,
    time: "10:00 AM",
    day: "Sun",
    image: aerobicsStudio,
    description: "Heated core workout for toning and strength.",
    icon: Sparkles,
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
              <h3 className="font-serif text-xl mb-2">Reformer Pilates</h3>
              <p className="text-muted-foreground text-sm">Premium reformer studio with heated & non-heated class options</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Bike className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="font-serif text-xl mb-2">Cycling</h3>
              <p className="text-muted-foreground text-sm">TechnoGym bikes with immersive lighting & sound system</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-500/10 flex items-center justify-center">
                <Activity className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="font-serif text-xl mb-2">Aerobics</h3>
              <p className="text-muted-foreground text-sm">Versatile studio for yoga, bootcamp, mat pilates & more</p>
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
