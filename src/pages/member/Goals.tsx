import { useState } from "react";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useMemberGoals,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  MemberGoal,
  CreateGoalData,
} from "@/hooks/useMemberGoals";
import { useGoalMilestones, useCreateMilestone } from "@/hooks/useGoalMilestones";
import { useGoalProgress, useLogGoalProgress } from "@/hooks/useGoalProgress";
import {
  Target,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  TrendingUp,
  Calendar,
  Loader2,
  Award,
} from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const GOAL_TYPES = [
  "Weight Loss",
  "Weight Gain",
  "Muscle Gain",
  "Endurance",
  "Flexibility",
  "Strength",
  "Cardio Fitness",
  "Body Fat Percentage",
  "Custom",
];

export default function Goals() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [editingGoal, setEditingGoal] = useState<MemberGoal | null>(null);
  const [formData, setFormData] = useState<CreateGoalData>({
    goal_type: "",
    title: "",
    description: "",
    target_value: undefined,
    current_value: 0,
    unit: "",
    start_date: new Date().toISOString().split("T")[0],
    target_date: undefined,
  });

  const { data: goals, isLoading } = useMemberGoals(undefined, statusFilter);
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingGoal) {
        await updateGoal.mutateAsync({ id: editingGoal.id, data: formData });
      } else {
        await createGoal.mutateAsync(formData);
      }
      setShowCreateDialog(false);
      setEditingGoal(null);
      resetForm();
    } catch (error) {
      // Error handled by hook
    }
  };

  const resetForm = () => {
    setFormData({
      goal_type: "",
      title: "",
      description: "",
      target_value: undefined,
      current_value: 0,
      unit: "",
      start_date: new Date().toISOString().split("T")[0],
      target_date: undefined,
    });
  };

  const handleEdit = (goal: MemberGoal) => {
    setEditingGoal(goal);
    setFormData({
      goal_type: goal.goal_type,
      title: goal.title,
      description: goal.description || "",
      target_value: goal.target_value || undefined,
      current_value: goal.current_value,
      unit: goal.unit || "",
      start_date: goal.start_date,
      target_date: goal.target_date || undefined,
    });
    setShowCreateDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this goal?")) {
      await deleteGoal.mutateAsync(id);
    }
  };

  const activeGoals = goals?.filter(g => g.status === "active") || [];
  const completedGoals = goals?.filter(g => g.status === "completed") || [];

  return (
    <MemberLayout title="Goals">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="heading-section">Goals</h2>
            <p className="text-muted-foreground mt-1">
              Set and track your fitness and wellness goals
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingGoal(null); resetForm(); }}>
                <Plus className="h-4 w-4 mr-2" />
                Create Goal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingGoal ? "Edit Goal" : "Create New Goal"}</DialogTitle>
                <DialogDescription>
                  Define a specific, measurable goal to work towards
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="goal_type">Goal Type *</Label>
                  <Select
                    value={formData.goal_type}
                    onValueChange={(value) => setFormData({ ...formData, goal_type: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select goal type" />
                    </SelectTrigger>
                    <SelectContent>
                      {GOAL_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Goal Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Lose 10 pounds"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description..."
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="current_value">Current Value</Label>
                    <Input
                      id="current_value"
                      type="number"
                      value={formData.current_value || 0}
                      onChange={(e) => setFormData({ ...formData, current_value: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target_value">Target Value *</Label>
                    <Input
                      id="target_value"
                      type="number"
                      value={formData.target_value || ""}
                      onChange={(e) => setFormData({ ...formData, target_value: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="100"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Input
                      id="unit"
                      value={formData.unit || ""}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="e.g., lbs, kg, reps, miles"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target_date">Target Date</Label>
                    <Input
                      id="target_date"
                      type="date"
                      value={formData.target_date || ""}
                      onChange={(e) => setFormData({ ...formData, target_date: e.target.value || undefined })}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateDialog(false);
                      setEditingGoal(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createGoal.isPending || updateGoal.isPending}>
                    {createGoal.isPending || updateGoal.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : editingGoal ? (
                      "Update Goal"
                    ) : (
                      "Create Goal"
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
              <CardTitle className="text-base">Active Goals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeGoals.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Goals in progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedGoals.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Goals achieved</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Total Goals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{goals?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>
        </div>

        {/* Goals List */}
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">Active ({activeGoals.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedGoals.length})</TabsTrigger>
            <TabsTrigger value="all">All ({goals?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : activeGoals.length > 0 ? (
              <div className="space-y-4">
                {activeGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No active goals</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create your first goal to start tracking your progress!
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setShowCreateDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Goal
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : completedGoals.length > 0 ? (
              <div className="space-y-4">
                {completedGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Award className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No completed goals yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete your active goals to see them here!
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="all">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : goals && goals.length > 0 ? (
              <div className="space-y-4">
                {goals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No goals created yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setShowCreateDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Goal
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MemberLayout>
  );
}

// Goal Card Component
function GoalCard({
  goal,
  onEdit,
  onDelete,
}: {
  goal: MemberGoal;
  onEdit: (goal: MemberGoal) => void;
  onDelete: (id: string) => void;
}) {
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [progressValue, setProgressValue] = useState("");
  const { data: milestones } = useGoalMilestones(goal.id);
  const { data: progressLogs } = useGoalProgress(goal.id);
  const logProgress = useLogGoalProgress();
  const updateGoal = useUpdateGoal();

  const progress = goal.target_value && goal.target_value > 0
    ? (goal.current_value / goal.target_value) * 100
    : 0;

  const handleUpdateProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(progressValue);
    if (isNaN(value)) return;

    try {
      await logProgress.mutateAsync({
        goal_id: goal.id,
        progress_value: value,
        notes: "",
      });
      // Progress update will trigger goal update via trigger
      setShowProgressDialog(false);
      setProgressValue("");
    } catch (error) {
      // Error handled by hook
    }
  };

  const achievedMilestones = milestones?.filter(m => m.achieved_at) || [];
  const upcomingMilestones = milestones?.filter(m => !m.achieved_at) || [];

  return (
    <Card className={goal.status === "completed" ? "border-success/50 bg-success/5" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              {goal.status === "completed" && (
                <CheckCircle2 className="h-5 w-5 text-success" />
              )}
              {goal.title}
            </CardTitle>
            <CardDescription className="mt-1">
              {goal.goal_type}
              {goal.description && ` • ${goal.description}`}
            </CardDescription>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={goal.status === "completed" ? "default" : "outline"}>
                {goal.status}
              </Badge>
              {goal.target_date && (
                <Badge variant="outline">
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(new Date(goal.target_date), "MMM d, yyyy")}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => onEdit(goal)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(goal.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="text-sm font-medium">
                {goal.current_value} {goal.unit || ""}
              </span>
              <span className="text-sm text-muted-foreground">
                {" / "}
                {goal.target_value} {goal.unit || ""}
              </span>
            </div>
            <span className="text-sm font-medium">{Math.min(progress, 100).toFixed(0)}%</span>
          </div>
          <Progress value={Math.min(progress, 100)} className="h-3" />
        </div>

        {/* Update Progress Button */}
        {goal.status === "active" && (
          <Dialog open={showProgressDialog} onOpenChange={setShowProgressDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <TrendingUp className="h-4 w-4 mr-2" />
                Update Progress
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Goal Progress</DialogTitle>
                <DialogDescription>
                  Enter your current progress value
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateProgress} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="progress_value">Current Value</Label>
                  <Input
                    id="progress_value"
                    type="number"
                    value={progressValue}
                    onChange={(e) => setProgressValue(e.target.value)}
                    placeholder={goal.current_value.toString()}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Target: {goal.target_value} {goal.unit || ""}
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowProgressDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={logProgress.isPending}>
                    {logProgress.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Milestones */}
        {milestones && milestones.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Milestones</p>
            <div className="space-y-2">
              {milestones.slice(0, 3).map((milestone) => {
                const isAchieved = !!milestone.achieved_at;
                return (
                  <div
                    key={milestone.id}
                    className="flex items-center justify-between p-2 bg-secondary/50 rounded text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {isAchieved ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                      )}
                      <span className={isAchieved ? "line-through text-muted-foreground" : ""}>
                        {milestone.milestone_label || `${milestone.milestone_value} ${goal.unit || ""}`}
                      </span>
                    </div>
                    {milestone.achieved_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(milestone.achieved_at), "MMM d")}
                      </span>
                    )}
                  </div>
                );
              })}
              {milestones.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{milestones.length - 3} more milestone{milestones.length - 3 !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

