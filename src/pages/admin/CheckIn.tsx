import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { useMembersBillingIssues } from "@/hooks/useMembersBillingIssues";
import { EffectiveStatusBadge, getEffectiveStatus } from "@/components/admin/EffectiveStatusBadge";
import { CheckInSupportPanel } from "@/components/admin/CheckInSupportPanel";

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
  stripe_subscription_id: string | null;
}

interface CheckInRecord {
  id: string;
  member_id: string;
  checked_in_at: string;
  notes: string | null;
  members: {
    id: string;
    member_id: string;
    first_name: string;
    last_name: string;
    membership_type: string;
    photo_url: string | null;
    status: string;
  };
}

export default function CheckIn() {
  const navigate = useNavigate();
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

  // Get billing issues data for effective status calculation
  const { data: billingIssues } = useMembersBillingIssues();

  // Get payment status for selected member
  const memberPaymentStatus = selectedMember 
    ? checkMemberPaymentStatus({
        status: selectedMember.status,
        annual_fee_paid_at: selectedMember.annual_fee_paid_at,
        stripe_subscription_id: selectedMember.stripe_subscription_id,
      })
    : null;

  // Calculate effective status for selected member
  const effectiveStatus = selectedMember 
    ? getEffectiveStatus(selectedMember.status, billingIssues?.memberIssues?.[selectedMember.id])
    : null;

  // Fetch recent check-ins on mount and poll every 15 seconds
  useEffect(() => {
    fetchRecentCheckIns();
    fetchTodayStats();
    const interval = setInterval(() => {
      fetchRecentCheckIns();
      fetchTodayStats();
    }, 15000);
    return () => clearInterval(interval);
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
        notes,
        members (
          id,
          member_id,
          first_name,
          last_name,
          membership_type,
          photo_url,
          status
        )
      `)
      .gte("checked_in_at", today.toISOString())
      .order("checked_in_at", { ascending: false });

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

    try {
      // Check for duplicate check-in (within last 30 minutes)
      const { data: existingCheckIn, error: checkError } = await (supabase.rpc as any)('check_for_duplicate_check_in', {
        p_member_id: selectedMember.id,
        p_check_in_window_minutes: 30
      });

      if (checkError) {
        console.error('Error checking for duplicate check-in:', checkError);
        // Continue with check-in if check fails
      }

      if (existingCheckIn) {
        // Duplicate check-in found
        setIsCheckingIn(false);
        setIsOverriding(false);
        toast.warning(`${selectedMember.first_name} ${selectedMember.last_name} is already checked in (within last 30 minutes)`);
        fetchRecentCheckIns();
        fetchTodayStats();
        return;
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
    } catch (error: any) {
      console.error('Check-in error:', error);
      setIsCheckingIn(false);
      setIsOverriding(false);
      toast.error(error?.message || "Check-in failed");
    }
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
        {/* Support Panels - In-Club Requests & Support Tickets */}
        <CheckInSupportPanel />

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
                  {/* Status Banner - Uses Effective Status for clear access decision */}
                  <div className={`p-4 rounded-lg border ${effectiveStatus?.canCheckIn 
                    ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                  }`}>
                    <div className="flex items-center gap-3">
                      {effectiveStatus?.canCheckIn ? (
                        <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-lg">
                          {effectiveStatus?.canCheckIn ? 'Check-In Approved' : 'Cannot Check In'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {effectiveStatus?.description}
                        </p>
                      </div>
                      <EffectiveStatusBadge
                        memberStatus={selectedMember.status}
                        billingIssues={billingIssues?.memberIssues?.[selectedMember.id]}
                        size="lg"
                      />
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
                        <EffectiveStatusBadge
                          memberStatus={selectedMember.status}
                          billingIssues={billingIssues?.memberIssues?.[selectedMember.id]}
                          size="sm"
                          showTooltip={false}
                        />
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
                        {!memberPaymentStatus.isInitiationFeePaid && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Initiation fee unpaid
                          </div>
                        )}
                        {!memberPaymentStatus.hasActiveSubscription && memberPaymentStatus.isInitiationFeePaid && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            No active subscription
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

                  {/* Show normal check-in button when access is granted */}
                  {effectiveStatus?.canCheckIn && (
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => handleCheckIn(false)}
                      disabled={isCheckingIn}
                    >
                      {isCheckingIn ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <UserCheck className="h-4 w-4 mr-2" />
                      )}
                      Check In Member
                    </Button>
                  )}

                  {/* Show denial message when access is not granted (but no payment issues - handled above) */}
                  {!effectiveStatus?.canCheckIn && !memberPaymentStatus?.hasPaymentIssues && (
                    <p className="text-sm text-center text-destructive">
                      Cannot check in - {effectiveStatus?.description}
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

        {/* Today's Stats */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2 max-w-md">
          <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border">
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">{todayStats.total}</p>
            <p className="text-xs text-green-600 dark:text-green-500">Total Check-Ins</p>
          </div>
          <div className="text-center p-4 bg-secondary/50 rounded-lg border">
            <p className="text-3xl font-bold">{todayStats.currentlyIn}</p>
            <p className="text-xs text-muted-foreground">Currently In</p>
          </div>
        </div>

        {/* Today's Check-Ins - Full List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Today's Check-Ins ({recentCheckIns.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentCheckIns.length > 0 ? (
              <div className="overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Member ID</TableHead>
                      <TableHead>Membership</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentCheckIns.map((checkIn) => {
                      const initials = `${checkIn.members?.first_name?.[0] || ''}${checkIn.members?.last_name?.[0] || ''}`.toUpperCase();
                      const statusColor = checkIn.members?.status === 'active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                        : checkIn.members?.status === 'frozen'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
                      return (
                        <TableRow
                          key={checkIn.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/admin/members/${checkIn.members?.id}`)}
                        >
                          <TableCell>
                            <Avatar className="h-8 w-8">
                              {checkIn.members?.photo_url && (
                                <AvatarImage src={checkIn.members.photo_url} alt={`${checkIn.members.first_name} ${checkIn.members.last_name}`} />
                              )}
                              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">
                            {checkIn.members?.first_name} {checkIn.members?.last_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs font-mono">
                            {checkIn.members?.member_id}
                          </TableCell>
                          <TableCell className="text-sm">
                            {checkIn.members?.membership_type}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColor}>
                              {checkIn.members?.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {format(new Date(checkIn.checked_in_at), "h:mm a")}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {checkIn.notes || '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
    </AdminLayout>
  );
}
