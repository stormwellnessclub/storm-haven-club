import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Package, Download, Mail, Search, RefreshCw, CreditCard, ShieldCheck, ShieldX, Eye } from "lucide-react";
import { NonMemberDetailSheet } from "@/components/admin/NonMemberDetailSheet";
import { NonMemberAddPackage } from "@/components/admin/NonMemberAddPackage";
import { NonMemberStripeImport } from "@/components/admin/NonMemberStripeImport";
import { format } from "date-fns";

interface NonMemberAccount {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  waiver_signed: boolean | null;
  stripe_customer_id: string | null;
  created_at: string;
  activePasses: number;
  totalPasses: number;
}

export default function NonMemberAccounts() {
  const [selectedAccount, setSelectedAccount] = useState<NonMemberAccount | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activationEmail, setActivationEmail] = useState("");
  const queryClient = useQueryClient();

  // Fetch non-member accounts with pass counts
  const { data: accounts, isLoading } = useQuery({
    queryKey: ["admin-non-member-accounts"],
    queryFn: async () => {
      // Get non_member_profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("non_member_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get all class passes for these users
      const userIds = (profiles || []).map((p: any) => p.user_id).filter(Boolean);
      
      let passesData: any[] = [];
      if (userIds.length > 0) {
        const { data: passes } = await supabase
          .from("class_passes")
          .select("user_id, status")
          .in("user_id", userIds);
        passesData = passes || [];
      }

      // Merge data
      return (profiles || []).map((p: any) => {
        const userPasses = passesData.filter((pass: any) => pass.user_id === p.user_id);
        return {
          user_id: p.user_id,
          email: p.email,
          first_name: p.first_name,
          last_name: p.last_name,
          phone: p.phone,
          card_brand: p.card_brand,
          card_last4: p.card_last4,
          card_exp_month: p.card_exp_month,
          card_exp_year: p.card_exp_year,
          waiver_signed: p.waiver_signed,
          stripe_customer_id: p.stripe_customer_id,
          created_at: p.created_at,
          activePasses: userPasses.filter((pass: any) => pass.status === "active").length,
          totalPasses: userPasses.length,
        } as NonMemberAccount;
      });
    },
  });

  // Send activation invite
  const sendActivationMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "account_activation_invite",
          to: email,
          data: { email },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Activation link sent successfully");
      setActivationEmail("");
    },
    onError: (err: Error) => {
      toast.error(`Failed to send: ${err.message}`);
    },
  });

  const filteredAccounts = (accounts || []).filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.email?.toLowerCase().includes(q) ||
      a.first_name?.toLowerCase().includes(q) ||
      a.last_name?.toLowerCase().includes(q) ||
      a.phone?.includes(q)
    );
  });

  return (
    <AdminLayout title="Non-Member Accounts">
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">
            Manage non-member class pass holders, import Stripe purchases, and send activation links.
          </p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Accounts</span>
            </TabsTrigger>
            <TabsTrigger value="add-package" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Add Package</span>
            </TabsTrigger>
            <TabsTrigger value="stripe-import" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Stripe Import</span>
            </TabsTrigger>
            <TabsTrigger value="activation" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Activation</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Accounts Overview */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>All Non-Member Accounts</CardTitle>
                    <CardDescription>
                      {accounts?.length || 0} registered non-member{(accounts?.length || 0) !== 1 ? "s" : ""}
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
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
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAccounts.map((account) => (
                        <TableRow key={account.user_id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-medium">
                            {account.first_name || account.last_name
                              ? `${account.first_name || ""} ${account.last_name || ""}`.trim()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm">{account.email || "—"}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{account.phone || "—"}</TableCell>
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
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                Signed
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                <ShieldX className="h-3 w-3 mr-1" />
                                Missing
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedAccount(account);
                                setSheetOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Add Package */}
          <TabsContent value="add-package">
            <NonMemberAddPackage />
          </TabsContent>

          {/* Tab 3: Stripe Import */}
          <TabsContent value="stripe-import">
            <NonMemberStripeImport />
          </TabsContent>

          {/* Tab 4: Send Activation Link */}
          <TabsContent value="activation">
            <Card>
              <CardHeader>
                <CardTitle>Send Activation Link</CardTitle>
                <CardDescription>
                  Send a branded email inviting someone to create their free account to access purchased class passes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    type="email"
                    placeholder="Enter email address..."
                    value={activationEmail}
                    onChange={(e) => setActivationEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => sendActivationMutation.mutate(activationEmail)}
                    disabled={!activationEmail || sendActivationMutation.isPending}
                    className="whitespace-nowrap"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {sendActivationMutation.isPending ? "Sending..." : "Send Invitation"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  The recipient will receive a branded email with a link to create their account at Storm Wellness Club. 
                  Once signed up, any class passes purchased via Stripe will be automatically linked to their account.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Sheet */}
      <NonMemberDetailSheet
        account={selectedAccount}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </AdminLayout>
  );
}
