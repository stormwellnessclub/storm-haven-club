import { useState, useMemo } from "react";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHabits, useCreateHabit, useUpdateHabit, useDeleteHabit, Habit, CreateHabitData } from "@/hooks/useHabits";
import { useHabitLogs, useCreateHabitLog, useDeleteHabitLog } from "@/hooks/useHabitLogs";
import { useHabitStreaks, useHabitStreak } from "@/hooks/useHabitStreaks";
import {
  CheckCircle2,
  Plus,
  Edit2,
  Trash2,
  Flame,
  Calendar,
  TrendingUp,
  Target,
  Loader2,
  Sparkles,
  Trophy,
} from "lucide-react";
import { format, startOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isToday, isPast } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const MOTIVATIONAL_MESSAGES = [
  "Keep up the amazing work!",
  "You're building incredible consistency!",
  "Every day counts - you've got this!",
  "Your dedication is inspiring!",
  "Small steps lead to big changes!",
  "You're creating powerful habits!",
];

export default function Habits() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "month">("month");
  const [formData, setFormData] = useState<CreateHabitData>({
    name: "",
    description: "",
    category: "",
    frequency: "daily",
    target_value: 1,
    unit: "",
  });

  const { data: habits, isLoading } = useHabits();
  const { data: allStreaks } = useHabitStreaks();
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  const deleteHabit = useDeleteHabit();

  const today = startOfToday();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Calculate real statistics
  const stats = useMemo(() => {
    const activeStreaks = allStreaks?.filter(s => s.current_streak > 0).length || 0;
    const totalStreakDays = allStreaks?.reduce((sum, s) => sum + s.current_streak, 0) || 0;
    const longestStreak = allStreaks?.reduce((max, s) => Math.max(max, s.longest_streak), 0) || 0;
    
    return {
      totalHabits: habits?.length || 0,
      activeStreaks,
      totalStreakDays,
      longestStreak,
      completionRate: habits && habits.length > 0 ? (activeStreaks / habits.length) * 100 : 0,
    };
  }, [habits, allStreaks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingHabit) {
        await updateHabit.mutateAsync({ id: editingHabit.id, data: formData });
      } else {
        await createHabit.mutateAsync(formData);
      }
      setShowCreateDialog(false);
      setEditingHabit(null);
      resetForm();
    } catch (error) {
      // Error handled by hook
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "",
      frequency: "daily",
      target_value: 1,
      unit: "",
    });
  };

  const handleEdit = (habit: Habit) => {
    setEditingHabit(habit);
    setFormData({
      name: habit.name,
      description: habit.description || "",
      category: habit.category || "",
      frequency: habit.frequency,
      target_value: habit.target_value,
      unit: habit.unit || "",
    });
    setShowCreateDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this habit? This will also delete all associated logs.")) {
      await deleteHabit.mutateAsync(id);
    }
  };

  const motivationalMessage = MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];

  return (
    <MemberLayout title="Habit Tracker">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="heading-section">Habit Tracker</h2>
            <p className="text-muted-foreground mt-1">
              Build consistency and track your daily habits
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex gap-2 border rounded-md p-1">
              <Button
                variant={viewMode === "week" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("week")}
              >
                Week
              </Button>
              <Button
                variant={viewMode === "month" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("month")}
              >
                Month
              </Button>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingHabit(null); resetForm(); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Habit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingHabit ? "Edit Habit" : "Create New Habit"}</DialogTitle>
                  <DialogDescription>
                    Define a habit you want to track consistently
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Habit Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Drink 8 glasses of water"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description || ""}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Optional description or notes..."
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Input
                        id="category"
                        value={formData.category || ""}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="e.g., Health, Fitness"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="frequency">Frequency</Label>
                      <Select
                        value={formData.frequency}
                        onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="target_value">Target Value</Label>
                      <Input
                        id="target_value"
                        type="number"
                        min="1"
                        value={formData.target_value || 1}
                        onChange={(e) => setFormData({ ...formData, target_value: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit">Unit</Label>
                      <Input
                        id="unit"
                        value={formData.unit || ""}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        placeholder="e.g., times, glasses, min"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowCreateDialog(false);
                        setEditingHabit(null);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createHabit.isPending || updateHabit.isPending}>
                      {createHabit.isPending || updateHabit.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : editingHabit ? (
                        "Update Habit"
                      ) : (
                        "Create Habit"
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Motivational Banner */}
        {stats.activeStreaks > 0 && (
          <Card className="bg-gradient-to-r from-accent/10 to-accent/5 border-accent/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-accent" />
                <div className="flex-1">
                  <p className="font-medium">{motivationalMessage}</p>
                  <p className="text-sm text-muted-foreground">
                    You have {stats.activeStreaks} active streak{stats.activeStreaks !== 1 ? "s" : ""} with {stats.totalStreakDays} total streak days!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-accent" />
                Active Habits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalHabits}</div>
              <p className="text-xs text-muted-foreground mt-1">Habits being tracked</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="h-4 w-4 text-accent" />
                Active Streaks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">{stats.activeStreaks}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.totalStreakDays} total streak days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-accent" />
                Best Streak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.longestStreak}</div>
              <p className="text-xs text-muted-foreground mt-1">Longest streak achieved</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                Completion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.completionRate.toFixed(0)}%</div>
              <Progress value={stats.completionRate} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Habits List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : habits && habits.length > 0 ? (
          <div className="space-y-4">
            {habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                onEdit={handleEdit}
                onDelete={handleDelete}
                monthDays={monthDays}
                weekDays={weekDays}
                viewMode={viewMode}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No habits created yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first habit to start tracking your progress and building consistency!
              </p>
              <Button
                onClick={() => setShowCreateDialog(true)}
                size="lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Habit
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </MemberLayout>
  );
}

// Enhanced Habit Card Component
function HabitCard({
  habit,
  onEdit,
  onDelete,
  monthDays,
  weekDays,
  viewMode,
}: {
  habit: Habit;
  onEdit: (habit: Habit) => void;
  onDelete: (id: string) => void;
  monthDays: Date[];
  weekDays: Date[];
  viewMode: "week" | "month";
}) {
  const today = format(startOfToday(), "yyyy-MM-dd");
  const { data: streak } = useHabitStreak(habit.id);
  const displayDays = viewMode === "week" ? weekDays : monthDays;
  const { data: logs } = useHabitLogs(habit.id, undefined, {
    start: displayDays[0],
    end: displayDays[displayDays.length - 1],
  });
  const createLog = useCreateHabitLog();
  const deleteLog = useDeleteHabitLog();

  const loggedDates = new Set(logs?.map(log => log.logged_date) || []);
  const isLoggedToday = loggedDates.has(today);

  const handleToggleToday = async () => {
    if (isLoggedToday) {
      const todayLog = logs?.find(log => log.logged_date === today);
      if (todayLog) {
        await deleteLog.mutateAsync(todayLog.id);
        toast.success("Habit unchecked");
      }
    } else {
      await createLog.mutateAsync({
        habit_id: habit.id,
        logged_value: habit.target_value || 1,
        logged_date: today,
      });
      toast.success("Great job! Keep it up! 🎉", {
        description: streak && streak.current_streak > 0 
          ? `Your streak is now ${streak.current_streak + 1} days!`
          : "You're starting a new streak!",
      });
    }
  };

  // Calculate completion rate
  const completionRate = logs
    ? (logs.length / displayDays.length) * 100
    : 0;

  // Calculate this week's completion
  const thisWeekLogs = logs?.filter(log => {
    const logDate = parseISO(log.logged_date);
    return logDate >= weekDays[0] && logDate <= weekDays[weekDays.length - 1];
  }).length || 0;
  const weekCompletionRate = (thisWeekLogs / weekDays.length) * 100;

  // Get streak milestone messages
  const getStreakMessage = (streakDays: number) => {
    if (streakDays === 7) return "🔥 1 Week Streak!";
    if (streakDays === 30) return "🏆 30 Days! Incredible!";
    if (streakDays === 60) return "💎 60 Days! You're unstoppable!";
    if (streakDays === 90) return "🌟 90 Days! You've made it a lifestyle!";
    if (streakDays === 100) return "👑 100 Days! Legendary!";
    return null;
  };

  const streakMessage = streak ? getStreakMessage(streak.current_streak) : null;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg">{habit.name}</CardTitle>
              {streak && streak.current_streak > 0 && (
                <Badge className="bg-accent/20 text-accent border-accent/30 animate-pulse">
                  <Flame className="h-3 w-3 mr-1" />
                  {streak.current_streak}
                </Badge>
              )}
            </div>
            {habit.description && (
              <CardDescription className="mt-1">{habit.description}</CardDescription>
            )}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {habit.category && (
                <Badge variant="outline">{habit.category}</Badge>
              )}
              <Badge variant="outline">{habit.frequency}</Badge>
              {streakMessage && (
                <Badge className="bg-success/20 text-success border-success/30">
                  {streakMessage}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => onEdit(habit)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(habit.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Today's Quick Action */}
        <div className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
          isLoggedToday 
            ? "bg-success/10 border-success/30" 
            : "bg-secondary/50 border-border hover:border-accent/50"
        }`}>
          <div className="flex items-center gap-4">
            <Checkbox
              checked={isLoggedToday}
              onCheckedChange={handleToggleToday}
              disabled={createLog.isPending || deleteLog.isPending}
              className="h-5 w-5"
            />
            <div>
              <p className="font-semibold text-base">Complete Today</p>
              <p className="text-sm text-muted-foreground">
                {habit.target_value} {habit.unit || "time(s)"}
              </p>
            </div>
          </div>
          {isLoggedToday && (
            <div className="flex items-center gap-2">
              <Badge className="bg-success text-success-foreground border-success">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Done!
              </Badge>
            </div>
          )}
        </div>

        {/* Completion Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">This {viewMode === "week" ? "Week" : "Month"}</span>
              <span className="font-semibold">{completionRate.toFixed(0)}%</span>
            </div>
            <Progress value={completionRate} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {logs?.length || 0} of {displayDays.length} days
            </p>
          </div>
          {viewMode === "month" && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">This Week</span>
                <span className="font-semibold">{weekCompletionRate.toFixed(0)}%</span>
              </div>
              <Progress value={weekCompletionRate} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {thisWeekLogs} of {weekDays.length} days
              </p>
            </div>
          )}
        </div>

        {/* Calendar/Heat Map View */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">{viewMode === "week" ? "This Week" : "This Month"}</p>
            {viewMode === "month" && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-success/60" />
                  <span>Completed</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-secondary/50" />
                  <span>Missed</span>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {displayDays.map((day) => {
              const dayStr = format(day, "yyyy-MM-dd");
              const isLogged = loggedDates.has(dayStr);
              const isDayToday = isToday(day);
              const isPastDay = isPast(day) && !isDayToday;
              
              return (
                <div
                  key={dayStr}
                  className={`aspect-square rounded-md text-xs flex flex-col items-center justify-center transition-all cursor-pointer hover:scale-110 ${
                    isLogged
                      ? "bg-success text-success-foreground font-semibold shadow-sm"
                      : isDayToday
                      ? "border-2 border-accent bg-accent/10 font-medium"
                      : isPastDay
                      ? "bg-secondary/30 text-muted-foreground"
                      : "bg-secondary/20 text-muted-foreground/60"
                  }`}
                  title={format(day, "EEEE, MMMM d, yyyy") + (isLogged ? " ✓" : "")}
                >
                  {viewMode === "week" ? (
                    <span className="text-[10px]">{format(day, "EEE")}</span>
                  ) : null}
                  <span>{format(day, "d")}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Streak Information */}
        {streak && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Flame className="h-4 w-4 text-accent" />
                <p className="text-sm font-semibold">Current Streak</p>
              </div>
              <p className="text-2xl font-bold text-accent">{streak.current_streak}</p>
              <p className="text-xs text-muted-foreground">days in a row</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-4 w-4 text-accent" />
                <p className="text-sm font-semibold">Best Streak</p>
              </div>
              <p className="text-2xl font-bold">{streak.longest_streak}</p>
              <p className="text-xs text-muted-foreground">all-time record</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
