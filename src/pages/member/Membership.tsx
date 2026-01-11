import { Link } from "react-router-dom";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserMembership, getMembershipTierBenefits } from "@/hooks/useUserMembership";
import { useUserProfile } from "@/hooks/useUserProfile";
import { IdCard, Check, FileCheck, Crown, Receipt, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ChargeHistory } from "@/components/ChargeHistory";
import { InlineBillingSection } from "@/components/member/InlineBillingSection";
import { BillingSummary } from "@/components/member/BillingSummary";
import { ActivationRequired } from "@/components/member/ActivationRequired";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MemberMembership() {
  const { data: membership, isLoading: membershipLoading } = useUserMembership();
  const { profile, isLoading: profileLoading } = useUserProfile();
  const isLoading = membershipLoading || profileLoading;

  // Fetch next billing date from subscription
  const { data: subscriptionData } = useQuery({
    queryKey: ["member-subscription-summary", membership?.stripe_subscription_id],
    queryFn: async () => {
      if (!membership?.stripe_subscription_id) return null;
      
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { 
          action: "get_subscription",
          subscriptionId: membership.stripe_subscription_id,
        },
      });

      if (error) throw error;
      return data?.subscription as { current_period_end: number } | null;
    },
    enabled: !!membership?.stripe_subscription_id,
  });

  const nextBillingDate = subscriptionData?.current_period_end 
    ? new Date(subscriptionData.current_period_end * 1000) 
    : null;

  if (isLoading) {
    return (
      <MemberLayout title="My Membership">
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </MemberLayout>
    );
  }

  if (!membership) {
    return (
      <MemberLayout title="My Membership">
        <Card className="max-w-2xl">
          <CardContent className="py-12 text-center">
            <IdCard className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-2xl font-semibold mb-2">No Active Membership</h2>
            <p className="text-muted-foreground mb-6">
              Join Storm Wellness Club to access exclusive benefits and amenities
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild>
                <Link to="/apply">Apply for Membership</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/memberships">View Plans</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </MemberLayout>
    );
  }

  // Show activation form for pending_activation members
  if (membership.status === "pending_activation") {
    return (
      <MemberLayout title="Activate Membership">
        <div className="max-w-lg mx-auto">
          <Alert className="mb-6 bg-amber-50 dark:bg-amber-900/20 border-amber-300">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              Complete your membership activation to unlock all benefits including class credits, member pricing, and amenity access.
            </AlertDescription>
          </Alert>
          <ActivationRequired 
            memberData={{
              id: membership.id,
              member_id: membership.member_id,
              membership_type: membership.membership_type,
              status: membership.status,
              approved_at: null,
              activation_deadline: membership.activation_deadline,
              activated_at: membership.activated_at,
              first_name: membership.first_name,
              last_name: membership.last_name,
              email: membership.email,
              gender: membership.gender,
              is_founding_member: membership.is_founding_member,
              annual_fee_paid_at: membership.annual_fee_paid_at,
              locked_start_date: membership.locked_start_date,
            }} 
          />
        </div>
      </MemberLayout>
    );
  }

  const tierBenefits = getMembershipTierBenefits(membership.membership_type);

  return (
    <MemberLayout title="My Membership">
      <div className="space-y-6 max-w-3xl">
        {/* Membership Card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-primary-foreground">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm opacity-80 mb-1">Storm Wellness Club</p>
                <h2 className="text-3xl font-bold mb-2">{membership.membership_type}</h2>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={membership.status === "active" ? "secondary" : "outline"}
                    className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30"
                  >
                    {membership.status.charAt(0).toUpperCase() + membership.status.slice(1)}
                  </Badge>
                  {membership.is_founding_member && (
                    <Badge className="bg-accent/80 text-accent-foreground border-accent">
                      Founding Member
                    </Badge>
                  )}
                </div>
              </div>
              <Crown className="h-12 w-12 opacity-50" />
            </div>
          </div>
          <CardContent className="p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Member ID</p>
                <p className="font-mono text-lg font-semibold">{membership.member_id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Member Name</p>
                <p className="text-lg font-semibold">
                  {membership.first_name} {membership.last_name}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Member Since</p>
                <p className="text-lg">
                  {format(parseISO(membership.membership_start_date), "MMMM d, yyyy")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Billing</p>
                <p className="text-lg">
                  {membership.billing_type === 'annual' ? 'Annual (Prepaid)' : 'Monthly'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Summary - Compact Overview */}
        <BillingSummary
          membershipType={membership.membership_type}
          billingType={membership.billing_type}
          gender={membership.gender}
          annualFeePaidAt={membership.annual_fee_paid_at}
          isFoundingMember={membership.is_founding_member || false}
          nextBillingDate={nextBillingDate}
        />

        {/* Inline Billing Section */}
        <InlineBillingSection
          memberId={membership.id}
          membershipType={membership.membership_type}
          stripeSubscriptionId={membership.stripe_subscription_id}
          billingType={membership.billing_type}
        />

        {/* Charge History */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-accent" />
              <CardTitle>Payment History</CardTitle>
            </div>
            <CardDescription>
              Manual charges and fees processed on your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChargeHistory memberId={membership.id} showTitle={false} />
          </CardContent>
        </Card>

        {/* Tier Benefits */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-accent" />
              <CardTitle>Your {membership.membership_type} Benefits</CardTitle>
            </div>
            <CardDescription>
              Exclusive perks included with your membership tier
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {tierBenefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-accent" />
                  </div>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Agreement Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-accent" />
              <CardTitle>Agreements & Waivers</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                  profile?.membership_agreement_signed 
                    ? "bg-muted/20 text-muted-foreground" 
                    : "bg-accent/20 text-accent"
                }`}>
                  <FileCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">Membership Agreement</p>
                  {profile?.membership_agreement_signed && profile.membership_agreement_signed_at && (
                    <p className="text-sm text-muted-foreground">
                      Signed on {format(parseISO(profile.membership_agreement_signed_at), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>
              {profile?.membership_agreement_signed ? (
                <Badge variant="outline" className="bg-muted/20 text-muted-foreground border-muted/30">
                  Signed
                </Badge>
              ) : (
                <Button asChild size="sm">
                  <Link to="/member/waivers">Sign Now</Link>
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                  profile?.waiver_signed 
                    ? "bg-muted/20 text-muted-foreground" 
                    : "bg-accent/20 text-accent"
                }`}>
                  <FileCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">Liability Waiver</p>
                  {profile?.waiver_signed && profile.waiver_signed_at && (
                    <p className="text-sm text-muted-foreground">
                      Signed on {format(parseISO(profile.waiver_signed_at), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>
              {profile?.waiver_signed ? (
                <Badge variant="outline" className="bg-muted/20 text-muted-foreground border-muted/30">
                  Signed
                </Badge>
              ) : (
                <Button asChild size="sm">
                  <Link to="/member/waivers">Sign Now</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MemberLayout>
  );
}
