import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, CreditCard, FileCheck, Clock, ChevronRight, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingTask {
  id: string;
  label: string;
  description: string;
  complete: boolean;
  action?: string;
  actionLabel?: string;
}

interface MemberOnboardingChecklistProps {
  memberName: string;
  membershipType: string;
  hasPaymentMethod: boolean;
  hasMembershipAgreement: boolean;
  hasLiabilityWaiver: boolean;
  isFoundingMember?: boolean;
}

export function MemberOnboardingChecklist({
  memberName,
  membershipType,
  hasPaymentMethod,
  hasMembershipAgreement,
  hasLiabilityWaiver,
  isFoundingMember,
}: MemberOnboardingChecklistProps) {
  const tasks: OnboardingTask[] = [
    {
      id: "payment",
      label: "Add Payment Method",
      description: "Save a card for your membership dues",
      complete: hasPaymentMethod,
      action: "/member/payment-methods",
      actionLabel: hasPaymentMethod ? "Update Card" : "Add Card",
    },
    {
      id: "membership-agreement",
      label: "Sign Membership Agreement",
      description: "Review and sign the membership terms",
      complete: hasMembershipAgreement,
      action: "/member/waivers",
      actionLabel: "Sign Now",
    },
    {
      id: "liability-waiver",
      label: "Sign Liability Waiver",
      description: "Required for facility access",
      complete: hasLiabilityWaiver,
      action: "/member/waivers",
      actionLabel: "Sign Now",
    },
  ];

  const completedCount = tasks.filter((t) => t.complete).length;
  const totalTasks = tasks.length;
  const progressPercent = Math.round((completedCount / totalTasks) * 100);
  const allComplete = completedCount === totalTasks;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Welcome Header */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <PartyPopper className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl">
              Welcome, {memberName}!
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Complete the steps below to finalize your membership setup.
          </p>

          {/* Progress Section */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {completedCount} of {totalTasks} tasks complete
              </span>
              <span className="text-muted-foreground">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Membership Tier Badge */}
          <div className="flex items-center gap-2 pt-2">
            <span className="text-sm text-muted-foreground">Your tier:</span>
            <Badge variant="secondary" className="font-medium">
              {membershipType}
            </Badge>
            {isFoundingMember && (
              <Badge className="bg-accent text-accent-foreground">
                Founding Member
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Task Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Setup Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "flex items-center justify-between p-4 rounded-lg border transition-colors",
                task.complete
                  ? "bg-muted/30 border-muted"
                  : "bg-background border-border hover:border-primary/30"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                    task.complete
                      ? "bg-accent/20 text-accent"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  {task.complete ? (
                    <Check className="h-4 w-4" />
                  ) : task.id === "payment" ? (
                    <CreditCard className="h-4 w-4" />
                  ) : (
                    <FileCheck className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p
                    className={cn(
                      "font-medium",
                      task.complete && "text-muted-foreground line-through"
                    )}
                  >
                    {task.label}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {task.description}
                  </p>
                </div>
              </div>

              {task.action && !task.complete && (
                <Button asChild size="sm" variant="outline">
                  <Link to={task.action}>
                    {task.actionLabel}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              )}

              {task.complete && (
                <Badge
                  variant="outline"
                  className="bg-accent/10 text-accent border-accent/30"
                >
                  Complete
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Status Card */}
      <Card className={cn(
        "border-2",
        allComplete 
          ? "border-accent/50 bg-accent/5" 
          : "border-primary/30 bg-primary/5"
      )}>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Clock className={cn(
              "h-5 w-5",
              allComplete ? "text-accent" : "text-primary"
            )} />
            <div>
              <p className={cn(
                "font-medium",
                allComplete ? "text-accent" : "text-foreground"
              )}>
                {allComplete 
                  ? "All set! Awaiting staff activation" 
                  : "Complete all tasks to proceed"}
              </p>
              <p className="text-sm text-muted-foreground">
                {allComplete
                  ? "Our team will activate your membership once they process your payment."
                  : "Please complete the remaining tasks above to finalize your membership."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
