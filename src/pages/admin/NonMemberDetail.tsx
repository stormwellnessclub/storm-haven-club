import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, addDays, differenceInDays } from "date-fns";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  ArrowLeft, Edit2, X, Check, CreditCard, RefreshCw, ShieldCheck, ShieldX,
  Package, Calendar, Loader2, Mail, Phone, User, Pencil, DollarSign, Clock,
  Plus, Zap, Gift, Dumbbell,
} from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { EditClassPassDialog } from "@/components/admin/EditClassPassDialog";
import { EditCreditDialog } from "@/components/admin/EditCreditDialog";
import { ChargeItemSelector } from "@/components/admin/ChargeItemSelector";
import { AdminGrantPassDialog } from "@/components/admin/AdminGrantPassDialog";
import { BookPTSessionDialog } from "@/components/admin/BookPTSessionDialog";
import { SellPTDialog } from "@/components/admin/SellPTDialog";
import { PT_FORMAT_LABEL } from "@/lib/ptFormat";
import { getCategoryDisplayName } from "@/lib/classCategories";
import { NonMemberGuestPassSaleCard } from "@/components/admin/NonMemberGuestPassSaleCard";

export default function NonMemberDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { user } = useAuth();
  const { isSuperAdmin } = useUserRoles();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [editingPass, setEditingPass] = useState<any>(null);
  const [editingCredit, setEditingCredit] = useState<any>(null);
  const [showChargeSelector, setShowChargeSelector] = useState(false);
  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const [showBookPT, setShowBookPT] = useState(false);
  const [showSellPT, setShowSellPT] = useState(false);

  // Add package state
  const [showAddPackage, setShowAddPackage] = useState(false);
  const [category, setCategory] = useState("");
  const [passType, setPassType] = useState("");
  const [expirationDays, setExpirationDays] = useState("90");

  // Wellness credits state
  const [showAddWellnessCredits, setShowAddWellnessCredits] = useState(false);
  const [wellnessCreditType, setWellnessCreditType] = useState<"red_light" | "dry_cryo">("red_light");
  const [wellnessCreditCount, setWellnessCreditCount] = useState("4");
  const [wellnessExpirationDays, setWellnessExpirationDays] = useState("30");

  // Fetch profile — auto-create from auth profile if a non-member row doesn't exist yet
  // (handles "orphan" users who have class passes but never had a non_member_profiles row).
  const { data: profile, isLoading } = useQuery({
    queryKey: ["admin-nonmember-detail", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: existing, error } = await supabase
        .from("non_member_profiles")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      if (existing) return existing;

      // Backfill from public.profiles so the detail page always opens cleanly.
      const { data: base } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email, phone")
        .eq("user_id", userId!)
        .maybeSingle();

      const insertPayload = {
        user_id: userId!,
        first_name: base?.first_name ?? null,
        last_name: base?.last_name ?? null,
        email: base?.email ?? null,
        phone: base?.phone ?? null,
      };
      const { data: created, error: insertErr } = await supabase
        .from("non_member_profiles")
        .insert(insertPayload)
        .select("*")
        .maybeSingle();
      if (insertErr) throw insertErr;
      return created ?? { ...insertPayload, waiver_signed: null, waiver_signed_at: null, created_at: new Date().toISOString() } as any;
    },
  });

  // Effective waiver status (explicit flag OR inferred from bookings/passes)
  const { data: waiverStatus } = useQuery({
    queryKey: ["admin-nonmember-waiver-status", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("effective_waiver_status", { _user_ids: [userId!] });
      if (error) throw error;
      return (data?.[0] ?? null) as { user_id: string; status: string; source: string; signed_at: string | null } | null;
    },
  });

  // Fetch wellness credits for non-member
  const { data: wellnessCredits = [], isLoading: wellnessCreditsLoading } = useQuery({
    queryKey: ["admin-nonmember-wellness-credits", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_credits")
        .select("*")
        .eq("user_id", userId!)
        .is("member_id", null)
        .in("credit_type", ["red_light", "dry_cryo"])
        .order("expires_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch class passes
  const { data: passes = [], isLoading: passesLoading } = useQuery({
    queryKey: ["admin-nonmember-passes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_passes")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch bookings with instructor info
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["admin-nonmember-bookings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_bookings")
        .select("*, class_sessions(session_date, start_time, end_time, class_types(name), instructors(first_name, last_name))")
        .eq("user_id", userId!)
        .order("booked_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch credit usage (bookings where credits_used > 0)
  const { data: creditUsage = [] } = useQuery({
    queryKey: ["admin-nonmember-credit-usage", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_bookings")
        .select("id, credits_used, booked_at, class_sessions(session_date, class_types(name))")
        .eq("user_id", userId!)
        .gt("credits_used", 0)
        .order("booked_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch charge history
  const { data: charges = [] } = useQuery({
    queryKey: ["admin-nonmember-charges", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_charges")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Personal training packs
  const { data: ptPasses = [], isLoading: ptPassesLoading } = useQuery({
    queryKey: ["admin-nonmember-pt-passes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_passes")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Personal training appointments
  const { data: ptAppointments = [], isLoading: ptApptsLoading } = useQuery({
    queryKey: ["admin-nonmember-pt-appointments", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_appointments")
        .select("*, instructors(first_name, last_name)")
        .eq("user_id", userId!)
        .order("starts_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Card setup link history (was a link sent? did they finish?)
  const { data: cardSetupAttempts = [] } = useQuery({
    queryKey: ["admin-nonmember-card-setup-attempts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("card_setup_attempts")
        .select("id, status, created_at, completed_at, source, metadata")
        .contains("metadata", { user_id: userId! })
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  const latestCardAttempt = cardSetupAttempts[0] as any | undefined;

  // Refresh card from Stripe
  const refreshCardMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { action: "admin_refresh_nonmember_card", userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Card info refreshed from Stripe");
      queryClient.invalidateQueries({ queryKey: ["admin-nonmember-detail", userId] });
    },
    onError: (err: Error) => toast.error(`Failed to refresh: ${err.message}`),
  });

  // Send / copy Stripe card setup link for admin
  const sendCardLinkMutation = useMutation({
    mutationFn: async ({ sendEmail }: { sendEmail: boolean }) => {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { action: "admin_send_nonmember_card_setup_link", userId, sendEmail },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return { ...data, _sendEmail: sendEmail };
    },
    onSuccess: async (data: any) => {
      if (data._sendEmail) {
        toast.success(data.emailSent ? `Setup link emailed to ${data.recipient}` : "Link generated (email failed — copy below)");
      }
      if (data.url) {
        try {
          await navigator.clipboard.writeText(data.url);
          toast.success("Setup link copied to clipboard");
        } catch {
          window.prompt("Copy setup link:", data.url);
        }
      }
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  // Toggle waiver
  const toggleWaiverMutation = useMutation({
    mutationFn: async (signed: boolean) => {
      const { error } = await supabase
        .from("non_member_profiles")
        .update({ waiver_signed: signed })
        .eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Waiver status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-nonmember-detail", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-nonmember-waiver-status", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-non-member-accounts"] });
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  // Save profile edits
  const saveProfile = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("non_member_profiles")
        .update({
          first_name: editForm.first_name || null,
          last_name: editForm.last_name || null,
          email: editForm.email || null,
          phone: editForm.phone || null,
        })
        .eq("user_id", userId!);
      if (error) throw error;
      toast.success("Profile updated");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["admin-nonmember-detail", userId] });
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Send activation email
  const sendActivationMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.email) throw new Error("No email on file");
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { type: "account_activation_invite", to: profile.email, data: { email: profile.email } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => toast.success("Activation link sent"),
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  // Add package
  const classCountMap: Record<string, number> = { single: 1, tenPack: 10 };
  const addPackageMutation = useMutation({
    mutationFn: async () => {
      if (!category || !passType) throw new Error("Please fill all fields");
      const classCount = classCountMap[passType] || 1;
      const expiresAt = addDays(new Date(), parseInt(expirationDays));
      const categoryMap: Record<string, string> = { pilatesCycling: "pilates_cycling", otherClasses: "other" };
      const dbCategory = categoryMap[category] || "other";
      const { error } = await supabase.from("class_passes").insert({
        user_id: userId!,
        category: dbCategory as any,
        pass_type: passType === "tenPack" ? "10-pack" : "single",
        classes_total: classCount,
        classes_remaining: classCount,
        price_paid: 0,
        is_member_price: false,
        expires_at: expiresAt.toISOString(),
        status: "active" as const,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Package added");
      queryClient.invalidateQueries({ queryKey: ["admin-nonmember-passes", userId] });
      setShowAddPackage(false);
      setCategory("");
      setPassType("");
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  // Add wellness credits mutation
  const addWellnessCreditsMutation = useMutation({
    mutationFn: async () => {
      if (!wellnessCreditType || !wellnessCreditCount) throw new Error("Please fill all fields");
      const credits = parseInt(wellnessCreditCount);
      if (isNaN(credits) || credits < 1) throw new Error("Invalid credit count");
      const now = new Date();
      const expiresAt = addDays(now, parseInt(wellnessExpirationDays));
      const cycleStart = format(now, "yyyy-MM-dd");
      const cycleEnd = format(expiresAt, "yyyy-MM-dd");

      const { error } = await supabase.from("member_credits").insert({
        user_id: userId!,
        member_id: null,
        credit_type: wellnessCreditType,
        credits_total: credits,
        credits_remaining: credits,
        cycle_start: cycleStart,
        cycle_end: cycleEnd,
        expires_at: expiresAt.toISOString(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Wellness credits granted");
      queryClient.invalidateQueries({ queryKey: ["admin-nonmember-wellness-credits", userId] });
      setShowAddWellnessCredits(false);
      setWellnessCreditCount("4");
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  const startEditing = () => {
    if (!profile) return;
    setEditForm({
      first_name: profile.first_name || "",
      last_name: profile.last_name || "",
      email: profile.email || "",
      phone: profile.phone || "",
    });
    setIsEditing(true);
  };

  if (isLoading) {
    return (
      <AdminLayout title="Non-Member Detail">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  if (!profile) {
    return (
      <AdminLayout title="Non-Member Detail">
        <div className="text-center py-12 text-muted-foreground">
          <p>Account not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/non-member-accounts")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Accounts
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unknown";
  const activePasses = passes.filter((p) => p.status === "active").length;

  // Build pseudo-member for ChargeItemSelector
  const pseudoMember = {
    id: `nonmember-${userId}`,
    first_name: profile.first_name || "Non",
    last_name: profile.last_name || "Member",
    membership_type: "non-member",
    gender: null as string | null,
    billing_type: null as string | null,
  };

  return (
    <>
    <AdminLayout title="Non-Member Detail">
      <div className="space-y-6">
        {/* Breadcrumb + Back */}
        <div className="flex items-center justify-between">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/admin/non-member-accounts" onClick={(e) => { e.preventDefault(); navigate("/admin/non-member-accounts"); }}>
                  Non-Member Accounts
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{fullName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSellPT(true)}>
              <DollarSign className="h-4 w-4 mr-2" /> Sell PT Pack
            </Button>
            <Button size="sm" onClick={() => setShowBookPT(true)}>
              <Dumbbell className="h-4 w-4 mr-2" /> Book PT Session
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/non-member-accounts")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          </div>
        </div>

        {/* Tabbed Layout */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="passes">Passes & Bookings</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          {/* ===== PROFILE TAB ===== */}
          <TabsContent value="profile">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                {/* Profile Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-4 w-4" /> Profile
                      </CardTitle>
                      {!isEditing ? (
                        <Button variant="ghost" size="sm" onClick={startEditing}>
                          <Edit2 className="h-4 w-4 mr-1" /> Edit
                        </Button>
                      ) : (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isSaving}>
                            <X className="h-4 w-4" />
                          </Button>
                          <Button size="sm" onClick={saveProfile} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                            Save
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">First Name</Label>
                            <Input value={editForm.first_name} onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Last Name</Label>
                            <Input value={editForm.last_name} onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Email</Label>
                          <Input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Phone</Label>
                          <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span>
                          <span>{profile.email || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</span>
                          <span>{profile.phone || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Joined</span>
                          <span>{format(new Date(profile.created_at), "MMM d, yyyy")}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Waiver Status */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">Waiver Status</CardTitle>
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => toggleWaiverMutation.mutate(!profile.waiver_signed)}
                        disabled={toggleWaiverMutation.isPending}
                      >
                        {toggleWaiverMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : profile.waiver_signed ? (
                          <span className="text-xs text-destructive">Revoke</span>
                        ) : (
                          <span className="text-xs text-green-700">Mark Signed</span>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {waiverStatus?.status === "signed" ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <ShieldCheck className="h-3 w-3 mr-1" /> Signed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        <ShieldX className="h-3 w-3 mr-1" /> Missing
                      </Badge>
                    )}
                    {waiverStatus?.status === "signed" && (
                      <p className="text-xs text-muted-foreground">
                        {waiverStatus.source === "explicit" && "Digitally signed"}
                        {waiverStatus.source === "inferred_booking" && "Verified via class booking"}
                        {waiverStatus.source === "inferred_pass" && "Verified via class pass purchase"}
                        {waiverStatus.signed_at && ` · ${format(new Date(waiverStatus.signed_at), "MMM d, yyyy")}`}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                {/* Card on File */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">Card on File</CardTitle>
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => refreshCardMutation.mutate()}
                        disabled={refreshCardMutation.isPending}
                      >
                        {refreshCardMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        <span className="ml-1 text-xs">Refresh</span>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {profile.card_last4 ? (
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium capitalize">{profile.card_brand || "Card"} •••• {profile.card_last4}</p>
                          {profile.card_exp_month && profile.card_exp_year && (
                            <p className="text-xs text-muted-foreground">
                              Expires {String(profile.card_exp_month).padStart(2, "0")}/{profile.card_exp_year}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No card on file</p>
                    )}
                    <div className="mt-4 pt-4 border-t space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {profile.card_last4 ? "Send a secure link so they can update their card." : "Send a secure link so they can add a card on file."}
                      </p>
                      {latestCardAttempt && (
                        <p className="text-xs">
                          <span className="text-muted-foreground">
                            Link sent {format(new Date(latestCardAttempt.created_at), "MMM d, yyyy h:mm a")} ·{" "}
                          </span>
                          {latestCardAttempt.status === "completed" ? (
                            <span className="text-green-600 font-medium">
                              completed{latestCardAttempt.completed_at ? ` ${format(new Date(latestCardAttempt.completed_at), "MMM d")}` : ""}
                            </span>
                          ) : (
                            <span className="text-amber-600 font-medium">not completed yet</span>
                          )}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="outline" size="sm" className="flex-1"
                          onClick={() => sendCardLinkMutation.mutate({ sendEmail: true })}
                          disabled={sendCardLinkMutation.isPending || !profile.email}
                        >
                          {sendCardLinkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                          Email setup link
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => sendCardLinkMutation.mutate({ sendEmail: false })}
                          disabled={sendCardLinkMutation.isPending}
                          title="Get link to copy"
                        >
                          Copy link
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>


                {/* Quick Actions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="outline" size="sm" className="w-full justify-start"
                      onClick={() => sendActivationMutation.mutate()}
                      disabled={sendActivationMutation.isPending || !profile.email}
                    >
                      {sendActivationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                      Send Activation Email
                    </Button>
                    <Button
                      variant="outline" size="sm" className="w-full justify-start"
                      onClick={() => setShowChargeSelector(true)}
                    >
                      <DollarSign className="h-4 w-4 mr-2" /> Charge / Record Payment
                    </Button>
                    <Button
                      variant="outline" size="sm" className="w-full justify-start"
                      onClick={() => refreshCardMutation.mutate()}
                      disabled={refreshCardMutation.isPending}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" /> Refresh Card from Stripe
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ===== PASSES & BOOKINGS TAB ===== */}
          <TabsContent value="passes">
            <div className="space-y-6">
              {/* Class Passes with Progress Bars */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Class Passes ({passes.length})
                    </CardTitle>
                     <div className="flex items-center gap-2">
                      <Badge variant="outline">{activePasses} active</Badge>
                      <Button variant="outline" size="sm" onClick={() => navigate("/admin/classes")}>
                        <Calendar className="h-3 w-3 mr-1" /> Book into Class
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowAddPackage(!showAddPackage)}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                      {isSuperAdmin() && (
                        <Button variant="outline" size="sm" onClick={() => setShowGrantDialog(true)}>
                          <Gift className="h-3 w-3 mr-1" /> Grant
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {passesLoading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : passes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No class passes</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {passes.map((pass) => {
                        const pct = pass.classes_total > 0 ? (pass.classes_remaining / pass.classes_total) * 100 : 0;
                        const isActive = pass.status === "active";
                        const daysLeft = differenceInDays(new Date(pass.expires_at), new Date());
                        const expiringSoon = isActive && daysLeft <= 14 && daysLeft > 0;
                        const expired = daysLeft <= 0;

                        return (
                          <div
                            key={pass.id}
                            className={`p-4 rounded-lg border ${isActive ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30"}`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="text-sm font-medium">
                                  {getCategoryDisplayName(pass.category)} — {pass.pass_type}
                                </p>
                                <p className={`text-xs ${expiringSoon ? "text-destructive font-medium" : expired ? "text-destructive" : "text-muted-foreground"}`}>
                                  {expired
                                    ? "Expired"
                                    : expiringSoon
                                    ? `Expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
                                    : `Expires ${format(new Date(pass.expires_at), "MMM d, yyyy")}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                {isSuperAdmin() && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingPass(pass)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
                                  {pass.status}
                                </Badge>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{pass.classes_remaining} remaining</span>
                                <span>{pass.classes_total} total</span>
                              </div>
                              <Progress value={pct} className="h-2" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add Package Form */}
              {showAddPackage && (
                <Card className="border-primary/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">Add Package</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setShowAddPackage(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription className="text-xs">Grant class pass credits to this account.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pilatesCycling">Pilates / Cycling</SelectItem>
                            <SelectItem value="otherClasses">Other Classes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Pass Type</Label>
                        <Select value={passType} onValueChange={setPassType}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">Single Class</SelectItem>
                            <SelectItem value="tenPack">10-Pack</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Expires In (days)</Label>
                        <Input type="number" value={expirationDays} onChange={(e) => setExpirationDays(e.target.value)} min="1" max="365" />
                      </div>
                    </div>
                    {category && passType && (
                      <div className="p-3 rounded-sm border border-border bg-muted/20 text-sm">
                        <strong>Summary:</strong> {classCountMap[passType] || 1} credit{(classCountMap[passType] || 1) > 1 ? "s" : ""} for{" "}
                        <span className="capitalize">{category === "pilatesCycling" ? "Pilates/Cycling" : "Other Classes"}</span>,
                        expiring {format(addDays(new Date(), parseInt(expirationDays)), "MMM d, yyyy")}.
                      </div>
                    )}
                    <Button
                      onClick={() => addPackageMutation.mutate()}
                      disabled={!category || !passType || addPackageMutation.isPending}
                      size="sm"
                    >
                      {addPackageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
                      Add Package
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Wellness Credits Section */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Wellness Credits ({wellnessCredits.length})
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setShowAddWellnessCredits(!showAddWellnessCredits)}>
                      <Plus className="h-3 w-3 mr-1" /> Grant Credits
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {wellnessCreditsLoading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : wellnessCredits.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No wellness credits</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {wellnessCredits.map((credit: any) => {
                        const pct = credit.credits_total > 0 ? (credit.credits_remaining / credit.credits_total) * 100 : 0;
                        const daysLeft = differenceInDays(new Date(credit.expires_at), new Date());
                        const expiringSoon = daysLeft <= 14 && daysLeft > 0;
                        const expired = daysLeft <= 0;
                        const hasCredits = credit.credits_remaining > 0;
                        const typeLabel = credit.credit_type === "red_light" ? "Red Light Therapy" : "Dry Cryotherapy";

                        return (
                          <div
                            key={credit.id}
                            className={`p-4 rounded-lg border ${hasCredits && !expired ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30"}`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="text-sm font-medium">{typeLabel}</p>
                                <p className={`text-xs ${expiringSoon ? "text-destructive font-medium" : expired ? "text-destructive" : "text-muted-foreground"}`}>
                                  {expired
                                    ? "Expired"
                                    : expiringSoon
                                    ? `Expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
                                    : `Expires ${format(new Date(credit.expires_at), "MMM d, yyyy")}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                {isSuperAdmin() && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingCredit(credit)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Badge variant={hasCredits && !expired ? "default" : "secondary"} className="text-xs">
                                  {expired ? "expired" : hasCredits ? "active" : "exhausted"}
                                </Badge>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{credit.credits_remaining} remaining</span>
                                <span>{credit.credits_total} total</span>
                              </div>
                              <Progress value={pct} className="h-2" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add Wellness Credits Form */}
              {showAddWellnessCredits && (
                <Card className="border-primary/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">Grant Wellness Credits</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setShowAddWellnessCredits(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription className="text-xs">Grant Red Light or Dry Cryo credits to this non-member account.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Credit Type</Label>
                        <Select value={wellnessCreditType} onValueChange={(v) => setWellnessCreditType(v as "red_light" | "dry_cryo")}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="red_light">Red Light Therapy</SelectItem>
                            <SelectItem value="dry_cryo">Dry Cryotherapy</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Credits</Label>
                        <Input type="number" value={wellnessCreditCount} onChange={(e) => setWellnessCreditCount(e.target.value)} min="1" max="50" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Expires In (days)</Label>
                        <Input type="number" value={wellnessExpirationDays} onChange={(e) => setWellnessExpirationDays(e.target.value)} min="1" max="365" />
                      </div>
                    </div>
                    <div className="p-3 rounded-sm border border-border bg-muted/20 text-sm">
                      <strong>Summary:</strong> {wellnessCreditCount} {wellnessCreditType === "red_light" ? "Red Light Therapy" : "Dry Cryotherapy"} credit{parseInt(wellnessCreditCount) !== 1 ? "s" : ""},
                      expiring {format(addDays(new Date(), parseInt(wellnessExpirationDays)), "MMM d, yyyy")}.
                    </div>
                    <Button
                      onClick={() => addWellnessCreditsMutation.mutate()}
                      disabled={addWellnessCreditsMutation.isPending}
                      size="sm"
                    >
                      {addWellnessCreditsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                      Grant Credits
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Personal Training */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Dumbbell className="h-4 w-4" />
                      Personal Training ({ptPasses.length} pack{ptPasses.length === 1 ? "" : "s"})
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowSellPT(true)}>
                        <Plus className="h-3 w-3 mr-1" /> Sell Pack
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowBookPT(true)}>
                        <Calendar className="h-3 w-3 mr-1" /> Book Session
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ptPassesLoading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : ptPasses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No PT packs. Sell a pack before booking a session.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ptPasses.map((pass: any) => (
                        <div key={pass.id} className="rounded-md border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">
                              {pass.pack_name || PT_FORMAT_LABEL[pass.format as keyof typeof PT_FORMAT_LABEL] || pass.format}
                            </p>
                            <Badge variant={pass.status === "active" ? "default" : "secondary"} className="text-xs">
                              {pass.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {pass.sessions_remaining} of {pass.sessions_total} sessions left
                            {pass.expires_at ? ` · expires ${format(new Date(pass.expires_at), "MMM d, yyyy")}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Appointments</p>
                    {ptApptsLoading ? (
                      <Skeleton className="h-12 w-full" />
                    ) : ptAppointments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No PT appointments yet</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Format</TableHead>
                            <TableHead>Trainer</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ptAppointments.map((appt: any) => (
                            <TableRow key={appt.id}>
                              <TableCell className="text-sm">
                                {format(new Date(appt.starts_at), "MMM d, yyyy · h:mm a")}
                              </TableCell>
                              <TableCell className="text-sm">
                                {PT_FORMAT_LABEL[appt.format as keyof typeof PT_FORMAT_LABEL] || appt.format}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {appt.instructors
                                  ? `${appt.instructors.first_name ?? ""} ${appt.instructors.last_name ?? ""}`.trim() || "—"
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={appt.status === "scheduled" ? "default" : "secondary"} className="text-xs">
                                  {appt.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Sell Guest Pass */}
              <NonMemberGuestPassSaleCard
                userId={userId!}
                firstName={profile.first_name}
                lastName={profile.last_name}
                email={profile.email}
                phone={profile.phone}
                adminUserId={user?.id || ""}
                stripeCustomerId={profile.stripe_customer_id}
                cardBrand={profile.card_brand}
                cardLast4={profile.card_last4}
              />

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Booking History ({bookings.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {bookingsLoading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : bookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No bookings yet</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Instructor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Credits</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookings.map((booking: any) => {
                          const session = booking.class_sessions;
                          return (
                            <TableRow key={booking.id}>
                              <TableCell className="text-sm">
                                {session?.session_date
                                  ? format(new Date(session.session_date), "MMM d, yyyy")
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {session?.start_time
                                  ? format(new Date(`2000-01-01T${session.start_time}`), "h:mm a")
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-sm font-medium">
                                {session?.class_types?.name || "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {session?.instructors
                                  ? `${session.instructors.first_name ?? ""} ${session.instructors.last_name ?? ""}`.trim() || "—"
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={booking.status === "confirmed" ? "default" : "secondary"} className="text-xs">
                                  {booking.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {booking.credits_used > 0 ? booking.credits_used : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Credit Usage History */}
              {creditUsage.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Credit Usage History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead className="text-right">Credits Used</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {creditUsage.map((usage: any) => (
                          <TableRow key={usage.id}>
                            <TableCell className="text-sm">
                              {usage.class_sessions?.session_date
                                ? format(new Date(usage.class_sessions.session_date), "MMM d, yyyy")
                                : format(new Date(usage.booked_at), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-sm">
                              {usage.class_sessions?.class_types?.name || "Class"}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium text-destructive">
                              -{usage.credits_used}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ===== PAYMENTS TAB ===== */}
          <TabsContent value="payments">
            <div className="space-y-6">
              {/* POS Button */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Point of Sale</CardTitle>
                    <Button size="sm" onClick={() => setShowChargeSelector(true)}>
                      <DollarSign className="h-4 w-4 mr-1" /> Charge / Record Payment
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Sell cafe items, wellness services, class passes, or record custom charges.
                  </p>
                </CardContent>
              </Card>

              {/* Charge History */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Charge History ({charges.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {charges.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No charges recorded</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {charges.map((charge: any) => (
                          <TableRow key={charge.id}>
                            <TableCell className="text-sm">
                              {format(new Date(charge.created_at), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-sm max-w-[250px] truncate">
                              {charge.description || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={charge.status === "succeeded" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {charge.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              ${(charge.amount / 100).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>

    {/* ChargeItemSelector Dialog */}
    <ChargeItemSelector
      open={showChargeSelector}
      onOpenChange={setShowChargeSelector}
      member={pseudoMember}
      nonMember={{
        userId: userId!,
        stripeCustomerId: profile.stripe_customer_id || undefined,
        firstName: profile.first_name || undefined,
        lastName: profile.last_name || undefined,
      }}
      onChargeSuccess={() => {
        queryClient.invalidateQueries({ queryKey: ["admin-nonmember-charges", userId] });
      }}
    />

    {editingPass && (
      <EditClassPassDialog
        open={!!editingPass}
        onOpenChange={(open) => { if (!open) setEditingPass(null); }}
        pass={editingPass}
        queryKeysToInvalidate={[["admin-nonmember-passes", userId]]}
      />
    )}

    {editingCredit && (
      <EditCreditDialog
        open={!!editingCredit}
        onOpenChange={(open) => { if (!open) setEditingCredit(null); }}
        credit={editingCredit}
        queryKeysToInvalidate={[["admin-nonmember-wellness-credits", userId]]}
      />
    )}

    {showGrantDialog && (
      <AdminGrantPassDialog
        open={showGrantDialog}
        onOpenChange={setShowGrantDialog}
        prefill={{
          userId: userId!,
          name: fullName,
          email: profile.email || undefined,
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-nonmember-passes", userId] });
          queryClient.invalidateQueries({ queryKey: ["admin-nonmember-wellness-credits", userId] });
        }}
      />
    )}

    <BookPTSessionDialog
      open={showBookPT}
      onOpenChange={setShowBookPT}
      presetUserId={userId!}
      presetUserName={`${fullName}${profile.email ? ` (${profile.email})` : ""}`}
      onSellPack={() => { setShowBookPT(false); setShowSellPT(true); }}
      onBooked={() => {
        queryClient.invalidateQueries({ queryKey: ["admin-nonmember-pt-passes", userId] });
        queryClient.invalidateQueries({ queryKey: ["admin-nonmember-pt-appointments", userId] });
      }}
    />

    <SellPTDialog
      open={showSellPT}
      onOpenChange={(open) => {
        setShowSellPT(open);
        if (!open) {
          queryClient.invalidateQueries({ queryKey: ["admin-nonmember-pt-passes", userId] });
        }
      }}
      presetUserId={userId!}
      presetUserName={`${fullName}${profile.email ? ` (${profile.email})` : ""}`}
    />
    </>
  );
}
