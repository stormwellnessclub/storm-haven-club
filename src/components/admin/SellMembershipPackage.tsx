import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Mail } from "lucide-react";
import { useProcessMembershipPayment } from "@/hooks/useAdminPayments";
import { toast } from "sonner";

interface SellMembershipPackageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId?: string;
  memberEmail?: string;
}

export function SellMembershipPackage({
  open,
  onOpenChange,
  memberId,
  memberEmail,
}: SellMembershipPackageProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>(memberId);
  const [searchQuery, setSearchQuery] = useState("");
  const [tier, setTier] = useState<string>("Silver");
  const [gender, setGender] = useState<string>("women");
  const [isFoundingMember, setIsFoundingMember] = useState(false);
  const [startDate, setStartDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [includeAnnualFee, setIncludeAnnualFee] = useState(true);
  const [sendLink, setSendLink] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'review'>('form');

  const processPayment = useProcessMembershipPayment();

  // Search for members
  const { data: members = [] } = useQuery({
    queryKey: ["admin-members-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { data, error } = await supabase
        .from("members")
        .select("id, first_name, last_name, email, member_id")
        .or(`email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,member_id.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !selectedMemberId && searchQuery.length >= 2,
  });

  const getPriceEstimate = () => {
    const prices: Record<string, Record<string, Record<string, number>>> = {
      silver: { monthly: { women: 200, men: 120 }, annual: { women: 2400, men: 1440 } },
      gold: { monthly: { women: 250, men: 155 }, annual: { women: 3000, men: 1860 } },
      platinum: { monthly: { women: 350, men: 175 }, annual: { women: 4200, men: 2100 } },
      diamond: { monthly: { women: 500, men: 500 }, annual: { women: 6000, men: 6000 } },
    };
    const normalizedTier = tier.toLowerCase();
    const billingType = isFoundingMember ? 'annual' : 'monthly';
    const normalizedGender = gender === 'men' ? 'men' : 'women';
    return prices[normalizedTier]?.[billingType]?.[normalizedGender] || 0;
  };

  const handleContinueToReview = () => {
    if (!selectedMemberId || !startDate) return;
    setStep('review');
  };

  const handleSubmit = async () => {
    if (!selectedMemberId) {
      toast.error("Please select a member");
      return;
    }

    if (!startDate) {
      toast.error("Please select a start date");
      return;
    }

    // Get user_id from member
    const { data: memberData } = await supabase
      .from("members")
      .select("user_id, gender")
      .eq("id", selectedMemberId)
      .single();

    if (!memberData?.user_id) {
      toast.error("Member not found or has no user account");
      return;
    }

    const memberGender = memberData.gender || gender;

    try {
      const result = await processPayment.mutateAsync({
        memberId: selectedMemberId,
        tier,
        gender: memberGender,
        isFoundingMember,
        startDate,
        skipAnnualFee: !includeAnnualFee,
        sendLink,
      });

      if (result?.url && sendLink) {
        setPaymentLink(result.url);
        toast.success("Payment link created! Copy it to send to the member.");
      } else {
        toast.success("Membership activated successfully!");
        onOpenChange(false);
        resetForm();
      }
    } catch (error) {
      console.error("Error processing membership payment:", error);
    }
  };

  const resetForm = () => {
    setSelectedMemberId(memberId);
    setTier("Silver");
    setGender("women");
    setIsFoundingMember(false);
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setIncludeAnnualFee(true);
    setSendLink(false);
    setPaymentLink(null);
    setSearchQuery("");
    setStep('form');
  };

  const selectedMember = members.find((m: any) => m.id === selectedMemberId);
  const priceEstimate = getPriceEstimate();
  const billingInterval = isFoundingMember ? 'annual' : 'monthly';

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {step === 'form' ? 'Sell Membership Package' : 'Review & Confirm'}
          </DialogTitle>
          <DialogDescription>
            {step === 'form' 
              ? 'Create a new membership or activate an existing member\'s account.'
              : 'Please review the details below before processing.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'form' ? (
          <div className="space-y-4 py-4">
            {!selectedMemberId ? (
              <div className="space-y-2">
                <Label>Search Member</Label>
                <Input
                  placeholder="Search by name, email, or member ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {members.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    {members.map((member: any) => (
                      <button
                        key={member.id}
                        onClick={() => {
                          setSelectedMemberId(member.id);
                          setSearchQuery("");
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-muted transition-colors border-b last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {member.first_name} {member.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {member.email} • {member.member_id}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Selected Member</Label>
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <span className="text-sm">
                    {selectedMember?.first_name} {selectedMember?.last_name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMemberId(undefined)}
                  >
                    Change
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Membership Tier</Label>
                <Select value={tier} onValueChange={setTier}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Silver">Silver</SelectItem>
                    <SelectItem value="Gold">Gold</SelectItem>
                    <SelectItem value="Platinum">Platinum</SelectItem>
                    <SelectItem value="Diamond">Diamond</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="women">Women</SelectItem>
                    <SelectItem value="men">Men</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="founding"
                checked={isFoundingMember}
                onCheckedChange={(checked) => setIsFoundingMember(checked === true)}
              />
              <Label htmlFor="founding" className="cursor-pointer">
                Founding Member (Annual billing, pays upfront)
              </Label>
            </div>

            {!isFoundingMember && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="annualFee"
                  checked={includeAnnualFee}
                  onCheckedChange={(checked) => setIncludeAnnualFee(checked === true)}
                />
                <Label htmlFor="annualFee" className="cursor-pointer">
                  Include Annual Fee
                </Label>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendLink"
                checked={sendLink}
                onCheckedChange={(checked) => setSendLink(checked === true)}
              />
              <Label htmlFor="sendLink" className="cursor-pointer">
                Generate payment link instead of processing immediately
              </Label>
            </div>
          </div>
        ) : (
          // Review Step
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Member</span>
                <span className="font-medium">
                  {selectedMember?.first_name} {selectedMember?.last_name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Tier</span>
                <span className="font-medium">{tier} Membership</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Billing</span>
                <span className="font-medium capitalize">{billingInterval}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Start Date</span>
                <span className="font-medium">{format(new Date(startDate), 'MMM d, yyyy')}</span>
              </div>
              {isFoundingMember && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Founding Member</span>
                  <span className="font-medium text-primary">Yes</span>
                </div>
              )}
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Estimated Price</span>
                  <span className="text-xl font-bold">
                    ${priceEstimate}/{billingInterval === 'annual' ? 'yr' : 'mo'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {sendLink 
                  ? 'A payment link will be generated for the member to complete.'
                  : 'This will immediately charge the member\'s card and activate their membership.'}
              </p>
            </div>
          </div>
        )}

        {paymentLink && (
          <div className="p-3 bg-muted rounded-md space-y-2">
            <Label>Payment Link</Label>
            <div className="flex items-center gap-2">
              <Input value={paymentLink} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(paymentLink);
                  toast.success("Link copied to clipboard!");
                }}
              >
                Copy
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'form' ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleContinueToReview}
                disabled={!selectedMemberId || !startDate}
              >
                Review Details
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('form')}>
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={processPayment.isPending}
              >
                {processPayment.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {sendLink ? "Generate Link" : "Confirm & Process Payment"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
