import { useState } from "react";
import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Flame, Snowflake, Dumbbell, Bike, Activity, Clock, Users } from "lucide-react";

import gymArea1 from "@/assets/gym-area-1.jpg";
import gymArea2 from "@/assets/gym-area-2.jpg";
import cyclingStudio from "@/assets/cycling-studio.jpg";

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
}

const classes: ClassItem[] = [
  {
    id: 1,
    name: "Power Reformer",
    type: "pilates",
    isHeated: false,
    instructor: "Sarah M.",
    duration: "55 min",
    spots: 4,
    time: "6:00 AM",
    day: "Mon, Wed, Fri",
    image: gymArea1,
    description: "Build strength and improve flexibility with reformer pilates.",
  },
  {
    id: 2,
    name: "Hot Cycle",
    type: "cycling",
    isHeated: true,
    instructor: "Marcus J.",
    duration: "45 min",
    spots: 8,
    time: "7:00 AM",
    day: "Tue, Thu, Sat",
    image: cyclingStudio,
    description: "High-intensity cycling in our heated studio with premium lighting.",
  },
  {
    id: 3,
    name: "Sunrise Yoga",
    type: "aerobics",
    isHeated: true,
    instructor: "Elena K.",
    duration: "60 min",
    spots: 12,
    time: "6:30 AM",
    day: "Daily",
    image: gymArea2,
    description: "Start your day with heated yoga to improve flexibility and mindfulness.",
  },
  {
    id: 4,
    name: "Core Reform",
    type: "pilates",
    isHeated: false,
    instructor: "Jennifer L.",
    duration: "45 min",
    spots: 6,
    time: "9:00 AM",
    day: "Mon, Wed",
    image: gymArea1,
    description: "Focused core work on the reformer for a stronger center.",
  },
  {
    id: 5,
    name: "Rhythm Ride",
    type: "cycling",
    isHeated: false,
    instructor: "David P.",
    duration: "50 min",
    spots: 10,
    time: "12:00 PM",
    day: "Mon-Fri",
    image: cyclingStudio,
    description: "Beat-driven cycling that makes cardio fun.",
  },
  {
    id: 6,
    name: "HIIT Burn",
    type: "aerobics",
    isHeated: true,
    instructor: "Mike T.",
    duration: "30 min",
    spots: 15,
    time: "5:30 PM",
    day: "Tue, Thu",
    image: gymArea2,
    description: "High-intensity interval training in our heated aerobics studio.",
  },
  {
    id: 7,
    name: "Stretch & Restore",
    type: "pilates",
    isHeated: true,
    instructor: "Anna R.",
    duration: "45 min",
    spots: 8,
    time: "7:00 PM",
    day: "Sun",
    image: gymArea1,
    description: "Heated reformer session focused on deep stretching and recovery.",
  },
  {
    id: 8,
    name: "Power Cycle",
    type: "cycling",
    isHeated: true,
    instructor: "Marcus J.",
    duration: "45 min",
    spots: 6,
    time: "6:00 PM",
    day: "Mon, Wed, Fri",
    image: cyclingStudio,
    description: "Intense heated cycling for maximum calorie burn.",
  },
];

const classTypeIcons = {
  pilates: Dumbbell,
  cycling: Bike,
  aerobics: Activity,
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
            <p className="text-accent text-sm uppercase tracking-widest mb-4">Our Studios</p>
            <h1 className="heading-display mb-6">Class Schedule</h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              From reformer pilates to high-intensity cycling, discover classes designed to 
              challenge and transform. Filter by class type or temperature preference.
            </p>
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
                { value: "all", label: "All Classes" },
                { value: "pilates", label: "Pilates" },
                { value: "cycling", label: "Cycling" },
                { value: "aerobics", label: "Aerobics" },
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setTypeFilter(type.value as ClassType)}
                  className={`filter-badge ${typeFilter === type.value ? "filter-badge-active" : ""}`}
                >
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
              const IconComponent = classTypeIcons[cls.type as keyof typeof classTypeIcons];
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
                          <Snowflake className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center gap-2">
                        <IconComponent className="w-4 h-4 text-primary-foreground" />
                        <span className="text-primary-foreground text-xs uppercase tracking-wider">
                          {cls.type}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <h3 className="font-serif text-xl mb-2">{cls.name}</h3>
                    <p className="text-muted-foreground text-sm mb-4">{cls.description}</p>
                    
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
