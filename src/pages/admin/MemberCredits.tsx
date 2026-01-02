import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, Plus, Minus, Coins, History, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CREDIT_TYPE_LABELS, CreditType } from "@/lib/memberCredits";

interface MemberWithCredits {
  id: string;
  member_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  membership_type: string;
  status: string;
  credits: {
    id: string;
    credit_type: CreditType;
    credits_total: number;
    credits_remaining: number;
    cycle_start: string;
    cycle_end: string;
    expires_at: string;
  }[];
}

interface CreditAdjustment {
  id: string;
  member_id: string;
  member_credit_id: string | null;
  credit_type: string;
  adjustment_type: "add" | "remove";
  amount: number;
  previous_balance: number;
  new_balance: number;
  reason: string | null;
  adjusted_by: string;
  created_at: string;
  member?: {
    first_name: string;
    last_name: string;
    member_id: string;
  };
}

export default function MemberCreditsAdmin() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<MemberWithCredits | null>(null);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "remove">("add");
  const [creditType, setCreditType] = useState<CreditType>("class");
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("");

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["admin-members-with-credits"],
    queryFn: async () => {
      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("id, member_id, user_id, first_name, last_name, email, membership_type, status")
        .eq("status", "active")
        .order("last_name", { ascending: true });

      if (membersError) throw membersError;

      const { data: creditsData, error: creditsError } = await supabase
        .from("member_credits")
        .select("*")
        .gt("expires_at", new Date().toISOString());

      if (creditsError) throw creditsError;

      const membersWithCredits: MemberWithCredits[] = (membersData || []).map((member) => ({
        ...member,
        user_id: member.user_id || "",
        credits: (creditsData || [])
          .filter((c) => c.member_id === member.id)
          .map((c) => ({
            id: c.id,
            credit_type: c.credit_type as CreditType,
            credits_total: c.credits_total,
            credits_remaining: c.credits_remaining,
            cycle_start: c.cycle_start,
            cycle_end: c.cycle_end,
            expires_at: c.expires_at,
          })),
      }));

      return membersWithCredits;
    },
  });

  const { data: adjustmentHistory = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ["credit-adjustment-history"],
    queryFn: async () => {
      const { data: adjustments, error: adjustmentsError } = await supabase
        .from("credit_adjustments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (adjustmentsError) throw adjustmentsError;

      // Get member info for each adjustment
      const memberIds = [...new Set((adjustments || []).map((a) => a.member_id))];
      const { data: membersData } = await supabase
        .from("members")
        .select("id, first_name, last_name, member_id")
        .in("id", memberIds);

      const membersMap = new Map((membersData || []).map((m) => [m.id, m]));

      return (adjustments || []).map((adj) => ({
        ...adj,
        adjustment_type: adj.adjustment_type as "add" | "remove",
        member: membersMap.get(adj.member_id),
      })) as CreditAdjustment[];
    },
  });

  const adjustCreditMutation = useMutation({
    mutationFn: async ({
      memberId,
      creditType,
      adjustment,
      reason,
    }: {
      memberId: string;
      creditType: CreditType;
      adjustment: number;
      reason: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const member = members.find((m) => m.id === memberId);
      if (!member) throw new Error("Member not found");

      const credit = member.credits.find((c) => c.credit_type === creditType);
      
      if (!credit) {
        throw new Error(`No active ${CREDIT_TYPE_LABELS[creditType]} credits found for this member`);
      }

      const previousBalance = credit.credits_remaining;
      const newRemaining = Math.max(0, Math.min(credit.credits_total + 10, previousBalance + adjustment));

      // Update the credit balance
      const { error: updateError } = await supabase
        .from("member_credits")
        .update({ credits_remaining: newRemaining })
        .eq("id", credit.id);

      if (updateError) throw updateError;

      // Log the adjustment
      const { error: logError } = await supabase
        .from("credit_adjustments")
        .insert({
          member_id: memberId,
          member_credit_id: credit.id,
          credit_type: creditType,
          adjustment_type: adjustment > 0 ? "add" : "remove",
          amount: Math.abs(adjustment),
          previous_balance: previousBalance,
          new_balance: newRemaining,
          reason: reason || null,
          adjusted_by: user.id,
        });

      if (logError) throw logError;

      return { newRemaining, creditType };
    },
    onSuccess: (data) => {
      toast.success(`${CREDIT_TYPE_LABELS[data.creditType]} adjusted to ${data.newRemaining} credits`);
      queryClient.invalidateQueries({ queryKey: ["admin-members-with-credits"] });
      queryClient.invalidateQueries({ queryKey: ["credit-adjustment-history"] });
      setAdjustDialogOpen(false);
      setAmount("1");
      setReason("");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to adjust credits");
    },
  });

  const filteredMembers = members.filter(
    (member) =>
      member.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.member_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdjustCredits = () => {
    if (!selectedMember) return;
    
    const adjustmentAmount = parseInt(amount, 10);
    if (isNaN(adjustmentAmount) || adjustmentAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    adjustCreditMutation.mutate({
      memberId: selectedMember.id,
      creditType,
      adjustment: adjustmentType === "add" ? adjustmentAmount : -adjustmentAmount,
      reason,
    });
  };

  const openAdjustDialog = (member: MemberWithCredits, type: "add" | "remove") => {
    setSelectedMember(member);
    setAdjustmentType(type);
    setCreditType("class");
    setAmount("1");
    setReason("");
    setAdjustDialogOpen(true);
  };

  const getCreditDisplay = (member: MemberWithCredits, type: CreditType) => {
    const credit = member.credits.find((c) => c.credit_type === type);
    if (!credit) return "—";
    return `${credit.credits_remaining}/${credit.credits_total}`;
  };

  return (
    <AdminLayout title="Member Credits">
      <Tabs defaultValue="credits" className="space-y-6">
        <TabsList>
          <TabsTrigger value="credits" className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Credits
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Adjustment History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credits" className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Credits Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Active Member Credits ({filteredMembers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No members match your search." : "No active members with credits."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead className="text-center">Class Credits</TableHead>
                      <TableHead className="text-center">Red Light</TableHead>
                      <TableHead className="text-center">Dry Cryo</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {member.first_name} {member.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">{member.member_id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{member.membership_type}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {getCreditDisplay(member, "class")}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {getCreditDisplay(member, "red_light")}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {getCreditDisplay(member, "dry_cryo")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAdjustDialog(member, "add")}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAdjustDialog(member, "remove")}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Credit Adjustments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isHistoryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : adjustmentHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No credit adjustments have been made yet.
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Member</TableHead>
                        <TableHead>Credit Type</TableHead>
                        <TableHead className="text-center">Change</TableHead>
                        <TableHead className="text-center">Balance</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adjustmentHistory.map((adj) => (
                        <TableRow key={adj.id}>
                          <TableCell className="text-sm">
                            {format(new Date(adj.created_at), "MMM d, yyyy h:mm a")}
                          </TableCell>
                          <TableCell>
                            {adj.member ? (
                              <div>
                                <p className="font-medium">
                                  {adj.member.first_name} {adj.member.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground">{adj.member.member_id}</p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Unknown</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {CREDIT_TYPE_LABELS[adj.credit_type as CreditType] || adj.credit_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {adj.adjustment_type === "add" ? (
                                <ArrowUpCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <ArrowDownCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span className={adj.adjustment_type === "add" ? "text-green-600" : "text-red-600"}>
                                {adj.adjustment_type === "add" ? "+" : "-"}{adj.amount}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm">
                            {adj.previous_balance} → {adj.new_balance}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {adj.reason || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjust Credits Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjustmentType === "add" ? "Add Credits" : "Remove Credits"}
            </DialogTitle>
            <DialogDescription>
              {selectedMember && (
                <>
                  Adjusting credits for{" "}
                  <span className="font-medium">
                    {selectedMember.first_name} {selectedMember.last_name}
                  </span>{" "}
                  ({selectedMember.member_id})
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Credit Type</Label>
              <Select value={creditType} onValueChange={(v) => setCreditType(v as CreditType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="class">Class Credits</SelectItem>
                  <SelectItem value="red_light">Red Light Therapy</SelectItem>
                  <SelectItem value="dry_cryo">Dry Cryo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min="1"
                max="50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Reason <span className="text-muted-foreground">(recommended)</span></Label>
              <Textarea
                placeholder="e.g., Customer service adjustment, promotional credit..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {selectedMember && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  Current {CREDIT_TYPE_LABELS[creditType]}:{" "}
                  <span className="font-medium text-foreground">
                    {getCreditDisplay(selectedMember, creditType)}
                  </span>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjustCredits}
              disabled={adjustCreditMutation.isPending}
              variant={adjustmentType === "remove" ? "destructive" : "default"}
            >
              {adjustCreditMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {adjustmentType === "add" ? "Add" : "Remove"} Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
