import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserMembership, getMembershipTierBenefits } from "@/hooks/useUserMembership";
import { useUserProfile } from "@/hooks/useUserProfile";
import { IdCard, Check, FileCheck, Crown, Receipt, AlertCircle, Shield, CreditCard, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ChargeHistory } from "@/components/ChargeHistory";
import { InlineBillingSection } from "@/components/member/InlineBillingSection";
import { BillingSummary } from "@/components/member/BillingSummary";
import { MemberOnboardingChecklist } from "@/components/member/MemberOnboardingChecklist";
import { TierChangeCard } from "@/components/member/TierChangeCard";
import { useMemberAgreementStatus } from "@/hooks/useMemberAgreementStatus";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { toast } from "sonner";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";

export default function MemberMembership() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: membership, isLoading: membershipLoading } = useUserMembership();
  const { profile, isLoading: profileLoading } = useUserProfile();
  const { isSuperAdmin } = useUserRoles();
  const isLoading = membershipLoading || profileLoading;

  // Handle subscription creation success from Stripe checkout return
  useEffect(() => {
    const subscriptionCreated = searchParams.get('subscription_created');
    const annualFeePaid = searchParams.get('annual_fee_paid');
    
    if (subscriptionCreated === 'true') {
      toast.success("Membership subscription activated! Your dues will be charged automatically.");
      // Clear the URL parameter
      searchParams.delete('subscription_created');
      setSearchParams(searchParams, { replace: true });
      // Refresh membership data
      queryClient.invalidateQueries({ queryKey: ["user-membership"] });
    }
    
    if (annualFeePaid === 'true') {
      toast.success("Initiation fee paid successfully!");
      // Clear the URL parameter
      searchParams.delete('annual_fee_paid');
      setSearchParams(searchParams, { replace: true });
      // Refresh membership data
      queryClient.invalidateQueries({ queryKey: ["user-membership"] });
    }
  }, [searchParams, setSearchParams, queryClient]);

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

  // SOFT LAUNCH MODE: Show informational message instead of self-activation
  // Original ActivationRequired component is preserved for future use
  const { isInitiationFeePaid } = usePaymentStatus();
  const { membershipAgreementSigned, liabilityWaiverSigned } = useMemberAgreementStatus();
  
  if (membership.status === "pending_activation") {
    const handleSuperAdminActivate = async () => {
      if (!membership?.id) return;
      
      try {
        const { error: updateError } = await supabase
          .from("members")
          .update({
            status: "active",
            activated_at: new Date().toISOString(),
            membership_start_date: new Date().toISOString().split('T')[0],
          })
          .eq("id", membership.id)
          .eq("status", "pending_activation");

        if (updateError) throw updateError;

        toast.success("Membership activated by super admin");
        window.location.reload();
      } catch (error: any) {
        console.error("Super admin activation error:", error);
        toast.error(error.message || "Failed to activate membership");
      }
    };

    const hasPaymentMethod = !!(membership.card_brand && membership.card_last4);
    const tierChangeUsed = membership.tier_change_used ?? false;
    
    // Initiation fee payment handler
    const [isPayingInitiationFee, setIsPayingInitiationFee] = useState(false);

    const handlePayInitiationFee = async () => {
      if (!membership) return;
      setIsPayingInitiationFee(true);
      try {
        const { data, error } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "pay_annual_fee",
            memberId: membership.id,
            successUrl: `${window.location.origin}/member/membership?annual_fee_paid=true`,
            cancelUrl: `${window.location.origin}/member/membership`,
          },
        });
        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
        }
      } catch (error) {
        toast.error("Failed to start payment. Please try again.");
      } finally {
        setIsPayingInitiationFee(false);
      }
    };

    return (
      <MemberLayout title="Complete Your Membership">
        <div className="space-y-6">
          {/* One-Time Tier Change Option */}
          <TierChangeCard
            memberId={membership.id}
            currentTier={membership.membership_type}
            gender={membership.gender}
            tierChangeUsed={tierChangeUsed}
            isFoundingMember={membership.is_founding_member || false}
          />

          {/* Onboarding Checklist */}
          <MemberOnboardingChecklist
            memberName={membership.first_name || "Member"}
            membershipType={membership.membership_type}
            hasPaymentMethod={hasPaymentMethod}
            hasMembershipAgreement={membershipAgreementSigned}
            hasLiabilityWaiver={liabilityWaiverSigned}
            isFoundingMember={membership.is_founding_member}
            isInitiationFeePaid={isInitiationFeePaid}
            onPayInitiationFee={handlePayInitiationFee}
            isPayingInitiationFee={isPayingInitiationFee}
          />

          {/* Super Admin Override - PRESERVED */}
          {isSuperAdmin() && (
            <div className="max-w-lg mx-auto p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
              <div className="flex items-start gap-3 mb-3">
                <Shield className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-destructive">Super Admin Override</p>
                  <p className="text-sm text-muted-foreground">
                    Activate this membership immediately without payment processing.
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                onClick={handleSuperAdminActivate}
                className="w-full"
              >
                <Shield className="mr-2 h-4 w-4" />
                Activate Membership (Super Admin)
              </Button>
            </div>
          )}
        </div>
      </MemberLayout>
    );
  }

  const tierBenefits = getMembershipTierBenefits(membership.membership_type, membership.is_founding_member || false);

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

            {/* Payment Method on File */}
            {(membership.card_brand || membership.card_last4) && (
              <div className="mt-6 pt-6 border-t border-primary-foreground/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 opacity-70" />
                    <div>
                      <p className="text-sm opacity-80">Payment Method</p>
                      <p className="font-medium">
                        {membership.card_brand?.toUpperCase()} •••• {membership.card_last4}
                        {membership.card_exp_month && membership.card_exp_year && (
                          <span className="text-sm opacity-70 ml-2">
                            Exp {String(membership.card_exp_month).padStart(2, '0')}/{membership.card_exp_year}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    asChild
                    className="bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/20"
                  >
                    <Link to="/member/payment-methods">Manage</Link>
                  </Button>
                </div>
              </div>
            )}
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
