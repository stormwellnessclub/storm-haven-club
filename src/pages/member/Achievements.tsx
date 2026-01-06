import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAchievements, useMemberAchievements, useCheckAchievements } from "@/hooks/useAchievements";
import { useMemberPoints } from "@/hooks/useMemberPoints";
import { Trophy, Medal, Award, Star, CheckCircle2, Lock, Zap } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export default function Achievements() {
  const { data: allAchievements, isLoading: allLoading } = useAchievements();
  const { data: memberAchievements, isLoading: memberLoading } = useMemberAchievements(undefined);
  const { data: memberPoints } = useMemberPoints();
  const checkAchievements = useCheckAchievements();
  const queryClient = useQueryClient();

  const isLoading = allLoading || memberLoading;

  // Create a map of earned achievement IDs
  const earnedIds = new Set(memberAchievements?.map(ma => ma.achievement_id) || []);

  // Separate earned and unearned
  const earned = allAchievements?.filter(a => earnedIds.has(a.id)) || [];
  const unearned = allAchievements?.filter(a => !earnedIds.has(a.id)) || [];

  const handleCheckAchievements = async () => {
    await checkAchievements.mutateAsync(undefined);
    queryClient.invalidateQueries({ queryKey: ["member-achievements"] });
    queryClient.invalidateQueries({ queryKey: ["member-points"] });
  };

  const getAchievementIcon = (points: number) => {
    if (points >= 500) return <Medal className="h-8 w-8 text-gold" />;
    if (points >= 200) return <Award className="h-8 w-8 text-accent" />;
    if (points >= 100) return <Star className="h-8 w-8 text-success" />;
    return <Trophy className="h-8 w-8 text-muted-foreground" />;
  };

  const getEarnedDate = (achievementId: string) => {
    const earned = memberAchievements?.find(ma => ma.achievement_id === achievementId);
    return earned ? format(new Date(earned.earned_at), "MMM d, yyyy") : null;
  };

  return (
    <MemberLayout title="Achievements">
      <div className="space-y-6">
        {/* Header with Points Summary */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="heading-section">Achievements</h2>
            <p className="text-muted-foreground mt-1">
              Unlock achievements by reaching milestones in your wellness journey
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleCheckAchievements}
            disabled={checkAchievements.isPending}
          >
            <Zap className="h-4 w-4 mr-2" />
            Check Achievements
          </Button>
        </div>

        {/* Points Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Total Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{memberPoints?.total_points || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Lifetime points earned</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Medal className="h-4 w-4" />
                Achievements Unlocked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{earned.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                of {allAchievements?.length || 0} available
              </p>
              {allAchievements && allAchievements.length > 0 && (
                <Progress
                  value={(earned.length / allAchievements.length) * 100}
                  className="mt-2"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Current Streak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{memberPoints?.current_streak_days || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">days in a row</p>
            </CardContent>
          </Card>
        </div>

        {/* Achievements List */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All ({allAchievements?.length || 0})</TabsTrigger>
            <TabsTrigger value="earned">Earned ({earned.length})</TabsTrigger>
            <TabsTrigger value="unearned">Locked ({unearned.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allAchievements?.map((achievement) => {
                  const isEarned = earnedIds.has(achievement.id);
                  const earnedDate = getEarnedDate(achievement.id);
                  return (
                    <Card
                      key={achievement.id}
                      className={isEarned ? "border-success/50 bg-success/5" : "opacity-75"}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {isEarned ? (
                              getAchievementIcon(achievement.points_reward)
                            ) : (
                              <Lock className="h-8 w-8 text-muted-foreground" />
                            )}
                            <div className="flex-1">
                              <CardTitle className="text-base">{achievement.name}</CardTitle>
                              {achievement.description && (
                                <CardDescription className="mt-1">
                                  {achievement.description}
                                </CardDescription>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <Badge
                            variant={isEarned ? "default" : "outline"}
                            className={isEarned ? "bg-success/20 text-success border-success/30" : ""}
                          >
                            {isEarned ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Earned
                              </>
                            ) : (
                              "Locked"
                            )}
                          </Badge>
                          <div className="text-sm font-medium">
                            +{achievement.points_reward} pts
                          </div>
                        </div>
                        {isEarned && earnedDate && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Earned on {earnedDate}
                          </p>
                        )}
                        {!isEarned && achievement.criteria && (
                          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                            <p>
                              {achievement.criteria.type === "classes_attended" && "Attend "}
                              {achievement.criteria.type === "spa_services" && "Book "}
                              {achievement.criteria.type === "workouts_logged" && "Log "}
                              {achievement.criteria.type === "check_ins" && "Check in "}
                              {achievement.criteria.type === "streak_days" && "Maintain a "}
                              {achievement.criteria.type === "total_points" && "Earn "}
                              <strong>{achievement.criteria.count}</strong>
                              {achievement.criteria.type === "streak_days" && "-day streak"}
                              {achievement.criteria.type === "total_points" && " total points"}
                              {achievement.criteria.period === "week" && " in a week"}
                              {achievement.criteria.period === "month" && " in a month"}
                              {!achievement.criteria.period && " total"}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="earned">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : earned.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {earned.map((achievement) => {
                  const earnedDate = getEarnedDate(achievement.id);
                  return (
                    <Card
                      key={achievement.id}
                      className="border-success/50 bg-success/5"
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {getAchievementIcon(achievement.points_reward)}
                            <div className="flex-1">
                              <CardTitle className="text-base">{achievement.name}</CardTitle>
                              {achievement.description && (
                                <CardDescription className="mt-1">
                                  {achievement.description}
                                </CardDescription>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <Badge className="bg-success/20 text-success border-success/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Earned
                          </Badge>
                          <div className="text-sm font-medium">
                            +{achievement.points_reward} pts
                          </div>
                        </div>
                        {earnedDate && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Earned on {earnedDate}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Trophy className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No achievements earned yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Start attending classes and logging activities to earn your first achievement!
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="unearned">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : unearned.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {unearned.map((achievement) => (
                  <Card key={achievement.id} className="opacity-75">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Lock className="h-8 w-8 text-muted-foreground" />
                          <div className="flex-1">
                            <CardTitle className="text-base">{achievement.name}</CardTitle>
                            {achievement.description && (
                              <CardDescription className="mt-1">
                                {achievement.description}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Locked</Badge>
                        <div className="text-sm font-medium">
                          +{achievement.points_reward} pts
                        </div>
                      </div>
                      {achievement.criteria && (
                        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                          <p>
                            {achievement.criteria.type === "classes_attended" && "Attend "}
                            {achievement.criteria.type === "spa_services" && "Book "}
                            {achievement.criteria.type === "workouts_logged" && "Log "}
                            {achievement.criteria.type === "check_ins" && "Check in "}
                            {achievement.criteria.type === "streak_days" && "Maintain a "}
                            {achievement.criteria.type === "total_points" && "Earn "}
                            <strong>{achievement.criteria.count}</strong>
                            {achievement.criteria.type === "streak_days" && "-day streak"}
                            {achievement.criteria.type === "total_points" && " total points"}
                            {achievement.criteria.period === "week" && " in a week"}
                            {achievement.criteria.period === "month" && " in a month"}
                            {!achievement.criteria.period && " total"}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Medal className="h-12 w-12 mx-auto mb-3 text-success" />
                  <p className="text-muted-foreground">Congratulations!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You've unlocked all available achievements!
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MemberLayout>
  );
}

