import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users, Package, Download, Upload, Mail, Search, CreditCard, ShieldCheck, ShieldX,
  MoreHorizontal, Eye, ChevronDown, Clock, UserPlus,
} from "lucide-react";
import { NonMemberStripeImport } from "@/components/admin/NonMemberStripeImport";
import { BulkNonMemberImport } from "@/components/admin/BulkNonMemberImport";
import { format } from "date-fns";

interface NonMemberAccount {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  card_brand: string | null;
  card_last4: string | null;
  waiver_signed: boolean | null;
  waiver_status: "signed" | "unsigned";
  waiver_source: "explicit" | "inferred_booking" | "inferred_pass" | "none";
  waiver_signed_at: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  activePasses: number;
  totalPasses: number;
}

export default function NonMemberAccounts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [noPhoneOnly, setNoPhoneOnly] = useState(false);
  const [activationEmail, setActivationEmail] = useState("");
  const [showActivationDialog, setShowActivationDialog] = useState(false);
  const [stripeImportOpen, setStripeImportOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  // Fetch non-member accounts with pass counts
  const { data: accounts, isLoading } = useQuery({
    queryKey: ["admin-non-member-accounts"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("non_member_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (profilesError) throw profilesError;

      // Also find users with class_passes but no non_member_profiles row
      const { data: orphanedPassUsers } = await supabase
        .from("class_passes")
        .select("user_id")
        .not("user_id", "in", `(${(profiles || []).map((p: any) => p.user_id).join(",") || "00000000-0000-0000-0000-000000000000"})`);

      const orphanedUserIds = [...new Set((orphanedPassUsers || []).map((p: any) => p.user_id).filter(Boolean))];

      // Fetch profile data for orphaned users
      let orphanedProfiles: any[] = [];
      if (orphanedUserIds.length > 0) {
        const { data: opData } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, phone, email")
          .in("user_id", orphanedUserIds);
        orphanedProfiles = opData || [];
      }

      const allProfiles = [
        ...(profiles || []),
        ...orphanedProfiles.map((op: any) => ({
          user_id: op.user_id,
          email: op.email,
          first_name: op.first_name,
          last_name: op.last_name,
          phone: op.phone,
          card_brand: null,
          card_last4: null,
          waiver_signed: null,
          stripe_customer_id: null,
          created_at: new Date().toISOString(),
        })),
      ];

      const userIds = allProfiles.map((p: any) => p.user_id).filter(Boolean);
      let passesData: any[] = [];
      if (userIds.length > 0) {
        const { data: passes } = await supabase
          .from("class_passes")
          .select("user_id, status")
          .in("user_id", userIds);
        passesData = passes || [];
      }

      // Effective waiver status via RPC (explicit flag OR inferred from bookings/passes)
      let waiverMap = new Map<string, { status: string; source: string; signed_at: string | null }>();
      if (userIds.length > 0) {
        const { data: waiverRows } = await supabase.rpc("effective_waiver_status", { _user_ids: userIds });
        (waiverRows || []).forEach((w: any) => {
          waiverMap.set(w.user_id, { status: w.status, source: w.source, signed_at: w.signed_at });
        });
      }

      return allProfiles.map((p: any) => {
        const userPasses = passesData.filter((pass: any) => pass.user_id === p.user_id);
        const w = waiverMap.get(p.user_id);
        return {
          user_id: p.user_id,
          email: p.email,
          first_name: p.first_name,
          last_name: p.last_name,
          phone: p.phone,
          card_brand: p.card_brand,
          card_last4: p.card_last4,
          waiver_signed: p.waiver_signed,
          waiver_status: (w?.status === "signed" ? "signed" : "unsigned") as "signed" | "unsigned",
          waiver_source: (w?.source ?? "none") as NonMemberAccount["waiver_source"],
          waiver_signed_at: w?.signed_at ?? null,
          stripe_customer_id: p.stripe_customer_id,
          created_at: p.created_at,
          activePasses: userPasses.filter((pass: any) => pass.status === "active").length,
          totalPasses: userPasses.length,
        } as NonMemberAccount;
      });
    },
  });

  // Fetch pending imports
  const { data: pendingImports } = useQuery({
    queryKey: ["pending-non-member-imports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_non_member_imports")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Send activation invite
  const sendActivationMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { type: "account_activation_invite", to: email, data: { email } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Activation link sent");
      setActivationEmail("");
      setShowActivationDialog(false);
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  // Send pending import activation email
  const sendPendingEmailMutation = useMutation({
    mutationFn: async (imp: { id: string; email: string; first_name: string }) => {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { type: "account_activation_invite", to: imp.email, data: { email: imp.email, first_name: imp.first_name } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await supabase
        .from("pending_non_member_imports")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", imp.id);
      return imp;
    },
    onSuccess: (imp) => {
      toast.success(`Activation email sent to ${imp.email}`);
      queryClient.invalidateQueries({ queryKey: ["pending-non-member-imports"] });
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  const unsentPending = (pendingImports || []).filter((p: any) => !p.email_sent_at);

  const handleSendAll = async () => {
    for (const imp of unsentPending) {
      if (imp.email) {
        sendPendingEmailMutation.mutate({ id: imp.id, email: imp.email, first_name: imp.first_name });
      }
    }
  };

  const filteredAccounts = (accounts || []).filter((a) => {
    if (noPhoneOnly && a.phone?.trim()) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.email?.toLowerCase().includes(q) ||
      a.first_name?.toLowerCase().includes(q) ||
      a.last_name?.toLowerCase().includes(q) ||
      a.phone?.includes(q)
    );
  });

  const missingPhoneCount = accounts?.filter((a) => !a.phone?.trim()).length || 0;

  const filteredPending = (pendingImports || []).filter((p: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.email?.toLowerCase().includes(q) ||
      p.first_name?.toLowerCase().includes(q) ||
      p.last_name?.toLowerCase().includes(q) ||
      p.phone?.includes(q)
    );
  });

  // Summary stats
  const totalAccounts = accounts?.length || 0;
  const withActivePasses = accounts?.filter((a) => a.activePasses > 0).length || 0;
  const missingWaivers = accounts?.filter((a) => a.waiver_status !== "signed").length || 0;
  const pendingCount = pendingImports?.length || 0;

  return (
    <AdminLayout title="Non-Member Accounts">
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{totalAccounts}</p>
                  <p className="text-xs text-muted-foreground">Total Accounts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{withActivePasses}</p>
                  <p className="text-xs text-muted-foreground">With Active Passes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <ShieldX className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">{missingWaivers}</p>
                  <p className="text-xs text-muted-foreground">Missing Waivers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <UserPlus className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Pending Registration</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={noPhoneOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setNoPhoneOnly((v) => !v)}
            >
              No phone ({missingPhoneCount})
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBulkImportOpen(!bulkImportOpen)}>
              <Upload className="h-4 w-4 mr-2" /> Bulk Pre-Register
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStripeImportOpen(!stripeImportOpen)}>
              <Download className="h-4 w-4 mr-2" /> Import from Stripe
            </Button>
            <Dialog open={showActivationDialog} onOpenChange={setShowActivationDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" /> Send Activation Link
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Send Activation Link</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    type="email" placeholder="Enter email address..."
                    value={activationEmail} onChange={(e) => setActivationEmail(e.target.value)}
                  />
                  <Button
                    onClick={() => sendActivationMutation.mutate(activationEmail)}
                    disabled={!activationEmail || sendActivationMutation.isPending}
                    className="w-full"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {sendActivationMutation.isPending ? "Sending..." : "Send Invitation"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    The recipient will receive an email to create their account. Existing Stripe purchases will be linked automatically.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Bulk Import Collapsible */}
        <Collapsible open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
          <CollapsibleContent>
            <BulkNonMemberImport />
          </CollapsibleContent>
        </Collapsible>

        {/* Stripe Import Collapsible */}
        <Collapsible open={stripeImportOpen} onOpenChange={setStripeImportOpen}>
          <CollapsibleContent>
            <NonMemberStripeImport />
          </CollapsibleContent>
        </Collapsible>

        {/* Pending Registrations */}
        {filteredPending.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-blue-500" />
                  Pending Registrations
                </CardTitle>
                <CardDescription className="mt-1">
                  {pendingCount} people pre-registered but haven't created accounts yet
                </CardDescription>
              </div>
              {unsentPending.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendAll}
                  disabled={sendPendingEmailMutation.isPending}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send All ({unsentPending.length})
                </Button>
              )}
            </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead>Pass</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPending.map((imp: any) => (
                    <TableRow key={imp.id}>
                      <TableCell className="font-medium">
                        {imp.first_name} {imp.last_name}
                      </TableCell>
                      <TableCell className="text-sm">{imp.email}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{imp.phone || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {imp.pass_category === "pilates_cycling" ? "Pilates/Cycling" : imp.pass_category === "aerobics" ? "Aerobics" : "Other"} ({imp.classes_total})
                      </TableCell>
                      <TableCell>
                        {imp.email_sent_at ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <Mail className="h-3 w-3 mr-1" /> {format(new Date(imp.email_sent_at), "MMM d")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            <Clock className="h-3 w-3 mr-1" /> Not Sent
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!imp.email_sent_at && imp.email && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => sendPendingEmailMutation.mutate({ id: imp.id, email: imp.email, first_name: imp.first_name })}
                            disabled={sendPendingEmailMutation.isPending}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Accounts Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>All Accounts</CardTitle>
            <CardDescription>
              {totalAccounts} registered non-member{totalAccounts !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No non-member accounts found</p>
                <p className="text-sm mt-1">
                  {searchQuery ? "Try adjusting your search" : "Non-member accounts will appear here when created"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead>Card</TableHead>
                    <TableHead>Waiver</TableHead>
                    <TableHead>Passes</TableHead>
                    <TableHead className="hidden lg:table-cell">Joined</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow
                      key={account.user_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/admin/non-member-accounts/${account.user_id}`)}
                    >
                      <TableCell className="font-medium">
                        {account.first_name || account.last_name
                          ? `${account.first_name || ""} ${account.last_name || ""}`.trim()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{account.email || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {account.phone || (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            No phone
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {account.card_last4 ? (
                          <span className="flex items-center gap-1 text-sm">
                            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                            •••• {account.card_last4}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {account.waiver_signed ? (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            <ShieldCheck className="h-3 w-3 mr-1" /> Signed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            <ShieldX className="h-3 w-3 mr-1" /> Missing
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          <span className="font-semibold">{account.activePasses}</span>
                          <span className="text-muted-foreground"> / {account.totalPasses}</span>
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {format(new Date(account.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/non-member-accounts/${account.user_id}`); }}>
                              <Eye className="h-4 w-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              if (account.email) {
                                sendActivationMutation.mutate(account.email);
                              } else {
                                toast.error("No email on file");
                              }
                            }}>
                              <Mail className="h-4 w-4 mr-2" /> Send Activation Email
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
      </div>
    </AdminLayout>
  );
}
