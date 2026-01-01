import { Link } from "react-router-dom";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserCredits } from "@/hooks/useUserCredits";
import { CreditCard, Ticket, Calendar, AlertCircle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";

export default function MemberCredits() {
  const { data: credits, isLoading } = useUserCredits();

  if (isLoading) {
    return (
      <MemberLayout title="My Credits">
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </MemberLayout>
    );
  }

  const memberCredits = credits?.memberCredits;
  const classPasses = credits?.classPasses || [];
  const membershipType = credits?.membershipType;
  const isDiamondMember = membershipType?.toLowerCase().includes("diamond");

  const pilatesCyclingPasses = classPasses.filter(p => p.category === "pilates_cycling");
  const otherPasses = classPasses.filter(p => p.category === "other");

  return (
    <MemberLayout title="My Credits">
      <div className="space-y-6">
        {/* Monthly Member Credits */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-accent" />
                <CardTitle>Monthly Member Credits</CardTitle>
              </div>
              {memberCredits && (
                <Badge variant="outline">
                  Expires {format(parseISO(memberCredits.expires_at), "MMM d, yyyy")}
                </Badge>
              )}
            </div>
            <CardDescription>
              Credits included with your membership that reset monthly
            </CardDescription>
          </CardHeader>
          <CardContent>
            {memberCredits ? (
              <div className="space-y-4">
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold">{memberCredits.credits_remaining}</span>
                  <span className="text-muted-foreground mb-1">
                    of {memberCredits.credits_total} credits remaining
                  </span>
                </div>
                <Progress 
                  value={(memberCredits.credits_remaining / memberCredits.credits_total) * 100} 
                  className="h-3"
                />
                <p className="text-sm text-muted-foreground">
                  Use your monthly credits for any class at Storm Wellness
                </p>
              </div>
            ) : credits?.isMember && isDiamondMember ? (
              <div className="text-center py-6">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Your monthly credits will be available at the start of your next billing cycle
                </p>
              </div>
            ) : credits?.isMember ? (
              <div className="text-center py-6">
                <CreditCard className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">
                  Monthly class credits are included only with Diamond membership
                </p>
                <p className="text-sm text-muted-foreground">
                  You can purchase class passes below to book classes
                </p>
              </div>
            ) : (
              <div className="text-center py-6">
                <CreditCard className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">
                  Monthly credits are included with Diamond membership
                </p>
                <Button asChild variant="outline">
                  <Link to="/apply">Apply for Membership</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Class Passes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-accent" />
              <h2 className="text-xl font-semibold">Class Passes</h2>
            </div>
            <Button asChild variant="outline">
              <Link to="/class-passes">Buy More Passes</Link>
            </Button>
          </div>

          {classPasses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Ticket className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">
                  You don't have any active class passes
                </p>
                <Button asChild>
                  <Link to="/class-passes">Purchase Class Passes</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Pilates & Cycling Passes */}
              {pilatesCyclingPasses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Pilates & Cycling</CardTitle>
                    <CardDescription>
                      Valid for Reformer Pilates and Cycling classes
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {pilatesCyclingPasses.map((pass) => (
                      <PassCard key={pass.id} pass={pass} />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Other Class Passes */}
              {otherPasses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Other Classes</CardTitle>
                    <CardDescription>
                      Valid for yoga, strength, and other fitness classes
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {otherPasses.map((pass) => (
                      <PassCard key={pass.id} pass={pass} />
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </MemberLayout>
  );
}

interface PassCardProps {
  pass: {
    id: string;
    pass_type: string;
    classes_remaining: number;
    classes_total: number;
    expires_at: string;
    is_member_price: boolean;
  };
}

function PassCard({ pass }: PassCardProps) {
  const expiresDate = parseISO(pass.expires_at);
  const daysUntilExpiry = differenceInDays(expiresDate, new Date());
  const isExpiringSoon = daysUntilExpiry <= 14;

  return (
    <div className="p-4 rounded-lg bg-secondary/50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">{pass.pass_type}</span>
        {pass.is_member_price && (
          <Badge variant="secondary" className="text-xs">
            Member Rate
          </Badge>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Classes remaining</span>
          <span className="font-semibold">
            {pass.classes_remaining} / {pass.classes_total}
          </span>
        </div>
        <Progress 
          value={(pass.classes_remaining / pass.classes_total) * 100} 
          className="h-2"
        />
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className={isExpiringSoon ? "text-destructive" : "text-muted-foreground"}>
          Expires {format(expiresDate, "MMM d, yyyy")}
          {isExpiringSoon && ` (${daysUntilExpiry} days)`}
        </span>
      </div>
    </div>
  );
}
