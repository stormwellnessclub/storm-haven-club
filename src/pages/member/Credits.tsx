import { Link } from "react-router-dom";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserCredits, MemberCredit } from "@/hooks/useUserCredits";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  CreditCard, 
  Ticket, 
  Calendar, 
  AlertCircle, 
  Zap, 
  Snowflake,
  Sparkles,
  Gift,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { getTierName, CREDIT_TYPE_LABELS, CREDIT_TYPE_DESCRIPTIONS, CreditType } from "@/lib/memberCredits";
import { useState } from "react";

export default function MemberCredits() {
  const { data: credits, isLoading } = useUserCredits();

  if (isLoading) {
    return (
      <MemberLayout title="My Credits">
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </MemberLayout>
    );
  }

  const membershipType = credits?.membershipType;
  const tierName = membershipType ? getTierName(membershipType) : null;
  const classPasses = credits?.classPasses || [];

  // Group passes by display category - pilates_cycling passes go with reformer/cycling
  const pilatesCyclingPasses = classPasses.filter(p => 
    p.category === "reformer" || p.category === "cycling" || p.category === "pilates_cycling"
  );
  const aerobicsPasses = classPasses.filter(p => 
    p.category === "aerobics" || p.category === "other"
  );

  // Determine which credits to show based on tier
  const showClassCredits = tierName === "diamond";
  const showWellnessCredits = tierName && ["gold", "platinum", "diamond"].includes(tierName);

  return (
    <MemberLayout title="My Credits">
      <div className="space-y-6">
        {/* Complimentary Guest Pass Card */}
        {credits?.isMember && (
          credits?.guestPassCredits && credits.guestPassCredits.credits_remaining > 0 ? (
            <GuestPassRegistrationCard
              credit={credits.guestPassCredits}
              memberId={credits.memberId!}
            />
          ) : (
            <Card className="border-accent/30">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-accent" />
                  <CardTitle>Complimentary Guest Pass</CardTitle>
                </div>
                <CardDescription>Invite a guest to experience the club</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6">
                  <Gift className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mb-4">
                    You don't have any guest pass credits right now.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button asChild>
                      <Link to="/guest-pass">Buy a Guest Pass — $60</Link>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Or ask staff about complimentary guest pass credits
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        )}

        {/* Wellness Treatment Credits (Red Light + Dry Cryo) */}
        {showWellnessCredits ? (
          <div className="grid gap-4 md:grid-cols-2">
            <CreditCard3D
              credit={credits?.redLightCredits || null}
              type="red_light"
              icon={<Zap className="h-5 w-5 text-orange-500" />}
              tierName={tierName}
            />
            <CreditCard3D
              credit={credits?.dryCredits || null}
              type="dry_cryo"
              icon={<Snowflake className="h-5 w-5 text-blue-400" />}
              tierName={tierName}
            />
          </div>
        ) : credits?.isMember ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                <CardTitle>Wellness Treatment Credits</CardTitle>
              </div>
              <CardDescription>
                Red Light Therapy and Dry Cryo sessions included with Gold, Platinum, and Diamond memberships
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <Sparkles className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">
                  Upgrade to Gold or higher to unlock monthly wellness treatment credits
                </p>
                <Button asChild variant="outline">
                  <Link to="/memberships">View Membership Tiers</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                <CardTitle>Wellness Treatment Credits</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <Sparkles className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">
                  Monthly wellness treatment credits are included with Gold, Platinum, and Diamond memberships
                </p>
                <Button asChild variant="outline">
                  <Link to="/apply">Apply for Membership</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monthly Class Credits (Diamond only) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-accent" />
                <CardTitle>Monthly Class Credits</CardTitle>
              </div>
              {credits?.classCredits && (
                <Badge variant="outline">
                  {format(parseISO(credits.classCredits.cycle_start), "MMM d")} - {format(parseISO(credits.classCredits.cycle_end), "MMM d")}
                </Badge>
              )}
            </div>
            <CardDescription>
              Credits included with your membership for booking classes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {credits?.classCredits ? (
              <CreditDisplay credit={credits.classCredits} type="class" />
            ) : showClassCredits ? (
              <div className="text-center py-6">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  Your class credits haven't been activated yet
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/member/support">Contact Support</Link>
                </Button>
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
                  Monthly class credits are included with Diamond membership
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
              {/* Pilates & Cycling Studio Passes */}
              {pilatesCyclingPasses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Pilates & Cycling Studio</CardTitle>
                    <CardDescription>
                      Valid for all Reformer Pilates and Cycling classes
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {pilatesCyclingPasses.map((pass) => (
                      <PassCard key={pass.id} pass={pass} />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Aerobics & Other Studio Passes */}
              {aerobicsPasses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Aerobics & Other</CardTitle>
                    <CardDescription>
                      Valid for Yoga, Bootcamp, Stretch and other class types
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {aerobicsPasses.map((pass) => (
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

interface CreditCard3DProps {
  credit: MemberCredit | null;
  type: CreditType;
  icon: React.ReactNode;
  tierName: string | null;
}

function CreditCard3D({ credit, type, icon, tierName }: CreditCard3DProps) {
  if (!credit) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-lg">{CREDIT_TYPE_LABELS[type]}</CardTitle>
          </div>
          <CardDescription>{CREDIT_TYPE_DESCRIPTIONS[type]}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-3">
              Your credits haven't been activated yet
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/member/support">Contact Support</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-lg">{CREDIT_TYPE_LABELS[type]}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {format(parseISO(credit.cycle_start), "MMM d")} - {format(parseISO(credit.cycle_end), "MMM d")}
          </Badge>
        </div>
        <CardDescription>{CREDIT_TYPE_DESCRIPTIONS[type]}</CardDescription>
      </CardHeader>
      <CardContent>
        <CreditDisplay credit={credit} type={type} />
      </CardContent>
    </Card>
  );
}

interface CreditDisplayProps {
  credit: MemberCredit;
  type: CreditType;
}

function CreditDisplay({ credit, type }: CreditDisplayProps) {
  const expiresDate = parseISO(credit.expires_at);
  const daysRemaining = differenceInDays(expiresDate, new Date());
  const isExpiringSoon = daysRemaining <= 7;
  const percentUsed = ((credit.credits_total - credit.credits_remaining) / credit.credits_total) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold">{credit.credits_remaining}</span>
        <span className="text-muted-foreground mb-1">
          of {credit.credits_total} {type === "class" ? "classes" : "sessions"} remaining
        </span>
      </div>
      <Progress 
        value={100 - percentUsed} 
        className="h-3"
      />
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className={isExpiringSoon ? "text-destructive" : "text-muted-foreground"}>
            {daysRemaining} days until renewal
            {isExpiringSoon && " (expiring soon)"}
          </span>
        </div>
      </div>
    </div>
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

interface GuestPassRegistrationCardProps {
  credit: MemberCredit;
  memberId: string;
}

function GuestPassRegistrationCard({ credit, memberId }: GuestPassRegistrationCardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestFirstName.trim() || !guestLastName.trim() || !guestEmail.trim() || !guestPhone.trim() || !visitDate || !user) {
      toast.error("Please fill in all required fields");
      return;
    }
    const fullName = `${guestFirstName.trim()} ${guestLastName.trim()}`;

    setIsSubmitting(true);
    try {
      // Create guest pass record with price_paid: 0
      const { error: guestError } = await (supabase
        .from("guest_passes" as any)
        .insert({
          guest_name: fullName,
          guest_email: guestEmail.trim(),
          phone_number: guestPhone.trim(),
          valid_date: visitDate,
          price_paid: 0,
          status: "active",
          user_id: user.id,
          member_referral: "Complimentary Guest Pass",
          expires_at: new Date(visitDate + "T23:59:59").toISOString(),
        }) as any);

      if (guestError) throw guestError;

      // Deduct the credit
      const { error: creditError } = await (supabase
        .from("member_credits" as any)
        .update({ credits_remaining: credit.credits_remaining - 1 })
        .eq("id", credit.id) as any);

      if (creditError) throw creditError;

      setIsRegistered(true);
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      toast.success("Guest registered successfully!");
    } catch (error: any) {
      console.error("Error registering guest:", error);
      toast.error(error?.message || "Failed to register guest");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isRegistered) {
    return (
      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-accent" />
            <h3 className="text-lg font-semibold mb-1">Guest Registered!</h3>
            <p className="text-muted-foreground">
              Your guest <strong>{guestFirstName} {guestLastName}</strong> is all set for their visit on{" "}
              {format(parseISO(visitDate), "MMMM d, yyyy")}.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const expiresDate = parseISO(credit.expires_at);
  const daysLeft = differenceInDays(expiresDate, new Date());

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-accent" />
          <CardTitle>Complimentary Guest Pass</CardTitle>
        </div>
        <CardDescription>
          You have a free guest pass! Register your guest below to reserve their visit.
          {daysLeft > 0 && (
            <span className="block mt-1 text-xs">
              Expires in {daysLeft} day{daysLeft > 1 ? "s" : ""}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gp-first">First Name *</Label>
              <Input
                id="gp-first"
                placeholder="First name"
                value={guestFirstName}
                onChange={(e) => setGuestFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gp-last">Last Name *</Label>
              <Input
                id="gp-last"
                placeholder="Last name"
                value={guestLastName}
                onChange={(e) => setGuestLastName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gp-email">Email *</Label>
            <Input
              id="gp-email"
              type="email"
              placeholder="guest@email.com"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gp-phone">Phone Number *</Label>
            <Input
              id="gp-phone"
              type="tel"
              placeholder="(555) 555-5555"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gp-date">Visit Date *</Label>
            <Input
              id="gp-date"
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd")}
              required
            />
          </div>
          <Button type="submit" variant="gold" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <Gift className="h-4 w-4" />
                Register Guest
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
