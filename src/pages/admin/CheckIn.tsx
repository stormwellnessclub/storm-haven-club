import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  UserCheck, 
  Clock, 
  CheckCircle2,
  AlertTriangle,
  XCircle,
  User,
  CreditCard,
  Calendar,
  Loader2,
  ShieldAlert,
  DollarSign
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, addYears, isBefore } from "date-fns";
import { checkMemberPaymentStatus } from "@/hooks/usePaymentStatus";

type MemberStatus = "active" | "past_due" | "frozen" | "expired" | "cancelled";

interface Member {
  id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  membership_type: string;
  status: MemberStatus;
  membership_end_date: string | null;
  photo_url: string | null;
  annual_fee_paid_at: string | null;
}

interface CheckInRecord {
  id: string;
  member_id: string;
  checked_in_at: string;
  members: {
    first_name: string;
    last_name: string;
    membership_type: string;
  };
}

export default function CheckIn() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckInRecord[]>([]);
  const [todayStats, setTodayStats] = useState({ total: 0, currentlyIn: 0 });
  const [memberCheckInCount, setMemberCheckInCount] = useState(0);
  const [isOverriding, setIsOverriding] = useState(false);

  // Get payment status for selected member
  const memberPaymentStatus = selectedMember 
    ? checkMemberPaymentStatus({
        status: selectedMember.status,
        annual_fee_paid_at: selectedMember.annual_fee_paid_at,
      })
    : null;

  // Fetch recent check-ins on mount
  useEffect(() => {
    fetchRecentCheckIns();
    fetchTodayStats();
  }, []);

  const fetchRecentCheckIns = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("check_ins")
      .select(`
        id,
        member_id,
        checked_in_at,
        members (
          first_name,
          last_name,
          membership_type
        )
      `)
      .gte("checked_in_at", today.toISOString())
      .order("checked_in_at", { ascending: false })
      .limit(6);

    if (!error && data) {
      setRecentCheckIns(data as unknown as CheckInRecord[]);
    }
  };

  const fetchTodayStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: totalToday } = await supabase
      .from("check_ins")
      .select("*", { count: "exact", head: true })
      .gte("checked_in_at", today.toISOString());

    const { count: currentlyIn } = await supabase
      .from("check_ins")
      .select("*", { count: "exact", head: true })
      .gte("checked_in_at", today.toISOString())
      .is("checked_out_at", null);

    setTodayStats({
      total: totalToday || 0,
      currentlyIn: currentlyIn || 0,
    });
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    setSelectedMember(null);

    const { data, error } = await supabase
      .from("members")
      .select("*")
      .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,member_id.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
      .limit(10);

    setIsSearching(false);

    if (error) {
      toast.error("Search failed");
      return;
    }

    if (data && data.length > 0) {
      setSearchResults(data as Member[]);
    } else {
      toast.info("No members found");
    }
  };

  const selectMember = async (member: Member) => {
    setSelectedMember(member);
    setSearchResults([]);
    setSearchQuery("");

    // Fetch this month's check-in count
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("check_ins")
      .select("*", { count: "exact", head: true })
      .eq("member_id", member.id)
      .gte("checked_in_at", startOfMonth.toISOString());

    setMemberCheckInCount(count || 0);
  };

  const handleCheckIn = async (override: boolean = false) => {
    if (!selectedMember || !user) return;

    if (override) {
      setIsOverriding(true);
    } else {
      setIsCheckingIn(true);
    }

    const notes = override 
      ? `OVERRIDE: Payment issue - checked in by admin (${user.email})`
      : null;

    const { error } = await supabase.from("check_ins").insert({
      member_id: selectedMember.id,
      checked_in_by: user.id,
      notes,
    });

    setIsCheckingIn(false);
    setIsOverriding(false);

    if (error) {
      toast.error("Check-in failed");
      return;
    }

    if (override) {
      toast.warning(`${selectedMember.first_name} ${selectedMember.last_name} checked in with OVERRIDE. Payment issue noted.`);
    } else {
      toast.success(`${selectedMember.first_name} ${selectedMember.last_name} checked in!`);
    }
    setMemberCheckInCount((prev) => prev + 1);
    fetchRecentCheckIns();
    fetchTodayStats();
  };

  const getStatusConfig = (status: MemberStatus) => {
    switch (status) {
      case "active":
        return {
          icon: CheckCircle2,
          label: "Check-In Approved",
          badge: <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Active</Badge>,
          bgClass: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
          iconClass: "text-green-600",
          canCheckIn: true,
        };
      case "past_due":
        return {
          icon: ShieldAlert,
          label: "Payment Required - Cannot Check In",
          badge: <Badge className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">Past Due</Badge>,
          bgClass: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
          iconClass: "text-red-600",
          canCheckIn: false,
        };
      case "frozen":
        return {
          icon: AlertTriangle,
          label: "Membership Frozen",
          badge: <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">Frozen</Badge>,
          bgClass: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
          iconClass: "text-blue-600",
          canCheckIn: false,
        };
      case "expired":
      case "cancelled":
        return {
          icon: XCircle,
          label: status === "expired" ? "Membership Expired" : "Membership Cancelled",
          badge: <Badge className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">{status === "expired" ? "Expired" : "Cancelled"}</Badge>,
          bgClass: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
          iconClass: "text-red-600",
          canCheckIn: false,
        };
      default:
        return {
          icon: User,
          label: "Unknown Status",
          badge: <Badge variant="outline">Unknown</Badge>,
          bgClass: "bg-secondary",
          iconClass: "text-muted-foreground",
          canCheckIn: false,
        };
    }
  };

  return (
    <AdminLayout title="Member Check-In">
      <div className="space-y-6">
        {/* Main Check-In Area */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Search Panel */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Search className="h-5 w-5" />
                    Member Lookup
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Search by name, member ID, email, or phone
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search Input */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, member ID, email, or phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                  </Button>
                </div>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Search Results</p>
                  <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                    {searchResults.map((member) => (
                      <button
                        key={member.id}
                        onClick={() => selectMember(member)}
                        className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors text-left w-full"
                      >
                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {member.first_name} {member.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {member.member_id} • {member.membership_type}
                          </p>
                        </div>
                        {getStatusConfig(member.status).badge}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!selectedMember && searchResults.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">Search for a member</p>
                  <p className="text-sm mt-1">Enter a name, member ID, email, or phone number</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Member Result Panel */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Member Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedMember ? (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-lg border ${getStatusConfig(selectedMember.status).bgClass}`}>
                    <div className="flex items-center gap-3">
                      {(() => {
                        const StatusIcon = getStatusConfig(selectedMember.status).icon;
                        return <StatusIcon className={`h-8 w-8 ${getStatusConfig(selectedMember.status).iconClass}`} />;
                      })()}
                      <div>
                        <p className="font-semibold">{getStatusConfig(selectedMember.status).label}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(), "h:mm a")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Member Info */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                        <User className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">
                          {selectedMember.first_name} {selectedMember.last_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">{selectedMember.member_id}</p>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Membership</p>
                          <p className="font-medium">{selectedMember.membership_type}</p>
                        </div>
                        {getStatusConfig(selectedMember.status).badge}
                      </div>

                      {selectedMember.membership_end_date && (
                        <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Expires</p>
                            <p className="font-medium">
                              {format(new Date(selectedMember.membership_end_date), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Check-ins This Month</p>
                          <p className="font-medium">{memberCheckInCount}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Issue Alert for members with payment problems */}
                  {memberPaymentStatus?.hasPaymentIssues && (
                    <div className="p-4 bg-red-100 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-lg space-y-3">
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold">
                        <ShieldAlert className="h-5 w-5" />
                        Cannot Check In - Payment Required
                      </div>
                      <div className="text-sm space-y-1 text-red-600 dark:text-red-400">
                        {memberPaymentStatus.isDuesPastDue && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Monthly dues past due
                          </div>
                        )}
                        {memberPaymentStatus.isAnnualFeeOverdue && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Annual fee expired
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        className="w-full border-red-300 text-red-700 hover:bg-red-200 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/50"
                        onClick={() => handleCheckIn(true)}
                        disabled={isOverriding}
                      >
                        {isOverriding ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 mr-2" />
                        )}
                        Override Check-In (Admin)
                      </Button>
                      <p className="text-xs text-center text-red-600 dark:text-red-400">
                        Override will be logged for accountability
                      </p>
                    </div>
                  )}

                  {!memberPaymentStatus?.hasPaymentIssues && (
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => handleCheckIn(false)}
                      disabled={isCheckingIn || !getStatusConfig(selectedMember.status).canCheckIn}
                    >
                      {isCheckingIn ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <UserCheck className="h-4 w-4 mr-2" />
                      )}
                      Check In Member
                    </Button>
                  )}

                  {!getStatusConfig(selectedMember.status).canCheckIn && !memberPaymentStatus?.hasPaymentIssues && (
                    <p className="text-sm text-center text-destructive">
                      Cannot check in - membership is {selectedMember.status.replace("_", " ")}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">No Member Selected</p>
                  <p className="text-sm mt-1">Search and select a member to check in</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats and Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Today's Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Today's Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <p className="text-3xl font-bold text-green-700 dark:text-green-400">{todayStats.total}</p>
                  <p className="text-xs text-green-600 dark:text-green-500">Total Check-Ins</p>
                </div>
                <div className="text-center p-4 bg-secondary/50 rounded-lg">
                  <p className="text-3xl font-bold">{todayStats.currentlyIn}</p>
                  <p className="text-xs text-muted-foreground">Currently In</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Check-Ins */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Check-Ins
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentCheckIns.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {recentCheckIns.map((checkIn) => (
                    <div
                      key={checkIn.id}
                      className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg"
                    >
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {checkIn.members.first_name} {checkIn.members.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{checkIn.members.membership_type}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(checkIn.checked_in_at), "h:mm a")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No check-ins today yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
