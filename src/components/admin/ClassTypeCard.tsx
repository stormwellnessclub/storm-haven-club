import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronRight, Plus, Flame, Calendar, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClassTypeCardProps {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  maxCapacity: number;
  isHeated: boolean;
  isSignature?: boolean;
  isActive: boolean;
  scheduleCount: number;
  onAddSchedule?: () => void;
  onToggleHeated?: (isHeated: boolean) => void;
  heatedPending?: boolean;
}

export function ClassTypeCard({
  id,
  name,
  category,
  durationMinutes,
  maxCapacity,
  isHeated,
  isSignature,
  isActive,
  scheduleCount,
  onAddSchedule,
  onToggleHeated,
  heatedPending,
}: ClassTypeCardProps) {

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
        !isActive && "opacity-60"
      )}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <Link 
            to={`/admin/class-types/${id}`}
            className="font-medium hover:underline truncate block"
          >
            {name}
          </Link>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>{durationMinutes} min</span>
            <span>•</span>
            <span>Cap: {maxCapacity}</span>
            {isHeated && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-orange-600">
                  <Flame className="h-3 w-3" />
                  Heated
                </span>
              </>
            )}
            {isSignature && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                  <Crown className="h-3 w-3" />
                  Signature
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{scheduleCount} schedule{scheduleCount !== 1 ? 's' : ''}</span>
        </div>

        {!isActive && (
          <Badge variant="secondary">Inactive</Badge>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAddSchedule?.();
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Schedule
        </Button>

        <Button variant="ghost" size="sm" asChild>
          <Link to={`/admin/class-types/${id}`}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
