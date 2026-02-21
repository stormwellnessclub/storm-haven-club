import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  ArrowLeft, Edit2, X, Check, CreditCard, RefreshCw, ShieldCheck, ShieldX,
  Package, Calendar, Loader2, Mail, Phone, User,
} from "lucide-react";

export default function NonMemberDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });

  // Add package state
  const [showAddPackage, setShowAddPackage] = useState(false);
  const [category, setCategory] = useState("");
  const [passType, setPassType] = useState("");
  const [expirationDays, setExpirationDays] = useState("90");

  // Fetch profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ["admin-nonmember-detail", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("non_member_profiles")
        .select("*")
        .eq("user_id", userId!)
        .single();
      if (error) throw error;
      return data;
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

  // Fetch bookings
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["admin-nonmember-bookings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_bookings")
        .select("*, class_sessions(session_date, start_time, class_types(name))")
        .eq("user_id", userId!)
        .order("booked_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

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

  return (
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
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/non-member-accounts")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>

        {/* Main 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT COLUMN */}
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
              <CardContent>
                {profile.waiver_signed ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <ShieldCheck className="h-3 w-3 mr-1" /> Signed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    <ShieldX className="h-3 w-3 mr-1" /> Missing
                  </Badge>
                )}
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
                  onClick={() => setShowAddPackage(true)}
                >
                  <Package className="h-4 w-4 mr-2" /> Add Package
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

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            {/* Class Passes */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Class Passes ({passes.length})
                  </CardTitle>
                  <Badge variant="outline">{activePasses} active</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {passesLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : passes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No class passes</p>
                ) : (
                  <div className="space-y-3">
                    {passes.map((pass) => (
                      <div key={pass.id} className="flex items-center justify-between p-3 rounded-sm border border-border bg-background">
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {pass.category?.replace("_", " ")} — {pass.pass_type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Expires {format(new Date(pass.expires_at), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={pass.status === "active" ? "default" : "secondary"} className="text-xs">
                            {pass.status}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {pass.classes_remaining}/{pass.classes_total} left
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Inline Add Package */}
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

            {/* Booking History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Recent Bookings ({bookings.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bookingsLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bookings yet</p>
                ) : (
                  <div className="space-y-2">
                    {bookings.map((booking: any) => (
                      <div key={booking.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium">
                            {booking.class_sessions?.class_types?.name || "Class"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {booking.class_sessions?.session_date
                              ? format(new Date(booking.class_sessions.session_date), "MMM d, yyyy")
                              : "—"}
                          </p>
                        </div>
                        <Badge variant={booking.status === "confirmed" ? "default" : "secondary"} className="text-xs">
                          {booking.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
