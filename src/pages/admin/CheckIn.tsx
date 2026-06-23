import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  DollarSign,
  Ticket,
  BookOpen,
  Sparkles,
  Ban,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatTime12h } from "@/lib/timeFormat";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { useMembersBillingIssues } from "@/hooks/useMembersBillingIssues";
import { EffectiveStatusBadge, getEffectiveStatus } from "@/components/admin/EffectiveStatusBadge";
import { CheckInSupportPanel } from "@/components/admin/CheckInSupportPanel";
import { useUnifiedCheckInSearch, UnifiedSearchResult, VisitorType } from "@/hooks/useUnifiedCheckInSearch";
import { useUnifiedAttendance, AttendanceType } from "@/hooks/useUnifiedAttendance";
import { useMemberScanner, ScanResult } from "@/hooks/useMemberScanner";
import { useMemberArrears } from "@/hooks/useMemberArrears";
import { formatSpaTime } from "@/lib/spaTime";
import { clubMonthStart } from "@/lib/clubTime";
import { SignedMemberPhoto } from "@/components/member/SignedMemberPhoto";

// ─── Type badge config ───────────────────────────────────────────────
const typeBadgeConfig: Record<VisitorType | AttendanceType, { label: string; className: string; icon: typeof User }> = {
  member: { label: "Member", className: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300", icon: User },
  guest_pass: { label: "Guest Pass", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300", icon: Ticket },
  guest: { label: "Guest", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300", icon: Ticket },
  class_booking: { label: "Class", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300", icon: BookOpen },
  class: { label: "Class", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300", icon: BookOpen },
  spa_appointment: { label: "Spa", className: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300", icon: Sparkles },
  spa: { label: "Spa", className: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300", icon: Sparkles },
};

function TypeBadge({ type }: { type: VisitorType | AttendanceType }) {
  const cfg = typeBadgeConfig[type];
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
}

export default function CheckIn() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<UnifiedSearchResult | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [memberCheckInCount, setMemberCheckInCount] = useState(0);
  const [memberScanResult, setMemberScanResult] = useState<ScanResult | null>(null);

  const { results, isSearching, search, clearResults } = useUnifiedCheckInSearch();
  const { entries, stats, refetch, loadErrors, hasPartialFailure } = useUnifiedAttendance();
  const { data: billingIssues } = useMembersBillingIssues();
  const { scanMemberAsync } = useMemberScanner();

  // For member-type selections only
  const memberData = selected?.type === "member" ? selected.data : null;
  const effectiveStatus = memberData
    ? getEffectiveStatus(memberData.status, billingIssues?.memberIssues?.[memberData.id])
    : null;

  // Arrears for the selected member
  const selectedMemberId = memberData?.id;
  const { data: arrearsData } = useMemberArrears(selectedMemberId);

  // ─── Search handler ────────────────────────────────────────────────
  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setSelected(null);
    search(searchQuery);
  };

  // ─── Select a result ──────────────────────────────────────────────
  const selectResult = async (result: UnifiedSearchResult) => {
    setSelected(result);
    clearResults();
    setSearchQuery("");
    setMemberScanResult(null);

    if (result.type === "member") {
      // Count check-ins this month (America/Chicago month boundary)
      const { count } = await supabase
        .from("check_ins")
        .select("*", { count: "exact", head: true })
        .eq("member_id", result.data.id)
        .gte("checked_in_at", clubMonthStart());
      setMemberCheckInCount(count || 0);

      // Pre-validate via backend RPC (dry-run, no actual check-in)
      try {
        const preCheck = await scanMemberAsync({
          memberId: result.data.member_id || result.data.id,
          deviceType: "manual_entry",
          autoCheckIn: false,
          override: false,
        });
        setMemberScanResult(preCheck);
      } catch (err) {
        console.error("Pre-validation failed:", err);
      }
    }
  };

  // ─── Check-in actions ─────────────────────────────────────────────
  const handleMemberCheckIn = async () => {
    if (!memberData || !user) return;
    setIsCheckingIn(true);

    try {
      const result = await scanMemberAsync({
        memberId: memberData.member_id || memberData.id,
        deviceType: "manual_entry",
        autoCheckIn: true,
        override: false,
      });

      setMemberScanResult(result);

      if (result.access_granted) {
        toast.success(`${memberData.first_name} ${memberData.last_name} checked in!`);
        setMemberCheckInCount((c) => c + 1);
        refetch();
      } else {
        const reason = result.denial_reason?.replace(/_/g, " ") || "Access denied";
        toast.error(`Cannot check in: ${reason}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Check-in failed");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleGuestCheckIn = async () => {
    if (!selected || selected.type !== "guest_pass" || !user) return;
    setIsCheckingIn(true);
    try {
      const { error } = await supabase
        .from("guest_passes")
        .update({ status: "used", used_at: new Date().toISOString(), checked_in_by: user.id })
        .eq("id", selected.data.id);
      if (error) throw error;
      toast.success(`${selected.data.guest_name} checked in as guest!`);
      refetch();
      setSelected(null);
    } catch (err: any) {
      toast.error(err?.message || "Guest check-in failed");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleClassCheckIn = async () => {
    if (!selected || selected.type !== "class_booking" || !user) return;
    setIsCheckingIn(true);
    try {
      const { error } = await supabase
        .from("class_bookings")
        .update({ checked_in_at: new Date().toISOString(), status: "completed" as any })
        .eq("id", selected.data.id);
      if (error) throw error;
      toast.success(`${selected.data.memberName} checked in for ${selected.data.className}!`);
      refetch();
      setSelected(null);
    } catch (err: any) {
      toast.error(err?.message || "Class check-in failed");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleSpaCheckIn = async () => {
    if (!selected || selected.type !== "spa_appointment" || !user) return;
    setIsCheckingIn(true);
    try {
      const { error } = await (supabase.from as any)("spa_appointments")
        .update({ checked_in_at: new Date().toISOString() })
        .eq("id", selected.data.id);
      if (error) throw error;
      toast.success(`${selected.data.memberName} checked in for ${selected.data.service_name}!`);
      refetch();
      setSelected(null);
    } catch (err: any) {
      toast.error(err?.message || "Spa check-in failed");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleCheckInAction = () => {
    if (!selected) return;
    switch (selected.type) {
      case "member": return handleMemberCheckIn();
      case "guest_pass": return handleGuestCheckIn();
      case "class_booking": return handleClassCheckIn();
      case "spa_appointment": return handleSpaCheckIn();
    }
  };

  // ─── Render detail panel ──────────────────────────────────────────
  const renderDetailPanel = () => {
    if (!selected) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No Person Selected</p>
          <p className="text-sm mt-1">Search and select someone to check in</p>
        </div>
      );
    }

    // ── Member detail ──
    if (selected.type === "member" && memberData) {
      // Use backend verdict if available, fall back to client-side
      const backendGranted = memberScanResult ? memberScanResult.access_granted : null;
      const canCheckIn = backendGranted !== null ? backendGranted : (effectiveStatus?.canCheckIn ?? false);
      const statusDescription = memberScanResult && !memberScanResult.access_granted
        ? `Access denied: ${memberScanResult.denial_reason?.replace(/_/g, " ") || "billing issue"}`
        : effectiveStatus?.description || "";
      const statusLabel = memberScanResult && !memberScanResult.access_granted
        ? (memberScanResult.denial_reason?.replace(/_/g, " ") || effectiveStatus?.label || "Denied")
        : effectiveStatus?.label || "";

      return (
        <div className="space-y-4">
          {/* Status Banner — driven by backend pre-check */}
          <div className={`p-4 rounded-lg border ${canCheckIn
            ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
          }`}>
            <div className="flex items-center gap-3">
              {canCheckIn ? (
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              )}
              <div className="flex-1">
                <p className="font-semibold text-lg">
                  {canCheckIn ? "Check-In Approved" : "Cannot Check In"}
                </p>
                <p className="text-sm text-muted-foreground">{statusDescription}</p>
              </div>
              <EffectiveStatusBadge
                memberStatus={memberData.status}
                billingIssues={billingIssues?.memberIssues?.[memberData.id]}
                size="lg"
              />
            </div>
          </div>

          {/* Member Info */}
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{memberData.first_name} {memberData.last_name}</h3>
              <p className="text-sm text-muted-foreground">{memberData.member_id}</p>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Membership</p>
                <p className="font-medium">{memberData.membership_type}</p>
              </div>
              <EffectiveStatusBadge memberStatus={memberData.status} billingIssues={billingIssues?.memberIssues?.[memberData.id]} size="sm" showTooltip={false} />
            </div>
            {memberData.membership_end_date && (
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Expires</p>
                  <p className="font-medium">{format(new Date(memberData.membership_end_date), "MMM d, yyyy")}</p>
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

          {/* Billing Block - Cannot Check In */}
          {!canCheckIn && (
            <div className="p-4 bg-red-100 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold">
                <Ban className="h-5 w-5" />
                Cannot Check In — {statusLabel}
              </div>
              {arrearsData && arrearsData.total_owed_cents > 0 && (
                <div className="p-3 bg-red-200/50 dark:bg-red-900/30 rounded-lg">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                    ${(arrearsData.total_owed_cents / 100).toFixed(2)} owed — {arrearsData.unpaid_count} unpaid {arrearsData.unpaid_count === 1 ? "period" : "periods"}
                  </p>
                  {arrearsData.unpaid_periods.slice(0, 3).map((p) => (
                    <p key={p.id} className="text-xs text-red-600 dark:text-red-400 mt-1">
                      • {p.billing_type === "annual_fee" ? "Annual Fee" : "Dues"}: ${((p.amount_due_cents - p.amount_paid_cents) / 100).toFixed(2)} ({new Date(p.period_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {new Date(p.period_end).toLocaleDateString("en-US", { month: "short", day: "numeric" })})
                    </p>
                  ))}
                  {arrearsData.latest_failure?.failure_message && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 italic">
                      Last decline: {arrearsData.latest_failure.failure_message}
                    </p>
                  )}
                </div>
              )}
              <p className="text-sm text-red-600 dark:text-red-400">
                {statusDescription}
              </p>
              {memberScanResult && !memberScanResult.access_granted && memberScanResult.payment_status && (
                <div className="text-sm space-y-1 text-red-600 dark:text-red-400">
                  {memberScanResult.payment_status.hasRecentFailedPayment && (
                    <div className="flex items-center gap-2"><DollarSign className="h-4 w-4" />Recent payment failed</div>
                  )}
                  {memberScanResult.payment_status.isDuesPastDue && (
                    <div className="flex items-center gap-2"><DollarSign className="h-4 w-4" />Monthly dues past due</div>
                  )}
                  {memberScanResult.payment_status.isAnnualFeeOverdue && (
                    <div className="flex items-center gap-2"><Calendar className="h-4 w-4" />Annual fee overdue</div>
                  )}
                  {memberScanResult.payment_status.hasNoSubscription && (
                    <div className="flex items-center gap-2"><CreditCard className="h-4 w-4" />No active subscription</div>
                  )}
                  {memberScanResult.payment_status.hasIncompleteSubscription && (
                    <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Subscription payment failed</div>
                  )}
                </div>
              )}
              <p className="text-xs text-center text-red-600 dark:text-red-400 font-medium">
                Resolve billing issues before check-in. Override is not available for billing blocks.
              </p>
            </div>
          )}

          {canCheckIn && (
            <Button className="w-full" size="lg" onClick={() => handleMemberCheckIn()} disabled={isCheckingIn}>
              {isCheckingIn ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserCheck className="h-4 w-4 mr-2" />}
              Check In Member
            </Button>
          )}
        </div>
      );
    }

    // ── Guest Pass detail ──
    if (selected.type === "guest_pass") {
      const g = selected.data;
      return (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-3">
              <Ticket className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              <div className="flex-1">
                <p className="font-semibold text-lg">Guest Pass</p>
                <p className="text-sm text-muted-foreground">Ready to check in</p>
              </div>
              <TypeBadge type="guest_pass" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
              <Ticket className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{g.guest_name}</h3>
              <p className="text-sm text-muted-foreground">{g.guest_email || "No email"}</p>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Valid Date</p>
                <p className="font-medium">{g.valid_date ? format(new Date(g.valid_date), "MMM d, yyyy") : "—"}</p>
              </div>
            </div>
            {g.member_referral && (
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Referred By</p>
                  <p className="font-medium">{g.member_referral}</p>
                </div>
              </div>
            )}
          </div>
          <Button className="w-full" size="lg" onClick={handleCheckInAction} disabled={isCheckingIn}>
            {isCheckingIn ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserCheck className="h-4 w-4 mr-2" />}
            Check In Guest
          </Button>
        </div>
      );
    }

    // ── Class Booking detail ──
    if (selected.type === "class_booking") {
      const cb = selected.data;
      return (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="flex-1">
                <p className="font-semibold text-lg">Class Booking</p>
                <p className="text-sm text-muted-foreground">Ready to check in</p>
              </div>
              <TypeBadge type="class_booking" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{cb.memberName}</h3>
              <p className="text-sm text-muted-foreground">{cb.className}</p>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Class Time</p>
                <p className="font-medium">{formatTime12h(cb.session?.start_time)} – {formatTime12h(cb.session?.end_time)}</p>
              </div>
            </div>
          </div>
          <Button className="w-full" size="lg" onClick={handleCheckInAction} disabled={isCheckingIn}>
            {isCheckingIn ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserCheck className="h-4 w-4 mr-2" />}
            Check In for Class
          </Button>
        </div>
      );
    }

    // ── Spa Appointment detail ──
    if (selected.type === "spa_appointment") {
      const sa = selected.data;
      return (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-pink-600 dark:text-pink-400" />
              <div className="flex-1">
                <p className="font-semibold text-lg">Spa Appointment</p>
                <p className="text-sm text-muted-foreground">Ready to check in</p>
              </div>
              <TypeBadge type="spa_appointment" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{sa.memberName}</h3>
              <p className="text-sm text-muted-foreground">{sa.service_name}</p>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Appointment Time</p>
                <p className="font-medium">{formatSpaTime(sa.appointment_time)}</p>
              </div>
            </div>
            {sa.duration_minutes && (
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-medium">{sa.duration_minutes} min</p>
                </div>
              </div>
            )}
          </div>
          <Button className="w-full" size="lg" onClick={handleCheckInAction} disabled={isCheckingIn}>
            {isCheckingIn ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserCheck className="h-4 w-4 mr-2" />}
            Check In for Spa
          </Button>
        </div>
      );
    }

    return null;
  };

  // ─── Main render ──────────────────────────────────────────────────
  return (
    <AdminLayout title="Check-In Hub">
      <div className="space-y-6">
        <CheckInSupportPanel />

        {/* Main Check-In Area */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Search Panel */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Search className="h-5 w-5" />
                Visitor Lookup
              </CardTitle>
              <CardDescription className="mt-1">
                Search members, guest passes, class bookings, and spa appointments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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

              {/* Search Results */}
              {results.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Search Results</p>
                  <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                    {results.map((r) => {
                      const cfg = typeBadgeConfig[r.type];
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={r.id}
                          onClick={() => selectResult(r)}
                          className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors text-left w-full"
                        >
                          <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{r.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                          </div>
                          <TypeBadge type={r.type} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!selected && results.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">Search for a visitor</p>
                  <p className="text-sm mt-1">Enter a name, member ID, email, or phone number</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detail Panel */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Visitor Details</CardTitle>
            </CardHeader>
            <CardContent>{renderDetailPanel()}</CardContent>
          </Card>
        </div>

        {/* Today's Stats */}
        <div className="grid gap-4 sm:grid-cols-3 max-w-2xl">
          <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border">
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">{stats.total}</p>
            <p className="text-xs text-green-600 dark:text-green-500">Total Check-Ins</p>
          </div>
          <div className="text-center p-4 bg-secondary/50 rounded-lg border">
            <p className="text-3xl font-bold">{stats.currentlyIn}</p>
            <p className="text-xs text-muted-foreground">Members Currently In</p>
          </div>
          <div className="text-center p-4 bg-secondary/50 rounded-lg border space-y-1">
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-sm font-medium">
              {stats.members > 0 && <span>{stats.members} Members</span>}
              {stats.guests > 0 && <span>{stats.guests} Guests</span>}
              {stats.classes > 0 && <span>{stats.classes} Class</span>}
              {stats.spa > 0 && <span>{stats.spa} Spa</span>}
              {stats.total === 0 && <span className="text-muted-foreground">—</span>}
            </div>
            <p className="text-xs text-muted-foreground">Breakdown</p>
          </div>
        </div>

        {hasPartialFailure ? (
          <div className="flex max-w-2xl items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Some attendance sources could not load, so this view is showing the data that did succeed.
              {loadErrors.members ? ' Member check-ins are temporarily unavailable.' : ' Member check-ins remain visible.'}
            </span>
          </div>
        ) : null}

        {/* Today's Attendance Feed */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Today's Attendance ({entries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entries.length > 0 ? (
              <div className="overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      const initials = entry.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2);
                      return (
                        <TableRow
                          key={entry.id}
                          className={entry.navigateTo ? "cursor-pointer hover:bg-muted/50" : ""}
                          onClick={() => entry.navigateTo && navigate(entry.navigateTo)}
                        >
                          <TableCell>
                            <Avatar className="h-8 w-8">
                              <SignedMemberPhoto photoUrl={entry.photoUrl} alt={entry.name} />
                              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">{entry.name}</TableCell>
                          <TableCell><TypeBadge type={entry.type} /></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{entry.subtitle}</TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {format(new Date(entry.time), "h:mm a")}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {entry.notes || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : hasPartialFailure ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Attendance data is partially unavailable right now</p>
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
