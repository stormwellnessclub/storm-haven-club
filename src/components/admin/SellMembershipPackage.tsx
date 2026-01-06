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
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Sell Membership Package</DialogTitle>
          <DialogDescription>
            Create a new membership or activate an existing member's account.
          </DialogDescription>
        </DialogHeader>

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
                  {members.find((m: any) => m.id === selectedMemberId)?.first_name}{" "}
                  {members.find((m: any) => m.id === selectedMemberId)?.last_name}
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedMemberId || !startDate || processPayment.isPending}
          >
            {processPayment.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {sendLink ? "Generate Link" : "Process Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
