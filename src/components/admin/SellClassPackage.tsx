import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2 } from "lucide-react";
import { useProcessClassPackage } from "@/hooks/useAdminPayments";
import { toast } from "sonner";

interface SellClassPackageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}

export function SellClassPackage({
  open,
  onOpenChange,
  userId,
}: SellClassPackageProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(userId);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<string>("reformer");
  const [passType, setPassType] = useState<'single' | 'tenPack'>('tenPack');
  const [isMember, setIsMember] = useState(false);
  const [sendLink, setSendLink] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'review'>('form');

  const processPackage = useProcessClassPackage();

  // Pricing info
  const getPriceEstimate = () => {
    const prices: Record<string, Record<string, Record<string, number>>> = {
      reformer: { single: { member: 25, nonMember: 30 }, tenPack: { member: 170, nonMember: 285 } },
      cycling: { single: { member: 25, nonMember: 30 }, tenPack: { member: 170, nonMember: 285 } },
      aerobics: { single: { member: 20, nonMember: 30 }, tenPack: { member: 150, nonMember: 180 } },
    };
    const memberStatus = actualIsMember ? 'member' : 'nonMember';
    return prices[category]?.[passType]?.[memberStatus] || 0;
  };

  // Search for users (both members and non-members via profiles)
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      
      // Search profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, user_id")
        .or(`email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
        .limit(10);

      if (profilesError) throw profilesError;

      // Also search members
      const { data: members, error: membersError } = await supabase
        .from("members")
        .select("id, email, first_name, last_name, user_id")
        .or(`email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
        .limit(10);

      if (membersError) throw membersError;

      // Combine and deduplicate
      const allUsers = [
        ...(profiles || []).map((p: any) => ({
          id: p.user_id,
          email: p.email,
          name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email,
          isMember: false,
        })),
        ...(members || []).map((m: any) => ({
          id: m.user_id,
          email: m.email,
          name: `${m.first_name} ${m.last_name}`,
          isMember: true,
        })),
      ];

      // Deduplicate by user_id
      const uniqueUsers = Array.from(
        new Map(allUsers.map((u) => [u.id, u])).values()
      );

      return uniqueUsers;
    },
    enabled: !selectedUserId && searchQuery.length >= 2,
  });

  const handleContinueToReview = () => {
    if (!selectedUserId) return;
    setStep('review');
  };

  const handleSubmit = async () => {
    if (!selectedUserId) {
      toast.error("Please select a customer");
      return;
    }

    try {
      const result = await processPackage.mutateAsync({
        userId: selectedUserId,
        category,
        passType,
        isMember: actualIsMember,
        sendLink,
      });

      if (result?.url && sendLink) {
        setPaymentLink(result.url);
        toast.success("Payment link created! Copy it to send to the customer.");
      } else {
        toast.success("Class package processed successfully!");
        onOpenChange(false);
        resetForm();
      }
    } catch (error) {
      console.error("Error processing class package:", error);
    }
  };

  const resetForm = () => {
    setSelectedUserId(userId);
    setCategory("reformer");
    setPassType("tenPack");
    setIsMember(false);
    setSendLink(false);
    setPaymentLink(null);
    setSearchQuery("");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const getCategoryLabel = () => {
    switch (category) {
      case 'reformer': return 'Reformer Pilates';
      case 'cycling': return 'Cycling';
      case 'aerobics': return 'Aerobics';
      default: return category;
    }
  };

  const getPassTypeLabel = () => {
    return passType === 'single' ? 'Single Class' : '10-Class Pack';
  };

  // Determine if selected user is a member
  const selectedUser = users.find((u: any) => u.id === selectedUserId);
  const actualIsMember = selectedUser?.isMember || isMember;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{step === 'form' ? 'Sell Class Package' : 'Review & Confirm'}</DialogTitle>
          <DialogDescription>
            {step === 'form' 
              ? 'Process a class package purchase for a member or non-member customer.'
              : 'Please review the details below before processing.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'form' ? (
          <div className="space-y-4 py-4">
            {!selectedUserId ? (
              <div className="space-y-2">
                <Label>Search Customer</Label>
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {users.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    {users.map((user: any) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setIsMember(user.isMember);
                          setSearchQuery("");
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-muted transition-colors border-b last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {user.email}
                              {user.isMember && (
                                <span className="ml-2 text-xs bg-primary/10 text-primary px-1 rounded">
                                  Member
                                </span>
                              )}
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
                <Label>Selected Customer</Label>
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <span className="text-sm">
                    {selectedUser?.name || "Unknown"}
                    {actualIsMember && (
                      <span className="ml-2 text-xs bg-primary/10 text-primary px-1 rounded">
                        Member
                      </span>
                    )}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(undefined)}>
                    Change
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reformer">Reformer</SelectItem>
                    <SelectItem value="cycling">Cycling</SelectItem>
                    <SelectItem value="aerobics">Aerobics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Package Type</Label>
                <Select value={passType} onValueChange={(v) => setPassType(v as 'single' | 'tenPack')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Class</SelectItem>
                    <SelectItem value="tenPack">10-Pack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!selectedUserId && (
              <div className="flex items-center space-x-2">
                <Checkbox id="isMember" checked={isMember} onCheckedChange={(checked) => setIsMember(checked === true)} />
                <Label htmlFor="isMember" className="cursor-pointer">Customer is a member (member pricing)</Label>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox id="sendLink" checked={sendLink} onCheckedChange={(checked) => setSendLink(checked === true)} />
              <Label htmlFor="sendLink" className="cursor-pointer">Generate payment link instead of processing immediately</Label>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{selectedUser?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-medium">{getCategoryLabel()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span className="font-medium">{getPassTypeLabel()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pricing</span><span className="font-medium">{actualIsMember ? 'Member' : 'Non-Member'}</span></div>
              <div className="pt-2 border-t flex justify-between"><span className="font-medium">Price</span><span className="text-xl font-bold">${getPriceEstimate()}</span></div>
            </div>
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {sendLink ? 'A payment link will be generated.' : 'This will immediately charge the customer and create the class pass.'}
            </div>
          </div>
        )}

        {paymentLink && (
          <div className="p-3 bg-muted rounded-md space-y-2">
            <Label>Payment Link</Label>
            <div className="flex items-center gap-2">
              <Input value={paymentLink} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(paymentLink); toast.success("Link copied!"); }}>Copy</Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'form' ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleContinueToReview} disabled={!selectedUserId}>Review Details</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('form')}>Back</Button>
              <Button onClick={handleSubmit} disabled={processPackage.isPending}>
                {processPackage.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {sendLink ? "Generate Link" : "Confirm & Process"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
