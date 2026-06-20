import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Trophy } from "lucide-react";
import {
  useUserClassAchievements,
  useUserClassTotal,
} from "@/hooks/useUserClassAchievements";

interface Props {
  userId?: string;
  compact?: boolean;
}

export function ClassMilestonesCard({ userId, compact }: Props) {
  const { data: achievements = [], isLoading } = useUserClassAchievements(userId);
  const { data: total = 0 } = useUserClassTotal(userId);

  const lifetime = achievements
    .filter((a) => a.achievement_kind === "lifetime_milestone")
    .sort((a, b) => (b.milestone || 0) - (a.milestone || 0));
  const firsts = achievements.filter((a) => a.achievement_kind === "first_in_type");

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-amber-500" /> Class Milestones
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{total}</span>
          <span className="text-sm text-muted-foreground">
            class{total === 1 ? "" : "es"} completed
          </span>
        </div>

        {lifetime.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {lifetime.map((a) => (
              <Badge
                key={a.id}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0"
              >
                🎉 {a.milestone} classes
              </Badge>
            ))}
          </div>
        )}

        {!compact && firsts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">First-time badges</p>
            <div className="flex flex-wrap gap-1.5">
              {firsts.map((a) => (
                <Badge
                  key={a.id}
                  variant="outline"
                  className="border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 gap-1"
                >
                  <Sparkles className="h-3 w-3" /> First {a.class_type_name || "class"}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {total === 0 && (
          <p className="text-sm text-muted-foreground">
            Book your first class to start earning milestones.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
