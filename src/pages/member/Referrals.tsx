import { useState } from "react";
import { MemberLayout } from "@/components/member/MemberLayout";
import { useReferralData } from "@/hooks/useReferralData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Copy, Share2, Gift, Star, Users, Trophy, Zap,
  Snowflake, Dumbbell, Ticket, Coffee, Sparkles, CheckCircle2, Clock, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const REWARDS = [
  { type: "red_light_session", label: "Red Light Therapy Session", points: 1000, icon: Zap },
  { type: "dry_cryo_session", label: "Dry Cryo Session", points: 500, icon: Snowflake },
  { type: "class_credit", label: "1 Class Credit", points: 1000, icon: Dumbbell },
  { type: "guest_pass", label: "1 Guest Pass", points: 500, icon: Ticket },
  { type: "cafe_credit", label: "Cafe Credit ($10)", points: 500, icon: Coffee },
];

const MILESTONES = [
  { count: 3, bonus: 200, label: "3 Referrals" },
  { count: 5, bonus: 500, label: "5 Referrals" },
  { count: 10, bonus: 1000, label: "10 Referrals — Ambassador 🏆" },
];

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-yellow-500", label: "Pending" },
  signed_up: { icon: Users, color: "text-blue-500", label: "Signed Up" },
  active: { icon: CheckCircle2, color: "text-green-500", label: "Active ✓" },
  expired: { icon: XCircle, color: "text-muted-foreground", label: "Expired" },
};

export default function Referrals() {
  const {
    referralCode, codeLoading, referrals, referralsLoading,
    transactions, transactionsLoading, submitReferral, redeemPoints,
    pointsBalance, successfulReferrals,
  } = useReferralData();

  const [referFirstName, setReferFirstName] = useState("");
  const [referLastName, setReferLastName] = useState("");
  const [referEmail, setReferEmail] = useState("");

  const shareUrl = referralCode
    ? `${window.location.origin}/join?ref=${referralCode}`
    : "";

  const handleCopyCode = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode);
      toast.success("Referral code copied!");
    }
  };

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Referral link copied!");
    }
  };

  const handleSubmitReferral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!referFirstName.trim() || !referLastName.trim() || !referEmail.trim()) return;
    submitReferral.mutate(
      { firstName: referFirstName, lastName: referLastName, email: referEmail },
      { onSuccess: () => { setReferFirstName(""); setReferLastName(""); setReferEmail(""); } }
    );
  };

  return (
    <MemberLayout title="Refer a Friend">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Premium Intro Banner */}
        <Card className="border-primary/10 bg-gradient-to-br from-card to-muted/30">
          <CardContent className="pt-8 pb-8 px-6 sm:px-10">
            <h2 className="text-lg font-semibold tracking-tight mb-4">Private Introductions</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed max-w-2xl">
              <p>
                Storm Wellness Club grows thoughtfully through the introductions of its members.
              </p>
              <p>
                As an invite-only community, our members play an important role in shaping the culture of the space. We look to those within the club to introduce individuals who share the same appreciation for wellness, calm environments, and intentional living that define the Storm experience.
              </p>
              <p>
                If there is someone in your life who you believe would genuinely align with the spirit of the club, you are welcome to extend a private introduction through the referral portal.
              </p>
              <p className="text-foreground/80 font-medium">
                As a gesture of appreciation, members receive referral points when a referred guest applies and is approved for membership.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Points Balance */}
        <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center">
                  <Star className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Your Referral Points</p>
                  <p className="text-4xl font-bold text-primary">{pointsBalance.toLocaleString()}</p>
                </div>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-sm text-muted-foreground">Successful Referrals</p>
                <p className="text-2xl font-semibold">{successfulReferrals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral Code + Share */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Your Referral Code
            </CardTitle>
            <CardDescription>Extend a private introduction to someone who shares the Storm ethos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-md px-4 py-3 font-mono text-lg text-center tracking-wider">
                {codeLoading ? "Loading..." : referralCode ?? "—"}
              </div>
              <Button variant="outline" size="icon" aria-label="Copy referral code" onClick={handleCopyCode} disabled={!referralCode}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" aria-label="Share referral link" onClick={handleCopyLink} disabled={!referralCode}>
                <Share2 className="h-4 w-4" />
              </Button>
            </div>

            <Separator />

            <form onSubmit={handleSubmitReferral} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  type="text"
                  placeholder="First Name"
                  value={referFirstName}
                  onChange={(e) => setReferFirstName(e.target.value)}
                  required
                />
                <Input
                  type="text"
                  placeholder="Last Name"
                  value={referLastName}
                  onChange={(e) => setReferLastName(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Email address"
                  value={referEmail}
                  onChange={(e) => setReferEmail(e.target.value)}
                  className="flex-1"
                  required
                />
                <Button type="submit" disabled={submitReferral.isPending || !referFirstName.trim() || !referLastName.trim() || !referEmail.trim()}>
                  {submitReferral.isPending ? "Sending..." : "Refer"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Milestone Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Milestone Bonuses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {MILESTONES.map((m) => {
              const achieved = successfulReferrals >= m.count;
              const progress = Math.min((successfulReferrals / m.count) * 100, 100);
              return (
                <div key={m.count} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className={achieved ? "text-primary font-medium" : "text-muted-foreground"}>
                      {achieved ? "✅ " : ""}{m.label}
                    </span>
                    <Badge variant={achieved ? "default" : "secondary"}>+{m.bonus} pts</Badge>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Rewards Catalog */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Redeem Rewards
            </CardTitle>
            <CardDescription>Exchange your points for club services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {REWARDS.map((reward) => {
                const canAfford = pointsBalance >= reward.points;
                const isProvisionable = reward.type !== "cafe_credit";
                return (
                  <div
                    key={reward.type}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <reward.icon className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{reward.label}</p>
                        <p className="text-xs text-muted-foreground">{reward.points} pts</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={canAfford ? "default" : "secondary"}
                      disabled={!canAfford || redeemPoints.isPending || !isProvisionable}
                      onClick={() => redeemPoints.mutate({ rewardType: reward.type, pointsCost: reward.points })}
                    >
                      {!isProvisionable ? "Coming Soon" : "Redeem"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Referral History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Referral History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {referralsLoading ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : referrals.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">No referrals yet. Share your code to get started!</p>
            ) : (
              <div className="space-y-3">
                {referrals.map((r) => {
                  const cfg = statusConfig[r.status] || statusConfig.pending;
                  return (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                        <div>
                          <p className="text-sm font-medium">
                            {r.referred_first_name && r.referred_last_name
                              ? `${r.referred_first_name} ${r.referred_last_name}`
                              : r.referred_email}
                          </p>
                          {r.referred_first_name && (
                            <p className="text-xs text-muted-foreground">{r.referred_email}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(r.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={r.status === "active" ? "default" : "secondary"} className="text-xs">
                          {cfg.label}
                        </Badge>
                        {r.points_awarded > 0 && (
                          <p className="text-xs text-primary font-medium mt-1">+{r.points_awarded} pts</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Points Transaction History */}
        {transactions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Points History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {transactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                    <div>
                      <p>{t.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(t.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <span className={t.points > 0 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                      {t.points > 0 ? "+" : ""}{t.points}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MemberLayout>
  );
}
