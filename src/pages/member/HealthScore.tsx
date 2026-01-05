import { useState } from "react";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHealthScore, useHealthScoreHistory, HealthScoreResult } from "@/hooks/useHealthScore";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  Zap,
  Clock,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";

const PERIODS = [
  { label: "7 Days", value: 7 },
  { label: "30 Days", value: 30 },
  { label: "90 Days", value: 90 },
];

export default function HealthScore() {
  const [period, setPeriod] = useState(30);
  const { data: healthScore, isLoading } = useHealthScore(undefined, period);
  const { data: history, isLoading: historyLoading } = useHealthScoreHistory(undefined, 20);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-accent";
    if (score >= 40) return "text-warning";
    return "text-destructive";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Improvement";
  };

  // Calculate trend
  const trend = history && history.length >= 2
    ? history[0].overall_score - history[1].overall_score
    : 0;

  return (
    <MemberLayout title="Health Score">
      <div className="space-y-6">
        {/* Period Selector */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="heading-section">Health Score</h2>
            <p className="text-muted-foreground mt-1">
              Track your overall wellness and activity levels
            </p>
          </div>
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <Button
                key={p.value}
                variant={period === p.value ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : healthScore ? (
          <>
            {/* Overall Score Card */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Overall Health Score
                </CardTitle>
                <CardDescription>
                  Based on activity, consistency, and goal progress over the last {period} days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center flex-col py-8">
                  <div className="relative">
                    <div className={`text-7xl font-bold ${getScoreColor(healthScore.overall_score)}`}>
                      {healthScore.overall_score}
                    </div>
                    <div className="text-2xl text-muted-foreground absolute -right-16 top-1/2 -translate-y-1/2">
                      / 100
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <Badge variant="outline" className="text-lg">
                      {getScoreLabel(healthScore.overall_score)}
                    </Badge>
                    {trend !== 0 && (
                      <div className={`flex items-center gap-1 ${trend > 0 ? 'text-success' : 'text-destructive'}`}>
                        {trend > 0 ? (
                          <TrendingUp className="h-5 w-5" />
                        ) : (
                          <TrendingDown className="h-5 w-5" />
                        )}
                        <span className="text-sm font-medium">{Math.abs(trend)} points</span>
                      </div>
                    )}
                  </div>
                  <Progress value={healthScore.overall_score} className="mt-6 w-64 h-3" />
                </div>
              </CardContent>
            </Card>

            {/* Score Breakdown */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-accent" />
                    Activity Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${getScoreColor(healthScore.activity_score)}`}>
                    {healthScore.activity_score}
                  </div>
                  <Progress value={healthScore.activity_score} className="mt-3" />
                  <p className="text-xs text-muted-foreground mt-2">
                    Based on classes, spa visits, workouts, and check-ins
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-accent" />
                    Consistency Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${getScoreColor(healthScore.consistency_score)}`}>
                    {healthScore.consistency_score}
                  </div>
                  <Progress value={healthScore.consistency_score} className="mt-3" />
                  <p className="text-xs text-muted-foreground mt-2">
                    Based on frequency of visits (unique active days)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-accent" />
                    Goal Progress Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${getScoreColor(healthScore.goal_progress_score)}`}>
                    {healthScore.goal_progress_score}
                  </div>
                  <Progress value={healthScore.goal_progress_score} className="mt-3" />
                  <p className="text-xs text-muted-foreground mt-2">
                    Based on progress toward your active goals
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Activity Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Activity Breakdown
                </CardTitle>
                <CardDescription>
                  Your activity over the last {period} days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <div className="text-center p-4 bg-secondary/50 rounded-lg">
                    <div className="text-2xl font-bold">{healthScore.activity_counts.classes}</div>
                    <div className="text-sm text-muted-foreground mt-1">Classes</div>
                  </div>
                  <div className="text-center p-4 bg-secondary/50 rounded-lg">
                    <div className="text-2xl font-bold">{healthScore.activity_counts.spa_services}</div>
                    <div className="text-sm text-muted-foreground mt-1">Spa Services</div>
                  </div>
                  <div className="text-center p-4 bg-secondary/50 rounded-lg">
                    <div className="text-2xl font-bold">{healthScore.activity_counts.workouts}</div>
                    <div className="text-sm text-muted-foreground mt-1">Workouts</div>
                  </div>
                  <div className="text-center p-4 bg-secondary/50 rounded-lg">
                    <div className="text-2xl font-bold">{healthScore.activity_counts.check_ins}</div>
                    <div className="text-sm text-muted-foreground mt-1">Check-ins</div>
                  </div>
                  <div className="text-center p-4 bg-secondary/50 rounded-lg">
                    <div className="text-2xl font-bold">{healthScore.activity_counts.unique_days}</div>
                    <div className="text-sm text-muted-foreground mt-1">Active Days</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Score History */}
            {history && history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Score History</CardTitle>
                  <CardDescription>
                    Track how your health score has changed over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {history.slice(0, 10).map((score, idx) => {
                      const prevScore = history[idx + 1];
                      const change = prevScore ? score.overall_score - prevScore.overall_score : 0;
                      return (
                        <div
                          key={score.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`text-2xl font-bold ${getScoreColor(score.overall_score)}`}>
                              {score.overall_score}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {format(new Date(score.period_start), "MMM d")} - {format(new Date(score.period_end), "MMM d, yyyy")}
                              </p>
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                <span>A: {score.activity_score}</span>
                                <span>C: {score.consistency_score}</span>
                                <span>G: {score.goal_progress_score}</span>
                              </div>
                            </div>
                          </div>
                          {change !== 0 && (
                            <div className={`flex items-center gap-1 text-sm ${change > 0 ? 'text-success' : 'text-destructive'}`}>
                              {change > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                              {Math.abs(change)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Activity className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                No health score data available yet. Start booking classes and logging activities to build your score!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MemberLayout>
  );
}

