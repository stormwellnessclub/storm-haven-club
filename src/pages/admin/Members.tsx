import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MemberDetailSheet } from "@/components/admin/MemberDetailSheet";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Filter, MoreHorizontal, UserPlus, Mail, Loader2 } from "lucide-react";
import { format } from "date-fns";

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "pending_activation":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
    case "past_due":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "frozen":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "suspended":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "cancelled":
    case "expired":
    case "inactive":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    default:
      return "bg-secondary text-secondary-foreground";
  }
};

const getMembershipColor = (membership: string) => {
  const lowerMembership = membership?.toLowerCase() || "";
  if (lowerMembership.includes("diamond")) {
    return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
  }
  if (lowerMembership.includes("platinum")) {
    return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }
  if (lowerMembership.includes("gold")) {
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
  }
  if (lowerMembership.includes("silver")) {
    return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300";
  }
  return "bg-secondary text-secondary-foreground";
};

// Normalize tier name for display
const normalizeTierDisplay = (membership: string): string => {
  const lower = membership?.toLowerCase() || "";
  if (lower.includes("diamond")) return "Diamond";
  if (lower.includes("platinum")) return "Platinum";
  if (lower.includes("gold")) return "Gold";
  if (lower.includes("silver")) return "Silver";
  return membership;
};

const formatStatus = (status: string) => {
  return status?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Unknown";
};

export default function Members() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<typeof members[0] | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { data: members = [], isLoading, error } = useQuery({
    queryKey: ["admin-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const filteredMembers = members.filter(
    (member) =>
      member.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.member_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewProfile = (member: typeof members[0]) => {
    setSelectedMember(member);
    setIsSheetOpen(true);
  };

  const handleCheckIn = (member: typeof members[0]) => {
    navigate(`/admin/check-in?member=${member.member_id}`);
  };

  return (
    <AdminLayout title="Members">
      <div className="space-y-6">
        {/* Header Actions */}
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
          <div className="flex gap-2">
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </div>
        </div>

        {/* Members Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Members ({filteredMembers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                Error loading members. Please try again.
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No members match your search." : "No members yet."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member ID</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Membership</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Join Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-mono text-sm">
                        {member.member_id}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {member.first_name} {member.last_name}
                          </p>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {member.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className={getMembershipColor(member.membership_type)}>
                            {normalizeTierDisplay(member.membership_type)}
                          </Badge>
                          {member.is_founding_member && (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                              Founding
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={getStatusColor(member.status)}>
                          {formatStatus(member.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.membership_start_date
                          ? format(new Date(member.membership_start_date), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewProfile(member)}>
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewProfile(member)}>
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCheckIn(member)}>
                              Check In
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewProfile(member)}>
                              View Payment History
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <MemberDetailSheet
          member={selectedMember}
          open={isSheetOpen}
          onOpenChange={setIsSheetOpen}
        />
      </div>
    </AdminLayout>
  );
}
