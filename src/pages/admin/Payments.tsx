 import { useState, useMemo } from "react";
 import { AdminLayout } from "@/components/admin/AdminLayout";
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
 import {
   Search,
   MoreHorizontal,
   DollarSign,
   TrendingUp,
   AlertTriangle,
   CreditCard,
   RefreshCcw,
   ShoppingBag,
   UserPlus,
   Loader2,
 } from "lucide-react";
 import { SellMembershipPackage } from "@/components/admin/SellMembershipPackage";
 import { SellClassPackage } from "@/components/admin/SellClassPackage";
 import { useAdminTransactions } from "@/hooks/useAdminTransactions";
 import { Skeleton } from "@/components/ui/skeleton";
 
 const getStatusBadge = (status: string) => {
   switch (status) {
     case "succeeded":
       return <Badge className="bg-green-500/20 text-green-700 dark:text-green-400">Paid</Badge>;
     case "failed":
       return <Badge className="bg-destructive/20 text-destructive">Failed</Badge>;
     case "refunded":
       return <Badge className="bg-accent/20 text-accent-foreground">Refunded</Badge>;
     case "pending":
       return <Badge className="bg-secondary/20 text-secondary-foreground">Pending</Badge>;
     case "requires_action":
       return <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400">Action Required</Badge>;
     default:
       return <Badge variant="outline">{status}</Badge>;
   }
 };
 
 export default function Payments() {
   const [searchQuery, setSearchQuery] = useState("");
   const [showMembershipDialog, setShowMembershipDialog] = useState(false);
   const [showClassPackageDialog, setShowClassPackageDialog] = useState(false);
 
   const { transactions, stats, isLoading, error } = useAdminTransactions();
 
   const filteredTransactions = useMemo(() => {
     if (!transactions) return [];
     const query = searchQuery.toLowerCase();
     return transactions.filter(
       (tx) =>
         tx.member_name.toLowerCase().includes(query) ||
         tx.type.toLowerCase().includes(query) ||
         tx.status.toLowerCase().includes(query)
     );
   }, [transactions, searchQuery]);
 
   if (error) {
     console.error("[Payments] Error loading transactions:", error);
   }
 
   return (
     <AdminLayout title="Payments">
       <div className="space-y-6">
         {/* Action Buttons */}
         <div className="flex gap-4">
           <Button onClick={() => setShowMembershipDialog(true)}>
             <UserPlus className="h-4 w-4 mr-2" />
             Sell Membership
           </Button>
           <Button variant="outline" onClick={() => setShowClassPackageDialog(true)}>
             <ShoppingBag className="h-4 w-4 mr-2" />
             Sell Class Package
           </Button>
         </div>
 
         <Tabs defaultValue="transactions" className="space-y-4">
           <TabsList>
             <TabsTrigger value="transactions">Transactions</TabsTrigger>
             <TabsTrigger value="process">Process Payment</TabsTrigger>
           </TabsList>
 
           <TabsContent value="transactions" className="space-y-4">
             {/* Stats */}
             <div className="grid gap-4 md:grid-cols-4">
               <Card>
                 <CardContent className="pt-6">
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-sm text-muted-foreground">Revenue Today</p>
                       {isLoading ? (
                         <Skeleton className="h-8 w-24 mt-1" />
                       ) : (
                         <p className="text-2xl font-bold">${stats.revenueToday.toLocaleString()}</p>
                       )}
                     </div>
                     <DollarSign className="h-8 w-8 text-muted-foreground" />
                   </div>
                 </CardContent>
               </Card>
               <Card>
                 <CardContent className="pt-6">
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                       {isLoading ? (
                         <Skeleton className="h-8 w-24 mt-1" />
                       ) : (
                         <p className="text-2xl font-bold">${stats.revenueThisMonth.toLocaleString()}</p>
                       )}
                     </div>
                     <TrendingUp className="h-8 w-8 text-secondary-foreground" />
                   </div>
                 </CardContent>
               </Card>
               <Card>
                 <CardContent className="pt-6">
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-sm text-muted-foreground">Active Subscriptions</p>
                       {isLoading ? (
                         <Skeleton className="h-8 w-24 mt-1" />
                       ) : (
                         <p className="text-2xl font-bold">{stats.activeSubscriptions}</p>
                       )}
                     </div>
                     <CreditCard className="h-8 w-8 text-primary" />
                   </div>
                 </CardContent>
               </Card>
               <Card>
                 <CardContent className="pt-6">
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-sm text-muted-foreground">Failed Payments</p>
                       {isLoading ? (
                         <Skeleton className="h-8 w-24 mt-1" />
                       ) : (
                         <p className="text-2xl font-bold">{stats.failedPayments}</p>
                       )}
                     </div>
                     <AlertTriangle className="h-8 w-8 text-destructive" />
                   </div>
                 </CardContent>
               </Card>
             </div>
 
             {/* Search */}
             <div className="flex gap-4">
               <div className="relative flex-1 max-w-md">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                 <Input
                   placeholder="Search payments..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="pl-10"
                 />
               </div>
             </div>
 
             {/* Payments Table */}
             <Card>
               <CardHeader>
                 <CardTitle>Recent Transactions</CardTitle>
                 <CardDescription>
                   {isLoading ? "Loading..." : `${filteredTransactions.length} transactions`}
                 </CardDescription>
               </CardHeader>
               <CardContent>
                 {isLoading ? (
                   <div className="flex items-center justify-center py-12">
                     <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                   </div>
                 ) : filteredTransactions.length === 0 ? (
                   <div className="text-center py-12 text-muted-foreground">
                     {searchQuery ? "No transactions match your search" : "No transactions found"}
                   </div>
                 ) : (
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>Member</TableHead>
                         <TableHead>Type</TableHead>
                         <TableHead>Amount</TableHead>
                         <TableHead>Status</TableHead>
                         <TableHead>Date</TableHead>
                         <TableHead>Payment Method</TableHead>
                         <TableHead className="text-right">Actions</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {filteredTransactions.map((tx) => (
                         <TableRow key={tx.id}>
                           <TableCell className="font-medium">{tx.member_name}</TableCell>
                           <TableCell>{tx.type}</TableCell>
                           <TableCell className="font-medium">
                             ${tx.amount.toLocaleString()}
                           </TableCell>
                           <TableCell>{getStatusBadge(tx.status)}</TableCell>
                           <TableCell>{tx.date}</TableCell>
                           <TableCell className="text-muted-foreground">
                             {tx.payment_method}
                           </TableCell>
                           <TableCell className="text-right">
                             <DropdownMenu>
                               <DropdownMenuTrigger asChild>
                                 <Button variant="ghost" size="icon">
                                   <MoreHorizontal className="h-4 w-4" />
                                 </Button>
                               </DropdownMenuTrigger>
                               <DropdownMenuContent align="end">
                                 <DropdownMenuItem>View Details</DropdownMenuItem>
                                 <DropdownMenuItem>Send Receipt</DropdownMenuItem>
                                 {tx.status === "failed" && (
                                   <DropdownMenuItem>
                                     <RefreshCcw className="h-4 w-4 mr-2" />
                                     Retry Payment
                                   </DropdownMenuItem>
                                 )}
                                 {tx.status === "succeeded" && (
                                   <DropdownMenuItem className="text-destructive">
                                     Issue Refund
                                   </DropdownMenuItem>
                                 )}
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
           </TabsContent>
 
           <TabsContent value="process" className="space-y-4">
             <Card>
               <CardHeader>
                 <CardTitle>Process Payment</CardTitle>
                 <CardDescription>
                   Choose to create a payment link or process payment directly.
                 </CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 <div className="grid gap-4 md:grid-cols-2">
                   <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setShowMembershipDialog(true)}>
                     <div className="flex items-center gap-3">
                       <UserPlus className="h-8 w-8 text-primary" />
                       <div>
                         <h3 className="font-semibold">Membership Payment</h3>
                         <p className="text-sm text-muted-foreground">Process membership activation</p>
                       </div>
                     </div>
                   </Card>
                   <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setShowClassPackageDialog(true)}>
                     <div className="flex items-center gap-3">
                       <ShoppingBag className="h-8 w-8 text-primary" />
                       <div>
                         <h3 className="font-semibold">Class Package</h3>
                         <p className="text-sm text-muted-foreground">Sell class packages</p>
                       </div>
                     </div>
                   </Card>
                 </div>
               </CardContent>
             </Card>
           </TabsContent>
         </Tabs>
       </div>
 
       <SellMembershipPackage
         open={showMembershipDialog}
         onOpenChange={setShowMembershipDialog}
       />
       <SellClassPackage
         open={showClassPackageDialog}
         onOpenChange={setShowClassPackageDialog}
       />
     </AdminLayout>
   );
 }