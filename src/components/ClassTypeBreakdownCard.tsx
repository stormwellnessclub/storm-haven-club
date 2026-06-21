import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Sparkles, CheckCircle2, Activity } from "lucide-react";
import { useUserClassTypeBreakdown } from "@/hooks/useUserClassTypeBreakdown";
import { useUserClassAchievements } from "@/hooks/useUserClassAchievements";

const TIERS = [1, 5, 10, 25, 50, 100];

function nextTier(count: number): number | null {
  for (const t of TIERS) if (count < t) return t;
  return null;
}

function Ring({
  count,
  next,
  earnedFirst,
}: {
  count: number;
  next: number | null;
  earnedFirst: boolean;
}) {
  const size = 72;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  // progress within current tier band
  const prevTier = next ? (TIERS[TIERS.indexOf(next) - 1] ?? 0) : TIERS[TIERS.length - 1];
  const denom = next ? next - prevTier : 1;
  const numer = next ? count - prevTier : 1;
  const pct = next ? Math.max(0, Math.min(1, numer / denom)) : 1;
  const dash = circ * pct;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          className="text-muted"
          opacity={0.25}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className="text-amber-500 transition-all"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold tabular-nums">{count}</span>
      </div>
      {earnedFirst && (
        <Sparkles className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 text-amber-500 fill-amber-200" />
      )}
    </div>
  );
}

interface Props {
  userId?: string;
}

export function ClassTypeBreakdownCard({ userId }: Props) {
  const { data: entries = [], isLoading } = useUserClassTypeBreakdown(userId);
  const { data: achievements = [] } = useUserClassAchievements(userId);
  const earnedFirstIds = new Set(
    achievements
      .filter((a) => a.achievement_kind === "first_in_type" && a.class_type_id)
      .map((a) => a.class_type_id as string)
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-amber-500" /> Class Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-20 w-20 rounded-full" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <p className="text-sm text-muted-foreground">
              Try a new class type to start a new ring.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/schedule">Browse Schedule</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {entries.map((e) => {
              const next = nextTier(e.count);
              return (
                <div key={e.classTypeId} className="flex flex-col items-center gap-1.5 text-center">
                  <Ring count={e.count} next={next} earnedFirst={earnedFirstIds.has(e.classTypeId)} />
                  <p className="text-xs font-medium leading-tight line-clamp-2">{e.name}</p>
                  {next ? (
                    <p className="text-[10px] text-muted-foreground">next: {next}</p>
                  ) : (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                      <CheckCircle2 className="h-3 w-3" /> maxed
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
