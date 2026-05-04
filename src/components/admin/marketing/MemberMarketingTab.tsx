import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Send, Mail, Search, Users, Filter } from "lucide-react";
import { ComposeEmailDialog } from "./ComposeEmailDialog";
import { ComposeSmsDialog } from "./ComposeSmsDialog";
import { CampaignPlaybooks, type PlaybookConfig } from "./CampaignPlaybooks";

interface MemberRecord {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  membership_type: string | null;
}

export function MemberMarketingTab() {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [tierFilter, setTierFilter] = useState("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSmsOpen, setComposeSmsOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ email: string; name: string } | null>(null);
  const [activeGoalType, setActiveGoalType] = useState<string | undefined>();
  const [activePlaybookName, setActivePlaybookName] = useState<string | undefined>();

  useEffect(() => {
    fetchMembers();
  }, [statusFilter]);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("members")
        .select("id, first_name, last_name, email, status, membership_type")
        .not("email", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMembers((data || []) as MemberRecord[]);
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = tierFilter === "all" || (m.membership_type || "").toLowerCase().includes(tierFilter.toLowerCase());
    return matchesSearch && matchesTier;
  });

  const handleSendToMember = (member: MemberRecord) => {
    setSelectedMember({ email: member.email, name: `${member.first_name} ${member.last_name}` });
    setComposeOpen(true);
  };

  const handleLaunchPlaybook = (playbook: PlaybookConfig) => {
    setSelectedMember(null);
    setActiveGoalType(playbook.goalType);
    setActivePlaybookName(playbook.name);
    setComposeOpen(true);
  };

  const handleLaunchSmsPlaybook = (playbook: PlaybookConfig) => {
    setSelectedMember(null);
    setActiveGoalType(playbook.goalType);
    setActivePlaybookName(playbook.name);
    setComposeSmsOpen(true);
  };

  const handleBulkSend = () => {
    setSelectedMember(null);
    setActiveGoalType(undefined);
    setActivePlaybookName(undefined);
    setComposeOpen(true);
  };

  const statusCounts = {
    active: members.filter((m) => m.status === "active").length,
    total: members.length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{filteredMembers.length}</p>
            <p className="text-xs text-muted-foreground">Members in Segment</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{statusCounts.active}</p>
            <p className="text-xs text-muted-foreground">Active Members</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{statusCounts.total}</p>
            <p className="text-xs text-muted-foreground">Total Members</p>
          </CardContent>
        </Card>
      </div>

      {/* Strategic Playbooks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Member Campaign Playbooks</CardTitle>
          <CardDescription>Goal-driven campaigns with conversion tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <CampaignPlaybooks
            type="member"
            onLaunchPlaybook={handleLaunchPlaybook}
            onLaunchSmsPlaybook={handleLaunchSmsPlaybook}
            onCustomCampaign={handleBulkSend}
          />
        </CardContent>
      </Card>

      {/* Individual Outreach */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Individual Outreach</CardTitle>
          <CardDescription>Send a direct email to a specific member</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="frozen">Frozen</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="executive">Executive</SelectItem>
                <SelectItem value="founder">Founder</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Member List */}
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
              {filteredMembers.slice(0, 30).map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-sm">
                        {member.first_name} {member.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {member.membership_type || "Standard"}
                    </Badge>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleSendToMember(member)}>
                    <Mail className="h-3 w-3 mr-1" />
                    Email
                  </Button>
                </div>
              ))}
              {filteredMembers.length > 30 && (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  Showing 30 of {filteredMembers.length} members
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ComposeEmailDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        recipientType="member"
        prefilledRecipient={selectedMember}
        goalType={activeGoalType}
        playbookName={activePlaybookName}
      />

      <ComposeSmsDialog
        open={composeSmsOpen}
        onOpenChange={setComposeSmsOpen}
        recipientType="member"
        goalType={activeGoalType}
        playbookName={activePlaybookName}
      />
    </div>
  );
}
