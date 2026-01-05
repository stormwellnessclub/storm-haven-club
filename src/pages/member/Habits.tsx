import { useState } from "react";
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
} from "lucide-react";
import { format, startOfToday, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function Habits() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [formData, setFormData] = useState<CreateHabitData>({
    name: "",
    description: "",
    category: "",
    frequency: "daily",
    target_value: 1,
    unit: "",
  });

  const { data: habits, isLoading } = useHabits();
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  const deleteHabit = useDeleteHabit();
  const createLog = useCreateHabitLog();
  const deleteLog = useDeleteHabitLog();

  const today = startOfToday();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Calculate statistics
  const stats = {
    totalHabits: habits?.length || 0,
    activeStreaks: 0,
    totalLogs: 0,
  };

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

  return (
    <MemberLayout title="Habit Tracker">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="heading-section">Habit Tracker</h2>
            <p className="text-muted-foreground mt-1">
              Build consistency and track your daily habits
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingHabit(null); resetForm(); }}>
                <Plus className="h-4 w-4 mr-2" />
                Create Habit
              </Button>
            </DialogTrigger>
            <DialogContent>
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

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Active Habits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalHabits}</div>
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
              <div className="text-2xl font-bold">{stats.activeStreaks}</div>
              <p className="text-xs text-muted-foreground mt-1">Current streaks</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {habits && habits.length > 0 ? "—" : "0"}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>
        </div>

        {/* Habits List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
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
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Target className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No habits created yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first habit to start tracking your progress!
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Habit
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </MemberLayout>
  );
}

// Habit Card Component
function HabitCard({
  habit,
  onEdit,
  onDelete,
  monthDays,
}: {
  habit: Habit;
  onEdit: (habit: Habit) => void;
  onDelete: (id: string) => void;
  monthDays: Date[];
}) {
  const today = format(startOfToday(), "yyyy-MM-dd");
  const { data: streak } = useHabitStreak(habit.id);
  const { data: monthLogs } = useHabitLogs(habit.id, undefined, {
    start: monthDays[0],
    end: monthDays[monthDays.length - 1],
  });
  const createLog = useCreateHabitLog();
  const deleteLog = useDeleteHabitLog();

  const loggedDates = new Set(monthLogs?.map(log => log.logged_date) || []);
  const isLoggedToday = loggedDates.has(today);

  const handleToggleToday = async () => {
    if (isLoggedToday) {
      const todayLog = monthLogs?.find(log => log.logged_date === today);
      if (todayLog) {
        await deleteLog.mutateAsync(todayLog.id);
      }
    } else {
      await createLog.mutateAsync({
        habit_id: habit.id,
        logged_value: habit.target_value || 1,
        logged_date: today,
      });
    }
  };

  // Calculate completion rate for this month
  const completionRate = monthLogs
    ? (monthLogs.length / monthDays.length) * 100
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">{habit.name}</CardTitle>
            {habit.description && (
              <CardDescription className="mt-1">{habit.description}</CardDescription>
            )}
            <div className="flex items-center gap-2 mt-2">
              {habit.category && (
                <Badge variant="outline">{habit.category}</Badge>
              )}
              <Badge variant="outline">{habit.frequency}</Badge>
              {streak && streak.current_streak > 0 && (
                <Badge className="bg-accent/20 text-accent border-accent/30">
                  <Flame className="h-3 w-3 mr-1" />
                  {streak.current_streak} day streak
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
      <CardContent className="space-y-4">
        {/* Today's Checkbox */}
        <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={isLoggedToday}
              onCheckedChange={handleToggleToday}
              disabled={createLog.isPending || deleteLog.isPending}
            />
            <div>
              <p className="font-medium">Today</p>
              <p className="text-xs text-muted-foreground">
                {habit.target_value} {habit.unit || "time(s)"}
              </p>
            </div>
          </div>
          {isLoggedToday && (
            <Badge className="bg-success/20 text-success border-success/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Done
            </Badge>
          )}
        </div>

        {/* Completion Rate */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">This Month</span>
            <span className="font-medium">{completionRate.toFixed(0)}%</span>
          </div>
          <Progress value={completionRate} />
          <p className="text-xs text-muted-foreground mt-1">
            {monthLogs?.length || 0} of {monthDays.length} days
          </p>
        </div>

        {/* Calendar View */}
        <div>
          <p className="text-sm font-medium mb-2">This Month</p>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((day) => {
              const dayStr = format(day, "yyyy-MM-dd");
              const isLogged = loggedDates.has(dayStr);
              const isToday = format(today, "yyyy-MM-dd") === dayStr;
              return (
                <div
                  key={dayStr}
                  className={`aspect-square rounded text-xs flex items-center justify-center ${
                    isLogged
                      ? "bg-success text-success-foreground"
                      : isToday
                      ? "border-2 border-accent"
                      : "bg-secondary/30 text-muted-foreground"
                  }`}
                  title={format(day, "MMM d")}
                >
                  {format(day, "d")}
                </div>
              );
            })}
          </div>
        </div>

        {/* Streak Info */}
        {streak && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
            <div>
              <p className="font-medium">Current Streak</p>
              <p className="text-xs text-muted-foreground">{streak.current_streak} days</p>
            </div>
            <div className="text-right">
              <p className="font-medium">Best Streak</p>
              <p className="text-xs text-muted-foreground">{streak.longest_streak} days</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

